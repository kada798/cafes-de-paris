import { parisWeek } from '../../shared/library.mjs';
const response = (data, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function sqliteBinding(db) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              return db.prepare(sql).run(...values);
            },
            async all() {
              return { results: db.prepare(sql).all(...values) };
            },
          };
        },
        async all() {
          return { results: db.prepare(sql).all() };
        },
      };
    },
  };
}
async function actorKey(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`cafes-library-v1:${value}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function readEngagement(db, ids, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400000).toISOString();
  const events = await db
    .prepare(
      `SELECT source_id,
    SUM(CASE WHEN kind='view' THEN 1 ELSE 0 END) AS views,
    SUM(CASE WHEN kind='click' THEN 1 ELSE 0 END) AS clicks,
    SUM(CASE WHEN recorded_at >= ? THEN 1 ELSE 0 END) AS active7d,
    MAX(recorded_at) AS lastActivity FROM engagement_events GROUP BY source_id`
    )
    .bind(since)
    .all();
  const likes = await db
    .prepare(
      'SELECT source_id, COUNT(*) AS likes FROM engagement_likes WHERE active=1 GROUP BY source_id'
    )
    .all();
  const result = Object.fromEntries(
    ids.map((id) => [id, { views: 0, clicks: 0, likes: 0, active7d: 0, lastActivity: null }])
  );
  for (const row of events.results || [])
    if (result[row.source_id]) Object.assign(result[row.source_id], row);
  for (const row of likes.results || [])
    if (result[row.source_id]) result[row.source_id].likes = row.likes;
  return result;
}
export async function engagementEndpoint(
  request,
  db,
  ids,
  { trustedIdentity = false, now = new Date() } = {}
) {
  if (!db) return response({ error: 'Statistics unavailable' }, 503);
  if (request.method === 'GET')
    return response({
      metrics: await readEngagement(db, ids, now),
      scope: 'site',
      week: parisWeek(now),
    });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return response({ error: 'Origin mismatch' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 4096)
    return response({ error: 'Request too large' }, 413);
  let input;
  try {
    const text = await request.text();
    if (text.length > 4096) return response({ error: 'Request too large' }, 413);
    input = JSON.parse(text);
  } catch {
    return response({ error: 'Invalid request' }, 400);
  }
  if (
    !ids.includes(input?.id) ||
    !['view', 'click', 'like'].includes(input?.kind) ||
    (input.kind === 'like' && typeof input.active !== 'boolean')
  )
    return response({ error: 'Invalid event' }, 400);
  const identity = trustedIdentity && request.headers.get('oai-authenticated-user-id');
  if (!identity && !/^[a-f\d-]{36}$/i.test(input.visitor || ''))
    return response({ error: 'Visitor identifier required' }, 400);
  const actor = await actorKey(identity ? `account:${identity}` : `browser:${input.visitor}`);
  const timestamp = now.toISOString();
  const bucket = Math.floor(now.getTime() / ((input.kind === 'view' ? 30 : 5) * 60000));
  const limit = await db
    .prepare('SELECT COUNT(*) AS n FROM engagement_events WHERE actor=? AND recorded_at>=?')
    .bind(actor, new Date(now.getTime() - 60000).toISOString())
    .all();
  if (Number(limit.results?.[0]?.n) > 40) return response({ error: 'Too many events' }, 429);
  if (input.kind === 'like') {
    await db
      .prepare(
        'INSERT INTO engagement_likes (source_id,actor,active,updated_at) VALUES (?,?,?,?) ON CONFLICT(source_id,actor) DO UPDATE SET active=excluded.active,updated_at=excluded.updated_at'
      )
      .bind(input.id, actor, input.active ? 1 : 0, timestamp)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO engagement_events (event_key,source_id,actor,kind,recorded_at) VALUES (?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING'
      )
      .bind(`${input.id}:${actor}:${input.kind}:${bucket}`, input.id, actor, input.kind, timestamp)
      .run();
  }
  return response({ metrics: await readEngagement(db, [input.id], now), scope: 'site' });
}
