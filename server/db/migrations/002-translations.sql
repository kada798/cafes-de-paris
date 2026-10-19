CREATE TABLE IF NOT EXISTS translation_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  updated_at TEXT NOT NULL
);
