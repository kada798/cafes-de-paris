import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, splitTranslationText, translateEvent } from '../shared/translation.mjs';
import { fetchIgnWalking, selectRoute } from '../shared/public-routing.mjs';
import { databaseTranslator } from '../server/services/translation.mjs';
import { openDatabase } from '../server/repositories/catalog.mjs';

test('IGN requests actual pedestrian paths, converts units and rejects car results', async () => {
  const start = { lng: 2.37, lat: 48.879 },
    end = { lng: 2.36, lat: 48.866 };
  let request;
  const payload = {
    profile: 'pedestrian',
    duration: 12,
    timeUnit: 'minute',
    distance: 0.9,
    distanceUnit: 'kilometer',
    geometry: {
      type: 'LineString',
      coordinates: [
        [2.37, 48.879],
        [2.36, 48.866],
      ],
    },
  };
  const route = await fetchIgnWalking(
    start,
    end,
    async (url) => {
      request = url;
      return Response.json(payload);
    },
    { cache: false }
  );
  assert.equal(request.hostname, 'data.geopf.fr');
  assert.equal(request.searchParams.get('profile'), 'pedestrian');
  assert.equal(request.searchParams.get('start'), '2.37,48.879');
  assert.equal(route.durationSeconds, 720);
  assert.equal(route.distance, 900);
  assert.equal(route.geometry.type, 'LineString');
  assert.equal(
    (
      await fetchIgnWalking(start, end, async () => Response.json({ ...payload, profile: 'car' }), {
        cache: false,
      })
    ).status,
    'unavailable'
  );
  assert.equal(selectRoute([route, { status: 'unconfigured' }], 20).status, 'ok');
  assert.equal(selectRoute([route, { status: 'unconfigured' }], 10).status, 'partial');
});

test('translation chunks respect UTF-8 limits and preserve complete source', () => {
  const text = 'Café partagé, 阅读☕. '.repeat(90);
  const chunks = splitTranslationText(text);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every((c) => new TextEncoder().encode(c).length <= 460));
});

test('translation caches and deduplicates requests, preserves originals and invalidates changed text', async () => {
  let calls = 0;
  const cache = new Map();
  const translator = createTranslator({
    cache,
    fetcher: async (url) => {
      calls++;
      return Response.json({
        responseStatus: 200,
        responseData: { translatedText: `译文:${url.searchParams.get('q')}` },
      });
    },
  });
  await Promise.all([translator.translate('Bonjour', 'zh'), translator.translate('Bonjour', 'zh')]);
  assert.equal(calls, 1);
  await translator.translate('Bonjour', 'zh');
  assert.equal(calls, 1);
  await translator.translate('Bonsoir', 'zh');
  assert.equal(calls, 2);
  const event = {
    title: { fr: 'Bonjour' },
    description: { fr: 'Lecture' },
    dateDescription: 'Dimanche',
    price: 'gratuit',
  };
  const translated = await translateEvent(event, 'zh', translator, { full: true });
  assert.equal(event.title.zh, undefined);
  assert.equal(translated.description.fr, 'Lecture');
  assert.equal(translated.translationStatus.zh.full, true);
  assert.equal(translated.detailsTranslations.zh.dateDescription, '译文:Dimanche');
});

test('quota failures are never cached as translated text and further requests back off', async () => {
  const cache = new Map();
  let calls = 0;
  const translator = createTranslator({
    cache,
    fetcher: async () => {
      calls++;
      return Response.json({
        quotaFinished: true,
        responseStatus: 200,
        responseData: { translatedText: 'LIMIT REACHED' },
      });
    },
  });
  const event = await translateEvent({ title: { fr: 'Bonjour' } }, 'en', translator);
  assert.equal(event.title.en, undefined);
  assert.equal(event.translationStatus.en.code, 'quota');
  assert.equal(cache.size, 0);
  await assert.rejects(translator.translate('Autre', 'en'), { code: 'quota' });
  assert.equal(calls, 1);
});

test('SQLite translation cache survives a new translator instance', async () => {
  const db = openDatabase(':memory:');
  try {
    const first = databaseTranslator(db, async () =>
      Response.json({ responseStatus: 200, responseData: { translatedText: 'Hello' } })
    );
    assert.equal((await first.translate('Bonjour', 'en')).text, 'Hello');
    const second = databaseTranslator(db, async () => {
      throw new Error('Must use cache');
    });
    assert.equal((await second.translate('Bonjour', 'en')).text, 'Hello');
  } finally {
    db.close();
  }
});
