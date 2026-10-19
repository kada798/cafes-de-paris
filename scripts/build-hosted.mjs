import { spawnSync } from 'node:child_process';
import { cp, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
function run(file, cwd = root, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}
run('scripts/build-preview.mjs');
run('scripts/prepare-hosting.mjs');
run('scripts/run-framework.mjs', resolve(root, 'hosting'), ['build']);
const output = resolve(root, 'dist');
if (output !== resolve(root, 'dist') || (await lstat(output)).isSymbolicLink())
  throw new Error('Unexpected build output');
await rm(output, { recursive: true, force: true });
await cp(resolve(root, 'hosting/dist'), output, { recursive: true });
console.log('Sites Worker + D1 artifact ready in dist/.');
