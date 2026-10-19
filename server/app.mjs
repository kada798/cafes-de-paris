import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { openDatabase, seedDatabase, catalogRepository, ROOT } from './repositories/catalog.mjs';
import { evaluatePlaces, currentCrowding } from '../shared/match.mjs';
import { calculateRoutes } from './routing/providers.mjs';
import { upcomingEvent } from '../shared/events.mjs';
import { syncEvents } from './ingestion/sync.mjs';

export function validateQuery(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) throw new Error('Invalid query');
  const allowed = new Set([
    'laptop',
    'power',
    'wifi',
    'pets',
    'decaf',
    'caffeineFree',
    'reservation',
    'quiet',
    'conversation',
    'terrace',
  ]);
  const requirements = Object.fromEntries(
    Object.entries(q.requirements || {}).filter(
      ([k, v]) => allowed.has(k) && ['must', 'prefer'].includes(v)
    )
  );
  let origin = null;
  if (q.origin) {
    const lat = Number(q.origin.lat),
      lng = Number(q.origin.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 48.5 ||
      lat > 49.1 ||
      lng < 1.8 ||
      lng > 2.9
    )
      throw new Error('Choose an origin in the Paris region');
    origin = { lat, lng };
  }
  const departure = q.departure || null;
  if (
    departure &&
    (!Number.isFinite(Date.parse(departure)) || !/(Z|[+-]\d{2}:\d{2})$/.test(departure))
  )
    throw new Error('Departure must include a timezone');
  const bounded = (n, fallback, low, high) =>
    Number.isFinite(Number(n)) ? Math.min(high, Math.max(low, Number(n))) : fallback;
  return {
    text: String(q.text || '').slice(0, 100),
    kind: ['cafe', 'library', 'workspace'].includes(q.kind) ? q.kind : '',
    type: String(q.type || '').slice(0, 30),
    ids: Array.isArray(q.ids) ? q.ids.slice(0, 30).map(String) : [],
    includeDemo: q.includeDemo === true,
    requirements,
    origin,
    departure,
    maxMinutes: bounded(q.maxMinutes, 20, 5, 90),
    stayMinutes: bounded(q.stayMinutes, 120, 15, 480),
    group: bounded(q.group, 1, 1, 20),
    budget: q.budget ? bounded(q.budget, 10, 1, 200) : null,
    mode: ['walking', 'transit', 'either'].includes(q.mode) ? q.mode : 'walking',
  };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
export function createApp(db) {
  const repo = catalogRepository(db);
  const limits = new Map();
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (data, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const ip = req.socket.remoteAddress,
          current = limits.get(ip);
        const bucket =
          current && current.until > Date.now() ? current : { count: 0, until: Date.now() + 60000 };
        if (++bucket.count > 100) return send({ error: 'Too many requests' }, 429);
        limits.set(ip, bucket);
        if (limits.size > 1000)
          for (const [key, value] of limits) if (value.until < Date.now()) limits.delete(key);
        if (req.method === 'GET' && url.pathname === '/api/catalog')
          return send({
            places: repo.places().map((p) => ({ ...p, crowding: currentCrowding(p.crowding) })),
            articles: repo.articles(),
            events: repo
              .events()
              .map((e) => upcomingEvent(e))
              .filter(Boolean)
              .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
            syncRuns: repo.syncRuns(),
            capabilities: {
              walking: Boolean(process.env.ORS_API_KEY),
              transit: Boolean(process.env.PRIM_API_KEY),
              timezone: 'Europe/Paris',
            },
          });
        if (req.method === 'POST' && url.pathname === '/api/search') {
          let body = '',
            size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 32768) return send({ error: 'Request too large' }, 413);
            body += chunk;
          }
          let query;
          try {
            query = validateQuery(JSON.parse(body));
          } catch (error) {
            return send({ error: error.message }, 400);
          }
          const candidates = evaluatePlaces(repo.places(), query).filter(
            (p) => p.match.status !== 'excluded'
          );
          const routes = await calculateRoutes(candidates, query);
          return send({ results: evaluatePlaces(repo.places(), query, routes), query });
        }
        if (req.method === 'GET' && url.pathname === '/api/geocode') {
          const q = (url.searchParams.get('q') || '').slice(0, 160);
          if (q.length < 3) return send({ features: [] });
          const endpoint = new URL('https://data.geopf.fr/geocodage/search');
          endpoint.searchParams.set('q', q);
          endpoint.searchParams.set('limit', '5');
          endpoint.searchParams.set('index', 'address');
          const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
          if (!response.ok)
            return send(
              { error: 'Address service unavailable; select an origin on the map.' },
              502
            );
          const data = await response.json();
          return send({
            features: (data.features || [])
              .filter(
                (f) =>
                  f.geometry?.type === 'Point' &&
                  f.geometry.coordinates[1] > 48.5 &&
                  f.geometry.coordinates[1] < 49.1 &&
                  f.geometry.coordinates[0] > 1.8 &&
                  f.geometry.coordinates[0] < 2.9
              )
              .map((f) => ({
                label: f.properties.label || f.properties.name,
                coordinates: f.geometry.coordinates,
              })),
          });
        }
        if (url.pathname === '/api/health') return send({ status: 'ok' });
        return send({ error: 'Not found' }, 404);
      }
      if (!['GET', 'HEAD'].includes(req.method)) return send({ error: 'Method not allowed' }, 405);
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return send({ error: 'Invalid path' }, 400);
      }
      if (pathname.split(/[\\/]/).some((segment) => segment.startsWith('.')))
        return send({ error: 'Not found' }, 404);
      const roots = pathname.startsWith('/vendor/leaflet/')
        ? ['node_modules/leaflet/dist', pathname.slice('/vendor/leaflet/'.length)]
        : pathname.startsWith('/shared/')
          ? ['shared', pathname.slice('/shared/'.length)]
          : ['web', pathname.slice(1)];
      const base = resolve(ROOT, roots[0]);
      let file = resolve(base, roots[1] || 'index.html');
      if (!file.startsWith(base + sep) && file !== base) return send({ error: 'Forbidden' }, 403);
      if (roots[0] === 'web' && !extname(pathname)) file = resolve(base, 'index.html');
      let info;
      try {
        info = await stat(file);
      } catch {
        return send({ error: 'Not found' }, 404);
      }
      if (!info.isFile()) return send({ error: 'Not found' }, 404);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      if (!res.headersSent) send({ error: 'Service unavailable; retry shortly.' }, 503);
      else res.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, 'server/app.mjs')) {
  const db = openDatabase();
  seedDatabase(db);
  const server = createApp(db);
  server.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () =>
    console.log(
      `Les Cafés de Paris · Local: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}/fr/`
    )
  );
  let timer,
    activeSync = null;
  if (process.env.PARIS_DATA_ENABLED === 'true') {
    const run = () => {
      if (activeSync) return;
      activeSync = syncEvents(db)
        .then((result) => console.log(`Paris Data: ${result.status}, ${result.imported} records.`))
        .finally(() => {
          activeSync = null;
        });
    };
    run();
    timer = setInterval(
      run,
      Math.max(30, Number(process.env.SYNC_INTERVAL_MINUTES) || 180) * 60000
    );
  }
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      clearInterval(timer);
      server.close(async () => {
        if (activeSync) await activeSync;
        db.close();
        process.exit();
      });
    });
}
