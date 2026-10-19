import { parseParisLocal } from '../../shared/time.mjs';
function parisLocal(iso) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(/[-: ]/g, '').replace(/^(\d{8})/, '$1T');
}
export async function fetchRoute(origin, place, mode, departure, fetcher = fetch) {
  try {
    if (mode === 'walking') {
      if (!process.env.ORS_API_KEY) return { status: 'unconfigured', provider: 'openrouteservice' };
      const response = await fetcher('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
        method: 'POST', headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [place.lng, place.lat]], instructions: false }), signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return { status: 'unavailable', provider: 'openrouteservice' };
      const data = await response.json(), route = data.features?.[0];
      if (!route) return { status: 'no_route' };
      const duration = route.properties?.summary?.duration;
      if (!Number.isFinite(duration) || duration < 0) return { status: 'unavailable', provider: 'openrouteservice' };
      return { status: 'ok', mode, provider: 'openrouteservice', durationSeconds: duration, distance: route.properties.summary.distance, geometry: route.geometry, calculatedAt: new Date().toISOString() };
    }
    if (!process.env.PRIM_API_KEY) return { status: 'unconfigured', provider: 'IDFM PRIM' };
    const url = new URL('https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys');
    for (const [key, value] of Object.entries({ from: `${origin.lng};${origin.lat}`, to: `${place.lng};${place.lat}`, datetime: parisLocal(departure), datetime_represents: 'departure', count: '1' })) url.searchParams.set(key, value);
    const response = await fetcher(url, { headers: { apikey: process.env.PRIM_API_KEY }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { status: 'unavailable', provider: 'IDFM PRIM' };
    const data = await response.json();
    const route = data.journeys?.filter(r => r.sections?.some(s => s.type === 'public_transport')).sort((a, b) => a.duration - b.duration)[0];
    if (!route) return { status: 'no_route', provider: 'IDFM PRIM' };
    // Include waiting before the journey starts, not only in-vehicle duration.
    const arrival = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(route.arrival_date_time || '');
    const arrivalISO = arrival && parseParisLocal(`${arrival[1]}-${arrival[2]}-${arrival[3]}T${arrival[4]}:${arrival[5]}`);
    const total = arrivalISO ? (Date.parse(arrivalISO) + Number(arrival[6]) * 1000 - Date.parse(departure)) / 1000 : null;
    const duration = total != null && total >= route.duration ? total : route.duration;
    if (!Number.isFinite(duration) || duration < 0) return { status: 'unavailable', provider: 'IDFM PRIM' };
    return { status: 'ok', mode: 'transit', provider: 'IDFM PRIM', durationSeconds: duration, calculatedAt: new Date().toISOString() };
  } catch { return { status: 'unavailable' }; }
}

export async function calculateRoutes(places, query, fetcher = fetch) {
  if (!query.origin) return {};
  const results = {};
  // Sequential requests bound third-party load. Only explicitly requested origin
  // is sent; no origin is persisted in the database or application logs.
  for (const place of places.slice(0, 20)) {
    const modes = query.mode === 'either' ? ['walking', 'transit'] : [query.mode || 'walking'];
    const routes = await Promise.all(modes.map(mode => fetchRoute(query.origin, place, mode, query.departure || new Date().toISOString(), fetcher)));
    const valid = routes.filter(r => r.status === 'ok').sort((a, b) => a.durationSeconds - b.durationSeconds);
    const unresolved = routes.some(r => !['ok', 'no_route'].includes(r.status));
    results[place.id] = valid[0] && (!unresolved || valid[0].durationSeconds <= (query.maxMinutes || 20) * 60)
      ? valid[0] : valid[0] ? { status: 'partial', knownAlternative: valid[0] }
        : routes.every(r => r.status === 'no_route') ? { status: 'no_route' } : routes.find(r => r.status !== 'no_route');
  }
  return results;
}
