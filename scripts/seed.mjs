import { openDatabase, seedDatabase } from '../server/repositories/catalog.mjs';
const db = openDatabase();
try {
  seedDatabase(db);
  console.log('Seed content imported; local overrides preserved.');
} finally {
  db.close();
}
