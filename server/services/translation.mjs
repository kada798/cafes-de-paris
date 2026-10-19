import { createTranslator, translateEvent } from '../../shared/translation.mjs';
export function databaseTranslator(db, fetcher = fetch) {
  return createTranslator({
    fetcher,
    config:
      process.env.TRANSLATION_PROVIDER === 'libretranslate' && process.env.LIBRETRANSLATE_URL
        ? {
            provider: 'libretranslate',
            url: process.env.LIBRETRANSLATE_URL,
            key: process.env.LIBRETRANSLATE_API_KEY,
          }
        : { provider: 'mymemory' },
    cache: {
      get(key) {
        const row = db.prepare('SELECT payload FROM translation_cache WHERE cache_key=?').get(key);
        return row ? JSON.parse(row.payload) : null;
      },
      set(key, value) {
        db.prepare(
          'INSERT INTO translation_cache VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at'
        ).run(key, JSON.stringify(value), new Date().toISOString());
      },
    },
  });
}
export async function translateRequestedEvents(events, ids, language, translator, full = false) {
  const selected = events.filter((e) => ids.includes(e.id)).slice(0, full ? 1 : 12);
  const translated = [];
  for (const event of selected) {
    const next = await translateEvent(event, language, translator, { full });
    translated.push(next);
    if (next.translationStatus?.[language]?.code === 'quota') break;
  }
  return translated;
}
