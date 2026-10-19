import { readFileSync } from 'node:fs';
import { openDatabase, catalogRepository } from '../server/repositories/catalog.mjs';
const [id, file] = process.argv.slice(2);
if (!id || !file) { console.error('Usage: npm run data:override -- PLACE_ID patch.json'); process.exit(1); }
const patch = JSON.parse(readFileSync(file, 'utf8'));
if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.hasOwn(patch, 'id')) throw new Error('Patch must be an object and must not change id');
const db = openDatabase();
try { catalogRepository(db).override(id, patch); console.log(`Local override saved for ${id}; future seed imports preserve it.`); }
finally { db.close(); }
