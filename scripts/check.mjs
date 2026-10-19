import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(resolve(path, entry.name)) : [resolve(path, entry.name)]
  );
}
const files = ['web', 'server', 'shared', 'scripts', 'tests']
  .flatMap((dir) => walk(fileURLToPath(new URL(dir, root))))
  .filter((f) => f.endsWith('.mjs'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
for (const file of ['seeds/catalog.json', 'content/articles.json'])
  JSON.parse(readFileSync(new URL(file, root), 'utf8'));
console.log(`Syntax checked: ${files.length} JavaScript modules and content JSON.`);
