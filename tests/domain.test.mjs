import test from 'node:test';
import assert from 'node:assert/strict';
import { coversStay, matchPlace, evaluatePlaces, currentCrowding } from '../shared/match.mjs';
import { parseParisLocal, parisLocalInput } from '../shared/time.mjs';
const place = {
  id: 'test',
  name: 'Test',
  address: '',
  area: '',
  policies: { laptop: 'yes', power: 'limited', wifi: 'no' },
  hours: {
    1: [
      ['08:00', '12:00'],
      ['13:00', '20:00'],
    ],
    2: [['20:00', '02:00']],
    3: [],
  },
  maxGroup: 3,
};
test('unknown and restricted required policies cannot be called a match', () => {
  assert.equal(matchPlace(place, { requirements: { pets: 'must' } }).match.status, 'check');
  assert.equal(matchPlace(place, { requirements: { power: 'must' } }).match.status, 'check');
  assert.equal(matchPlace(place, { requirements: { wifi: 'must' } }).match.status, 'excluded');
  assert.equal(matchPlace(place, { requirements: { wifi: 'prefer' } }).match.status, 'match');
});
test('whole stay respects midday gaps, closing boundary and overnight hours', () => {
  assert.equal(coversStay(place, '2026-10-19T09:00:00Z', 60), 'yes'); // 11:00-12:00 Paris
  assert.equal(coversStay(place, '2026-10-19T09:00:00Z', 61), 'no');
  assert.equal(coversStay(place, '2026-10-19T09:59:30Z', 1), 'no');
  assert.equal(coversStay(place, '2026-10-20T22:30:00Z', 60), 'yes'); // Wednesday 00:30
  assert.equal(coversStay(place, '2026-10-20T23:30:00Z', 60), 'no');
});
test('exceptional closure overrides regular opening', () => {
  assert.equal(
    coversStay({ ...place, exceptions: { '2026-10-19': [] } }, '2026-10-19T09:00:00Z', 30),
    'no'
  );
});
test('stay uses arrival time and never invents an unknown route duration', () => {
  const query = {
    origin: { lat: 48.85, lng: 2.3 },
    departure: '2026-10-19T09:45:00Z',
    stayMinutes: 30,
    maxMinutes: 20,
  };
  const r = matchPlace(place, query, { status: 'ok', durationSeconds: 1200 });
  assert.equal(r.match.checks.find((c) => c.key === 'hours').state, 'no');
  assert.equal(matchPlace(place, query, { status: 'unconfigured' }).match.status, 'check');
  assert.equal(
    matchPlace(place, query, { status: 'ok', durationSeconds: 1201 }).match.status,
    'excluded'
  );
});
test('closure and group size are hard constraints; fictional data is opt-in', () => {
  assert.equal(
    matchPlace({ ...place, availability: { status: 'closed' } }, {}).match.status,
    'excluded'
  );
  assert.equal(matchPlace(place, { group: 4 }).match.status, 'excluded');
  assert.equal(evaluatePlaces([{ ...place, demo: true }], {}).length, 0);
  assert.equal(evaluatePlaces([{ ...place, demo: true }], { includeDemo: true }).length, 1);
});
test('Paris local input handles winter/summer and rejects DST missing hour', () => {
  assert.equal(parseParisLocal('2026-10-19T13:00'), '2026-10-19T11:00:00.000Z');
  assert.equal(parseParisLocal('2026-12-19T13:00'), '2026-12-19T12:00:00.000Z');
  assert.equal(parseParisLocal('2026-03-29T02:30'), null);
  assert.equal(parisLocalInput(new Date('2026-10-19T11:00:00Z')), '2026-10-19T13:00');
});
test('old or malformed observations never appear live', () => {
  const old = {
    status: 'current',
    observedAt: '2026-10-19T10:00:00Z',
    validUntil: '2026-10-19T10:10:00Z',
  };
  assert.equal(currentCrowding(old, Date.parse('2026-10-19T11:00:00Z')).status, 'expired');
  assert.equal(currentCrowding({ validUntil: 'tomorrow' }).status, 'unknown');
});
