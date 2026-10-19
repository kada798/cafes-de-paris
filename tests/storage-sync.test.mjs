import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDatabase, catalogRepository } from '../server/repositories/catalog.mjs';
import { syncEvents } from '../server/ingestion/sync.mjs';
import { createApp, validateQuery } from '../server/app.mjs';
import { normalizeEvent } from '../server/ingestion/sources/paris-data.mjs';
test('seeding is repeatable and preserves hand-edited overrides', () => {
  const db = openDatabase(':memory:'); seedDatabase(db);
  const repo = catalogRepository(db), first = repo.places()[0];
  repo.override(first.id, { policies: { laptop: 'yes' }, notes: { fr: 'Edited locally' } });
  seedDatabase(db);
  assert.equal(repo.places().find(p => p.id === first.id).policies.laptop, 'yes');
  assert.equal(repo.places().find(p => p.id === first.id).notes.fr, 'Edited locally');
  const ids = repo.places().map(p => p.id); assert.equal(new Set(ids).size, ids.length); db.close();
});
test('event sync is idempotent and failures preserve previous data', async () => {
  const db = openDatabase(':memory:');
  const record = { id: 1, title: 'Lecture', date_start: '2027-01-01T10:00:00Z', date_end: '2027-01-01T12:00:00Z', url: 'https://www.paris.fr/events/test' };
  const fetcher = async () => new Response(JSON.stringify({ results: [record] }));
  assert.equal((await syncEvents(db, fetcher)).imported, 1);
  await syncEvents(db, fetcher);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(catalogRepository(db).events()[0].id, 'paris-1');
  assert.equal((await syncEvents(db, async () => { throw new Error('Source offline'); })).status, 'failed');
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(catalogRepository(db).syncRuns()[0].status, 'failed'); db.close();
});
test('unmatched event is not silently assigned to a catalogue venue', () => {
  assert.equal(normalizeEvent({}), null);
  const e = normalizeEvent({ id: 1, title: 'Test', date_start: '2027-01-01T10:00:00Z', date_end: '2027-01-01T11:00:00Z' });
  assert.equal(e.placeId, null); assert.equal(e.relationship, 'unmatched');
});
test('query validation rejects invalid origins and ambiguous timezones', () => {
  assert.throws(() => validateQuery({ origin: { lat: 1, lng: 1 } }));
  assert.throws(() => validateQuery({ departure: '2026-10-19T13:00' }));
  assert.equal(validateQuery({}).maxMinutes, 20);
  assert.deepEqual(validateQuery({ requirements: { bogus: 'must', power: 'must' } }).requirements, { power: 'must' });
});
test('HTTP pages, search validation, secret files and HTML routes', async t => {
  const db = openDatabase(':memory:'); seedDatabase(db);
  const server = createApp(db); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(`${base}/zh/map`); assert.equal(page.status, 200); assert.match(await page.text(), /id="app"/);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/api/catalog`)).status, 200);
  const bad = await fetch(`${base}/api/search`, { method: 'POST', body: '{bad' }); assert.equal(bad.status, 400);
  const result = await fetch(`${base}/api/search`, { method: 'POST', body: JSON.stringify({ requirements: { laptop: 'must' } }) }).then(r => r.json());
  assert.ok(result.results.every(p => !p.demo));
  assert.ok(result.results.filter(p => p.policies.laptop === 'unknown' && p.availability?.status !== 'closed').every(p => p.match.status === 'check'));
});
