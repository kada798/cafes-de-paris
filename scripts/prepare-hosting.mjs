import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'hosting/public'), { recursive: true });
await cp(resolve(root, 'dist'), resolve(root, 'hosting/public'), { recursive: true });
await writeFile(
  resolve(root, 'hosting/frontend.mjs'),
  `export default ${JSON.stringify(await readFile(resolve(root, 'dist/index.html'), 'utf8'))};\n`
);
console.log('Existing café frontend prepared for Sites Worker + D1.');
