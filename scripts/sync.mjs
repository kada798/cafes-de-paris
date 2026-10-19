import { openDatabase } from '../server/repositories/catalog.mjs';
import { syncEvents } from '../server/ingestion/sync.mjs';
const db = openDatabase();
async function run() {
  const result = await syncEvents(db);
  console.log(JSON.stringify({ ...result, at: new Date().toISOString() }));
  return result;
}
const result = await run();
if (process.argv.includes('--watch')) {
  const minutes = Math.max(30, Number(process.env.SYNC_INTERVAL_MINUTES) || 180);
  setInterval(run, minutes * 60000);
  console.log(`Sync worker active: every ${minutes} minutes.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { db.close(); process.exit(); });
} else { db.close(); process.exitCode = result.status === 'success' ? 0 : 1; }
