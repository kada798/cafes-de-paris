const routeCache = new Map();
let lastStarted = 0;
let queue = Promise.resolve();
async function throttle() {
  const slot = queue.then(async () => {
    const wait = Math.max(0, lastStarted + 250 - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStarted = Date.now();
  });
  queue = slot.catch(() => {});
  await slot;
}

export async function fetchIgnWalking(origin, place, fetcher = fetch, options = {}) {
  const coordinates = [origin?.lng, origin?.lat, place?.lng, place?.lat];
  if (!coordinates.every(Number.isFinite)) return { status: 'unavailable', provider: 'IGN' };
  const key = coordinates.map((n) => n.toFixed(6)).join(',');
  const cached = routeCache.get(key);
  if (options.cache !== false && cached?.until > Date.now()) return cached.route;
  await throttle();
  const url = new URL('https://data.geopf.fr/navigation/itineraire');
  for (const [name, value] of Object.entries({
    resource: 'bdtopo-osrm',
    start: `${origin.lng},${origin.lat}`,
    end: `${place.lng},${place.lat}`,
    profile: 'pedestrian',
    optimization: 'fastest',
    geometryFormat: 'geojson',
    getSteps: 'false',
    getBbox: 'true',
    distanceUnit: 'meter',
    timeUnit: 'second',
  }))
    url.searchParams.set(name, value);
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { status: 'unavailable', provider: 'IGN' };
    const data = await response.json();
    const unit = { second: 1, minute: 60, hour: 3600 }[data.timeUnit];
    const seconds = data.duration * unit;
    if (
      data.profile !== 'pedestrian' ||
      !unit ||
      !Number.isFinite(data.duration) ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      !Number.isFinite(data.distance) ||
      data.distance < 0 ||
      data.geometry?.type !== 'LineString' ||
      !Array.isArray(data.geometry.coordinates) ||
      data.geometry.coordinates.length < 2 ||
      !data.geometry.coordinates.every(
        (p) => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite)
      )
    ) {
      return { status: 'unavailable', provider: 'IGN' };
    }
    const route = {
      status: 'ok',
      mode: 'walking',
      provider: 'IGN Géoplateforme',
      durationSeconds: seconds,
      distance: data.distanceUnit === 'kilometer' ? data.distance * 1000 : data.distance,
      geometry: data.geometry,
      calculatedAt: new Date().toISOString(),
      estimated: true,
    };
    if (options.cache !== false) routeCache.set(key, { route, until: Date.now() + 15 * 60000 });
    if (routeCache.size > 200) routeCache.delete(routeCache.keys().next().value);
    return route;
  } catch {
    return { status: 'unavailable', provider: 'IGN' };
  }
}

export function selectRoute(routes, maxMinutes = 20) {
  const valid = routes
    .filter((r) => r.status === 'ok')
    .sort((a, b) => a.durationSeconds - b.durationSeconds);
  const unresolved = routes.some((r) => !['ok', 'no_route'].includes(r.status));
  if (valid[0] && (!unresolved || valid[0].durationSeconds <= maxMinutes * 60))
    return { ...valid[0], options: routes };
  if (valid[0]) return { status: 'partial', knownAlternative: valid[0], options: routes };
  return routes.every((r) => r.status === 'no_route')
    ? { status: 'no_route', options: routes }
    : { ...routes.find((r) => r.status !== 'no_route'), options: routes };
}

export async function calculatePublicRoutes(places, query, fetcher = fetch) {
  if (!query.origin) return {};
  const results = {};
  for (const place of places.slice(0, 20)) {
    const routes = [];
    if (query.mode !== 'transit') routes.push(await fetchIgnWalking(query.origin, place, fetcher));
    if (query.mode !== 'walking')
      routes.push({ status: 'unconfigured', mode: 'transit', provider: 'IDFM PRIM' });
    results[place.id] = selectRoute(routes, query.maxMinutes || 20);
  }
  return results;
}
