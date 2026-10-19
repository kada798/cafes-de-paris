import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRoute, calculateRoutes } from '../server/routing/providers.mjs';
import { upcomingEvent } from '../shared/events.mjs';
import { normalizeEvent } from '../server/ingestion/sources/paris-data.mjs';
import { linkEvent } from '../server/ingestion/match.mjs';
import { readFileSync } from 'node:fs';
test('routing keeps missing keys unknown and rejects malformed provider durations', async (t) => {
  const old = process.env.ORS_API_KEY;
  delete process.env.ORS_API_KEY;
  t.after(() => (old == null ? delete process.env.ORS_API_KEY : (process.env.ORS_API_KEY = old)));
  assert.equal((await fetchRoute({}, {}, 'walking', '')).status, 'unconfigured');
  process.env.ORS_API_KEY = 'test';
  const result = await fetchRoute(
    { lat: 48.85, lng: 2.3 },
    { lat: 48.86, lng: 2.31 },
    'walking',
    '',
    async () => new Response(JSON.stringify({ features: [{ properties: {} }] }))
  );
  assert.equal(result.status, 'unavailable');
});
test('either mode remains unresolved if only an over-limit route is known', async (t) => {
  const oldORS = process.env.ORS_API_KEY,
    oldPRIM = process.env.PRIM_API_KEY;
  process.env.ORS_API_KEY = 'test';
  delete process.env.PRIM_API_KEY;
  t.after(() => {
    oldORS == null ? delete process.env.ORS_API_KEY : (process.env.ORS_API_KEY = oldORS);
    oldPRIM == null ? delete process.env.PRIM_API_KEY : (process.env.PRIM_API_KEY = oldPRIM);
  });
  const routes = await calculateRoutes(
    [{ id: 'p', lat: 48.85, lng: 2.3 }],
    { origin: { lat: 48.86, lng: 2.3 }, mode: 'either', maxMinutes: 20 },
    async () =>
      new Response(JSON.stringify({ features: [{ properties: { summary: { duration: 1500 } } }] }))
  );
  assert.equal(routes.p.status, 'partial');
});
test('public transport includes time between requested departure and actual arrival', async (t) => {
  const old = process.env.PRIM_API_KEY;
  process.env.PRIM_API_KEY = 'test';
  t.after(() => (old == null ? delete process.env.PRIM_API_KEY : (process.env.PRIM_API_KEY = old)));
  const route = await fetchRoute(
    { lat: 48.85, lng: 2.3 },
    { lat: 48.86, lng: 2.31 },
    'transit',
    '2026-10-19T10:00:00Z',
    async () =>
      new Response(
        JSON.stringify({
          journeys: [
            {
              duration: 600,
              arrival_date_time: '20261019T122000',
              sections: [{ type: 'public_transport' }],
            },
          ],
        })
      )
  );
  assert.equal(route.durationSeconds, 1200);
});
test('recurring activities select the next known session, not series start', () => {
  const event = normalizeEvent({
    id: 1,
    title: 'Reading',
    date_start: '2026-01-01T10:00:00Z',
    date_end: '2026-12-31T10:00:00Z',
    occurrences:
      '2026-09-01T10:00:00Z_2026-09-01T11:00:00Z;2026-11-01T10:00:00Z_2026-11-01T11:00:00Z',
  });
  assert.equal(
    upcomingEvent(event, Date.parse('2026-10-19T10:00:00Z')).start,
    '2026-11-01T10:00:00Z'
  );
  assert.equal(upcomingEvent(event, Date.parse('2026-12-01T10:00:00Z')), null);
  assert.equal(
    upcomingEvent({ ...event, status: 'cancelled' }, Date.parse('2026-10-19T10:00:00Z')),
    null
  );
});
test('nearby events are never described as hosted by a venue', () => {
  const p = { id: 'p', name: 'Cafe', address: '1 Rue A', lat: 48.85, lng: 2.3 };
  const linked = linkEvent({ venue: 'Other venue', address: '2 Rue A', lat: 48.8501, lng: 2.3 }, [
    p,
  ]);
  assert.equal(linked.placeId, null);
  assert.deepEqual(linked.nearbyPlaceIds, ['p']);
  assert.equal(
    linkEvent({ venue: 'Cafe', address: '1 Rue A', lat: 48.85, lng: 2.3 }, [p]).relationship,
    'at_venue'
  );
});
test('real venue facts have evidence, IDs and translations are complete', () => {
  const { places } = JSON.parse(
    readFileSync(new URL('../seeds/catalog.json', import.meta.url), 'utf8')
  );
  const { articles } = JSON.parse(
    readFileSync(new URL('../content/articles.json', import.meta.url), 'utf8')
  );
  const ids = new Set(places.map((p) => p.id));
  assert.equal(ids.size, places.length);
  for (const p of places) {
    for (const lang of ['fr', 'en', 'zh']) assert.ok(p.description[lang]);
    if (!p.demo)
      for (const [key, value] of Object.entries(p.policies))
        if (value !== 'unknown') assert.ok(p.evidence?.[key]?.url, `${p.id}: ${key}`);
  }
  for (const a of articles) {
    for (const id of a.placeIds) assert.ok(ids.has(id));
    for (const lang of ['fr', 'en', 'zh']) assert.ok(a.body[lang].length);
  }
});
