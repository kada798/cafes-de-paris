import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const path = resolve(root, 'seeds/catalog.json');
const catalog = JSON.parse(await readFile(path, 'utf8'));
const expansion = JSON.parse(await readFile(resolve(root, 'content/venue-expansion.json'), 'utf8'));
let imported = 0;
for (const source of expansion.places) {
  if (catalog.places.some((p) => p.id === source.id)) continue;
  const url = new URL('https://data.geopf.fr/geocodage/search');
  url.searchParams.set('q', source.address);
  url.searchParams.set('limit', '1');
  url.searchParams.set('index', 'address');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Geocoding failed: ${source.id}`);
  const f = (await response.json()).features?.[0];
  const [lng, lat] = f?.geometry?.coordinates || [];
  const postcode = source.address.match(/\b750\d\d\b/)?.[0];
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 48.8 ||
    lat > 48.92 ||
    lng < 2.22 ||
    lng > 2.43 ||
    f.properties?.score < 0.65 ||
    (postcode && f.properties?.postcode !== postcode)
  ) {
    console.log(`Needs address review: ${source.id}`);
    continue;
  }
  catalog.places.push({
    id: source.id,
    name: source.name,
    kind: 'cafe',
    type: source.type,
    categoryTags: [source.type],
    lat,
    lng,
    address: source.address,
    area: source.area,
    description: source.description,
    website: source.website,
    verifiedAt: expansion.verifiedAt,
    classificationEvidence: source.classificationEvidence,
    sources: [
      { url: source.sourceUrl, label: source.sourceLabel },
      { url: source.classificationEvidence.url, label: source.classificationEvidence.label },
      { url: url.href, label: 'IGN · Géocodage de l’adresse officielle' },
    ],
    hours: null,
    policies: Object.fromEntries(
      [
        'laptop',
        'power',
        'wifi',
        'pets',
        'decaf',
        'caffeineFree',
        'reservation',
        'quiet',
        'conversation',
        'terrace',
      ].map((k) => [k, 'unknown'])
    ),
    notes: {
      fr: 'Adresse vérifiée sur le site officiel. Horaires et règles d’accueil restent à confirmer.',
      en: 'Address verified on the official website. Opening hours and visitor policies still need confirmation.',
      zh: '地址来自官方网站；营业时间及接待条件仍待核实。',
    },
    image: '/assets/photos/photo-1554118811-1e0d58224f24.jpg',
    imageCaption: {
      fr: 'Photo d’ambiance illustrative',
      en: 'Illustrative atmosphere photograph',
      zh: '氛围示意图',
    },
  });
  imported++;
  await new Promise((r) => setTimeout(r, 250));
}
await writeFile(path, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Imported ${imported} official-source cafés.`);
