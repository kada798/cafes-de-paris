import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const base = process.env.PAGES_BASE_PATH || '/cafes-de-paris';
if (!/^\/[a-zA-Z\d_-]+$/.test(base)) throw new Error('Invalid Pages base path');
const run = spawnSync(process.execPath, ['scripts/build-preview.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (run.status !== 0) process.exit(run.status || 1);
const output = resolve(root, 'dist');
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    const type = extname(path);
    if (!['.mjs', '.html', '.json'].includes(type)) continue;
    let source = await readFile(path, 'utf8');
    if (type === '.html')
      source = source
        .replace(
          '<head>',
          `<head>\n<meta name="app-base" content="${base}">\n<meta name="library-endpoint" content="https://les-cafes-de-paris.yellowelm32.chatgpt.site/api/library">`
        )
        .replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`);
    if (type === '.mjs')
      source = source.replace(/(['"`])\/(shared|assets|vendor|api)\//g, `$1${base}/$2/`);
    if (type === '.json')
      source = JSON.stringify(JSON.parse(source), (key, value) =>
        typeof value === 'string' && value.startsWith('/assets/') ? base + value : value
      );
    await writeFile(path, source);
  }
}
await visit(output);
await writeFile(resolve(output, '.nojekyll'), '');
// A real landing document and every language/detail URL exist; no SPA-only hosting dependency.
await cp(resolve(output, 'fr/index.html'), resolve(output, 'index.html'));
console.log(`GitHub Pages ready at ${base}/. Shared statistics use the existing public API.`);
