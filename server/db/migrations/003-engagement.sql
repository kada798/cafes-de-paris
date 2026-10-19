CREATE TABLE engagement_events (event_key TEXT PRIMARY KEY, source_id TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('view','click')), recorded_at TEXT NOT NULL);
CREATE INDEX engagement_source_time ON engagement_events(source_id, recorded_at);
CREATE INDEX engagement_actor_time ON engagement_events(actor, recorded_at);
CREATE TABLE engagement_likes (source_id TEXT NOT NULL, actor TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(source_id,actor));
