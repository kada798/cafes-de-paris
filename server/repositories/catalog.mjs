import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export function openDatabase(path = process.env.DATABASE_PATH || './data/cafes.sqlite') {
  const filename = path === ':memory:' ? path : resolve(ROOT, path);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if (filename !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
  const migrationDir = resolve(ROOT, 'server/db/migrations');
  for (const name of readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM migrations WHERE name=?').get(name)) continue;
    db.exec('BEGIN');
    try { db.exec(readFileSync(resolve(migrationDir, name), 'utf8')); db.prepare('INSERT INTO migrations VALUES (?)').run(name); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}

export function seedDatabase(db) {
  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'seeds/catalog.json'), 'utf8'));
  const content = JSON.parse(readFileSync(resolve(ROOT, 'content/articles.json'), 'utf8'));
  db.exec('BEGIN');
  try {
    for (const p of catalog.places) db.prepare('INSERT INTO places VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(p.id, JSON.stringify(p));
    for (const a of content.articles) db.prepare('INSERT INTO articles VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(a.id, JSON.stringify(a));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function catalogRepository(db) {
  return {
    places() { return db.prepare('SELECT p.payload, o.payload AS override FROM places p LEFT JOIN place_overrides o ON p.id=o.place_id').all().map(row => {
      const place = JSON.parse(row.payload), override = JSON.parse(row.override || '{}');
      return { ...place, ...override, policies: { ...place.policies, ...override.policies } };
    }); },
    articles() { return db.prepare('SELECT payload FROM articles').all().map(row => JSON.parse(row.payload)); },
    events() { return db.prepare('SELECT payload FROM events ORDER BY json_extract(payload,\'$.start\')').all().map(row => JSON.parse(row.payload)); },
    syncRuns() { return db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 10').all(); },
    override(id, patch) {
      if (!db.prepare('SELECT id FROM places WHERE id=?').get(id)) throw new Error('Place not found');
      const prior = JSON.parse(db.prepare('SELECT payload FROM place_overrides WHERE place_id=?').get(id)?.payload || '{}');
      const next = { ...prior, ...patch, policies: { ...prior.policies, ...patch.policies } };
      db.prepare('INSERT INTO place_overrides VALUES (?,?) ON CONFLICT(place_id) DO UPDATE SET payload=excluded.payload').run(id, JSON.stringify(next));
    },
  };
}
