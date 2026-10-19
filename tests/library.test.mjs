import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/repositories/catalog.mjs';
import { engagementEndpoint, sqliteBinding } from '../server/services/engagement.mjs';
import { googleDirections } from '../shared/navigation.mjs';
import { parisWeek, selectWeekly, editorialScore } from '../shared/library.mjs';
import { readFileSync } from 'node:fs';
const reading = JSON.parse(
  readFileSync(new URL('../content/reading-sources.json', import.meta.url))
).sources;
test('weekly selection follows Paris week, source freshness and publisher diversity', () => {
  assert.deepEqual(parisWeek(new Date('2026-10-18T23:00:00Z')), {
    start: '2026-10-19',
    end: '2026-10-25',
  });
  const selected = selectWeekly(reading, {}, new Date('2026-10-19T12:00:00Z'));
  assert.equal(selected.sources.length, 4);
  assert.ok(selected.sources.every((s) => s.kind !== 'directory' && editorialScore(s) >= 75));
  for (const s of selected.sources)
    assert.ok(selected.sources.filter((x) => x.publisher === s.publisher).length <= 2);
  assert.equal(selectWeekly(reading, {}, new Date('2027-05-01T12:00:00Z')).sources.length, 0);
});
test('Google navigation preserves origin and transit mode but does not invent a departure parameter', () => {
  const url = new URL(
    googleDirections(
      { lat: 48.85, lng: 2.33 },
      { origin: { lat: 48.86, lng: 2.34 }, mode: 'transit', departure: '2026-10-19T12:00:00Z' }
    )
  );
  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('travelmode'), 'transit');
  assert.equal(url.searchParams.get('origin'), '48.86,2.34');
  assert.equal(url.searchParams.get('departure_time'), null);
});
test('shared engagement deduplicates views/clicks, toggles one vote, and excludes stale activity', async () => {
  const db = openDatabase(':memory:');
  const binding = sqliteBinding(db);
  const id = 's';
  const now = new Date('2026-10-19T12:00:00Z');
  const visitor = '11111111-1111-4111-8111-111111111111';
  const post = async (kind, active, date = now) =>
    engagementEndpoint(
      new Request('https://site.test/api/library', {
        method: 'POST',
        headers: { origin: 'https://site.test' },
        body: JSON.stringify({ id, kind, active, visitor }),
      }),
      binding,
      [id],
      { now: date }
    );
  try {
    await post('view');
    await post('view');
    await post('click');
    await post('click');
    await post('like', true);
    await post('like', true);
    let result = await (
      await engagementEndpoint(new Request('https://site.test/api/library'), binding, [id], { now })
    ).json();
    assert.equal(result.metrics.s.views, 1);
    assert.equal(result.metrics.s.clicks, 1);
    assert.equal(result.metrics.s.likes, 1);
    assert.equal(result.metrics.s.active7d, 2);
    await post('like', false);
    result = await (await post('view', undefined, new Date('2026-10-30T12:00:00Z'))).json();
    assert.equal(result.metrics.s.likes, 0);
    assert.equal(result.metrics.s.views, 2);
    assert.equal(result.metrics.s.active7d, 1);
    const actor = db.prepare('SELECT actor FROM engagement_events LIMIT 1').get().actor;
    assert.notEqual(actor, visitor);
    const forged = await engagementEndpoint(
      new Request('https://site.test/api/library', {
        method: 'POST',
        headers: { origin: 'https://evil.test' },
        body: '{}',
      }),
      binding,
      [id]
    );
    assert.equal(forged.status, 403);
  } finally {
    db.close();
  }
});
test('sources and categories have evidence; new venues keep unsupported conditions unknown', () => {
  assert.equal(reading.length, 15);
  assert.equal(new Set(reading.map((s) => s.url)).size, reading.length);
  for (const s of reading) {
    assert.match(s.url, /^https:\/\//);
    for (const lang of ['fr', 'en', 'zh'])
      assert.ok(s.title[lang] && s.summary[lang] && s.editorial.reason[lang]);
  }
  const { places } = JSON.parse(readFileSync(new URL('../seeds/catalog.json', import.meta.url)));
  const { places: added } = JSON.parse(
    readFileSync(new URL('../content/venue-expansion.json', import.meta.url))
  );
  assert.equal(added.length, 20);
  for (const p of added) {
    const found = places.find((x) => x.id === p.id);
    assert.ok(found?.classificationEvidence?.url);
    assert.ok(Number.isFinite(found?.lat));
    assert.ok(Object.values(found.policies).every((x) => x === 'unknown'));
  }
});
