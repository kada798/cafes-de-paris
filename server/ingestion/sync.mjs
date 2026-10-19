import { fetchParisEvents } from './sources/paris-data.mjs';
import { linkEvent } from './match.mjs';
import { catalogRepository } from '../repositories/catalog.mjs';
export async function syncEvents(db, fetcher = fetch) {
  const started = new Date().toISOString();
  const run = db.prepare('INSERT INTO sync_runs (source, started_at, status) VALUES (?,?,?)').run('paris-data', started, 'running');
  try {
    const places = catalogRepository(db).places();
    const events = (await fetchParisEvents(fetcher)).map(e => linkEvent(e, places));
    db.exec('BEGIN');
    try {
      for (const event of events) db.prepare('INSERT INTO events VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(event.id, 'paris-data', JSON.stringify(event), started);
      db.prepare('UPDATE sync_runs SET status=?,finished_at=?,imported=? WHERE id=?').run('success', new Date().toISOString(), events.length, run.lastInsertRowid);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { status: 'success', imported: events.length };
  } catch (error) {
    db.prepare('UPDATE sync_runs SET status=?,finished_at=?,message=? WHERE id=?').run('failed', new Date().toISOString(), String(error.message).slice(0, 200), run.lastInsertRowid);
    return { status: 'failed', imported: 0, message: error.message };
  }
}
