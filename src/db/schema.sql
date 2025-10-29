-- src/db/schema.sql
-- Schema versioning (optional): bump this when you change the schema
PRAGMA user_version = 1;

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
  id                INTEGER PRIMARY KEY,         -- stable rowid (autoincrement not needed)
  name              TEXT    NOT NULL,            -- required
  capital           TEXT,                        -- optional
  region            TEXT,                        -- optional
  population        INTEGER NOT NULL,            -- required
  currency_code     TEXT,                        -- required except when no currencies → NULL per spec
  exchange_rate     REAL,                        -- may be NULL
  estimated_gdp     REAL,                        -- may be 0 (no currencies) or NULL (unknown rate)
  flag_url          TEXT,                        -- optional
  last_refreshed_at TEXT    NOT NULL             -- ISO8601 string
);

-- Case-insensitive uniqueness by name (UPSERT target)
-- SQLite supports expression indexes; we enforce uniqueness on LOWER(name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_countries_lower_name
  ON countries (LOWER(name));

-- Filter/sort helpers
CREATE INDEX IF NOT EXISTS idx_countries_region
  ON countries (LOWER(region));
CREATE INDEX IF NOT EXISTS idx_countries_currency
  ON countries (LOWER(currency_code));
-- Useful when sorting by GDP
CREATE INDEX IF NOT EXISTS idx_countries_estimated_gdp
  ON countries (estimated_gdp);

-- Global refresh status (singleton row: id=1)
CREATE TABLE IF NOT EXISTS refresh_status (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  last_refreshed_at TEXT
);

-- Ensure the singleton row exists
INSERT OR IGNORE INTO refresh_status (id, last_refreshed_at) VALUES (1, NULL);
