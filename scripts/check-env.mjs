import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let failures = 0;

function report(ok, label) {
  console.log(`${ok ? 'OK' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
}

const major = Number(process.versions.node.split('.')[0]);
report(major >= 24 && major < 27, `Node.js ${process.version} (supported: 24-26)`);

try {
  // Test an in-memory database without creating or changing project data.
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(':memory:');
  try {
    const row = database.prepare('SELECT sqlite_version() AS version').get();
    report(Boolean(row.version), `SQLite ${row.version}`);
  } finally {
    database.close();
  }
} catch {
  report(false, 'SQLite unavailable; use a supported Node.js installation.');
}

const git = process.platform === 'win32' ? 'git.exe' : 'git';
function runGit(args) {
  return execFileSync(git, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

let gitAvailable = false;
try {
  report(true, runGit(['--version']));
  gitAvailable = true;
} catch {
  report(false, 'Git unavailable; install Git and reopen the terminal.');
}

if (gitAvailable) {
  try {
    const repoRoot = runGit(['rev-parse', '--show-toplevel']);
    const normalize = (value) => value.replaceAll('\\', '/').replace(/\/$/, '');
    const actual = normalize(repoRoot);
    const expected = normalize(projectRoot);
    const sameRoot =
      process.platform === 'win32'
        ? actual.toLowerCase() === expected.toLowerCase()
        : actual === expected;
    report(sameRoot, 'Project has its own Git repository');
  } catch {
    report(false, 'Project Git repository missing; run git init in the project folder.');
  }

  try {
    // Do not print remote URLs: they can accidentally contain credentials.
    runGit(['remote', 'get-url', 'origin']);
    console.log(
      'INFO  Git origin configured; authentication and push access require a separate check.'
    );
  } catch {
    console.log('INFO  Git origin not configured yet.');
  }
}

const hasLocalEnv = existsSync(new URL('../.env', import.meta.url));
console.log(
  hasLocalEnv
    ? 'INFO  Local .env exists; values are not displayed.'
    : 'INFO  Optional: copy .env.example to .env for local settings.'
);
console.log('INFO  This check does not contact GitHub or run any data collection.');
console.log(failures ? `Environment check failed (${failures}).` : 'Environment ready.');
process.exitCode = failures ? 1 : 0;
