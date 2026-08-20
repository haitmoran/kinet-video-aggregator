CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  day TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'video_open')),
  visitor_hash TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Unknown',
  device TEXT NOT NULL DEFAULT 'Other',
  item_id TEXT NOT NULL DEFAULT '',
  item_label TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS events_day_type_idx ON events(day, event_type);
CREATE INDEX IF NOT EXISTS events_visitor_idx ON events(visitor_hash, day);
CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_hash, day);

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL,
  window_started INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
