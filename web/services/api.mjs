import { evaluatePlaces, currentCrowding } from '/shared/match.mjs';
import { upcomingEvent } from '/shared/events.mjs';
import { calculatePublicRoutes } from '/shared/public-routing.mjs';
import { createTranslator, translateEvent } from '/shared/translation.mjs';
export const snapshotMode = Boolean(
  document.querySelector('meta[name="app-mode"][content="snapshot"]')
);
let snapshot;
const memory = new Map();
const browserTranslator = createTranslator({
  cache: {
    get(key) {
      try {
        return JSON.parse(localStorage.getItem(`cafes-translation:${key}`)) || memory.get(key);
      } catch {
        return memory.get(key);
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        localStorage.setItem(`cafes-translation:${key}`, JSON.stringify(value));
      } catch {
        /* Storage is optional. */
      }
    },
  },
});
export async function translateEvents(ids, language, { full = false } = {}) {
  if (snapshotMode) {
    const events = [];
    for (const event of snapshot.events.filter((e) => ids.includes(e.id)).slice(0, full ? 1 : 12)) {
      const translated = await translateEvent(event, language, browserTranslator, { full });
      events.push(translated);
      if (translated.translationStatus?.[language]?.code === 'quota') break;
    }
    return { events };
  }
  const response = await fetch('/api/translate-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, language, full }),
  });
  if (!response.ok) throw new Error('Translation unavailable');
  return response.json();
}
export async function getCatalog() {
  const response = await fetch(snapshotMode ? '/api/catalog.json' : '/api/catalog');
  if (!response.ok) throw new Error('Catalogue unavailable');
  const data = await response.json();
  if (snapshotMode) {
    data.events = data.events
      .map((e) => upcomingEvent(e))
      .filter(Boolean)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    data.places = data.places.map((p) => ({ ...p, crowding: currentCrowding(p.crowding) }));
    snapshot = data;
  }
  return data;
}
export async function searchPlaces(query) {
  if (snapshotMode) {
    const candidates = evaluatePlaces(snapshot.places, query).filter(
      (p) => p.match.status !== 'excluded'
    );
    const routes = await calculatePublicRoutes(candidates, query);
    return { results: evaluatePlaces(snapshot.places, query, routes), query };
  }
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error('Search unavailable');
  return response.json();
}
export async function geocode(query) {
  if (!snapshotMode) {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Address service unavailable');
    return response.json();
  }
  const endpoint = new URL('https://data.geopf.fr/geocodage/search');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('limit', '5');
  endpoint.searchParams.set('index', 'address');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Address service unavailable');
  const data = await response.json();
  return {
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
  };
}
