import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const files = ['seeds/catalog.json', 'content/articles.json'];
const directory = resolve('web/assets/photos');
await mkdir(directory, { recursive: true });
const fetched = new Set();
async function cache(original) {
  const url = new URL(original);
  if (url.hostname !== 'images.unsplash.com' || !/^\/photo-[\w-]+$/.test(url.pathname)) throw new Error('Only selected Unsplash assets are accepted');
  const name = `${url.pathname.slice(1)}.jpg`;
  if (!fetched.has(name)) {
    url.search = 'auto=format&fit=crop&w=1200&q=82';
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Asset download failed: ${name}`);
    await writeFile(resolve(directory, name), new Uint8Array(await response.arrayBuffer()));
    fetched.add(name); console.log(`Saved ${name}`);
  }
  return `/assets/photos/${name}`;
}
for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const item of data.places || data.articles) {
    const source = item.imageSource || item.image;
    if (!source?.startsWith('https://images.unsplash.com/')) continue;
    item.imageSource = source; item.image = await cache(source);
  }
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
await cache('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb');
await cache('https://images.unsplash.com/photo-1554118811-1e0d58224f24');
