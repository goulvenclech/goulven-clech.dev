-- Apply with: turso db shell <database-name> < db/schema.sql
--
-- SQLite cannot ALTER a CHECK: to extend an enum below, rebuild the table
-- (CREATE new → INSERT … SELECT → DROP old → ALTER … RENAME).
-- See https://www.sqlite.org/lang_altertable.html §"Making other kinds of
-- table schema changes".

CREATE TABLE IF NOT EXISTS sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- Local calendar day in Europe/Paris.
	date TEXT NOT NULL UNIQUE
		CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	kind TEXT NOT NULL
		CHECK (kind IN ('strength', 'cardio', 'combat', 'core', 'rest')),
	status TEXT NOT NULL
		CHECK (status IN ('completed', 'partial', 'skipped')),
	skip_reason TEXT
		CHECK (skip_reason IN ('sick', 'holiday', 'lazy', 'social')),
	notes TEXT NOT NULL DEFAULT '',
	inserted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_sets (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
	exercise TEXT NOT NULL,
	-- Denormalised at insert time so stats never depend on the in-code
	-- exercise catalogue staying stable.
	pattern TEXT NOT NULL
		CHECK (pattern IN ('squat', 'hinge', 'push', 'pull', 'core', 'conditioning')),
	-- NULL for bodyweight work.
	weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
	reps INTEGER NOT NULL CHECK (reps >= 1),
	set_index INTEGER NOT NULL
);

-- Unique: the only write path assigns set_index sequentially per session; the
-- left prefix also serves plain session_id lookups.
CREATE UNIQUE INDEX IF NOT EXISTS session_sets_session_id_set_index
	ON session_sets (session_id, set_index);
