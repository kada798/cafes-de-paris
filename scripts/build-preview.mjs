import { cp, mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase, catalogRepository, ROOT } from '../server/repositories/catalog.mjs';
import { upcomingEvent } from '../shared/events.mjs';
import { databaseTranslator } from '../server/services/translation.mjs';
import { translateEvent } from '../shared/translation.mjs';
const destination = resolve(ROOT, 'dist');
// Delete only this project's generated directory, and never follow a symlink.
if (destination !== resolve(ROOT, 'dist')) throw new Error('Unexpected output directory');
try {
  if ((await lstat(destination)).isSymbolicLink()) throw new Error('dist must not be a symlink');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(destination, { recursive: true, force: true });
await cp(resolve(ROOT, 'web'), destination, { recursive: true });
await cp(resolve(ROOT, 'shared'), resolve(destination, 'shared'), { recursive: true });
await cp(resolve(ROOT, 'node_modules/leaflet/dist'), resolve(destination, 'vendor/leaflet'), {
  recursive: true,
});
const db = openDatabase();
let events, syncRuns;
try {
  const repo = catalogRepository(db);
  events = repo
    .events()
    .map((e) => upcomingEvent(e))
    .filter(Boolean);
  syncRuns = repo.syncRuns().map(({ source, started_at, finished_at, status, imported }) => ({
    source,
    started_at,
    finished_at,
    status,
    imported,
  }));
  // Export only public cached translations. Builds never consume API quota.
  const cachedTranslator = databaseTranslator(db, async () => {
    throw new Error('Cache only');
  });
  for (const event of events)
    for (const lang of ['en', 'zh']) {
      const translated = await translateEvent(event, lang, cachedTranslator, { full: true });
      if (translated.translationStatus?.[lang]?.status === 'ready') {
        event.title[lang] = translated.title[lang];
        event.description[lang] = translated.description[lang];
        event.detailsTranslations = {
          ...event.detailsTranslations,
          [lang]: translated.detailsTranslations[lang],
        };
        event.translationStatus = {
          ...event.translationStatus,
          [lang]: translated.translationStatus[lang],
        };
      } else if (translated.title[lang]) {
        event.title[lang] = translated.title[lang];
        event.translationStatus = {
          ...event.translationStatus,
          [lang]: {
            status: 'ready',
            full: false,
            provider: translated.translationStatus[lang].provider || 'mymemory',
            machine: true,
          },
        };
      }
    }
} finally {
  db.close();
}
// Export public seed content, never private local overrides or configuration.
const { places } = JSON.parse(await readFile(resolve(ROOT, 'seeds/catalog.json'), 'utf8'));
const { articles } = JSON.parse(await readFile(resolve(ROOT, 'content/articles.json'), 'utf8'));
const catalog = {
  places,
  articles,
  events,
  syncRuns,
  capabilities: {
    walking: true,
    walkingProvider: 'IGN Géoplateforme',
    transit: false,
    translation: true,
    timezone: 'Europe/Paris',
  },
  snapshotAt: new Date().toISOString(),
};
await mkdir(resolve(destination, 'api'), { recursive: true });
await writeFile(resolve(destination, 'api/catalog.json'), JSON.stringify(catalog));
const original = await readFile(resolve(destination, 'index.html'), 'utf8');
const html = original.replace('<head>', '<head>\n<meta name="app-mode" content="snapshot">');
await writeFile(resolve(destination, 'index.html'), html);
await writeFile(resolve(destination, '404.html'), html);
for (const lang of ['fr', 'en', 'zh']) {
  const routes = [
    '',
    'map',
    'culture',
    'types',
    'gallery',
    'about',
    'events',
    ...places.map((p) => `places/${p.id}`),
    ...articles.map((a) => `articles/${a.id}`),
    ...events.map((e) => `events/${e.id}`),
  ];
  for (const route of routes) {
    const dir = resolve(destination, lang, route);
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, 'index.html'),
      html.replace('<html lang="fr">', `<html lang="${lang === 'zh' ? 'zh-Hans' : lang}">`)
    );
  }
}
console.log(
  `Static preview built: ${places.length} places, ${articles.length} articles, ${events.length} events. No secrets or local overrides exported.`
);
