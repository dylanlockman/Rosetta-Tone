CREATE TABLE IF NOT EXISTS songs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('tab', 'musicxml', 'url')),
  source_url  TEXT,
  raw_content TEXT NOT NULL,
  parsed_json TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scales (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  intervals TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chords (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  tuning    TEXT DEFAULT 'EADGBE',
  fingering TEXT NOT NULL
);
