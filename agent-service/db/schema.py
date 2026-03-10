"""SQLite schema and initialization for Solar AI OS."""

import os

import aiosqlite

_DATA_DIR = os.path.join(os.path.expanduser("~"), ".solar-ai")
os.makedirs(_DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(_DATA_DIR, "solar_ai.db")

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS planets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    orbit_radius REAL NOT NULL DEFAULT 200.0,
    color TEXT NOT NULL DEFAULT '#FFD700',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local',
    FOREIGN KEY (planet_id) REFERENCES planets(id)
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    planet_id TEXT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    scopes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    skill TEXT NOT NULL,
    summary TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    user_id TEXT NOT NULL DEFAULT 'local',
    FOREIGN KEY (planet_id) REFERENCES planets(id)
);

CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS oauth_configs (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TEXT,
    scopes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL DEFAULT 'local'
);
"""

_SEED_INTEGRATIONS = """
INSERT OR IGNORE INTO integrations (id, name, enabled)
VALUES
    ('int-gmail', 'gmail', 0),
    ('int-calendar', 'calendar', 0),
    ('int-files', 'files', 0);
"""


_MIGRATIONS = [
    "ALTER TABLE planets ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE memories ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE integrations ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE logs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE oauth_configs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    "ALTER TABLE oauth_tokens ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'",
    # Memory enrichment columns
    "ALTER TABLE memories ADD COLUMN type TEXT DEFAULT 'fact'",
    "ALTER TABLE memories ADD COLUMN importance REAL DEFAULT 0.5",
    "ALTER TABLE memories ADD COLUMN last_accessed TEXT",
    "ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0",
]


async def init_db(db_path: str = DB_PATH) -> None:
    """Create all tables, run migrations, and seed default rows. Safe to call on every startup."""
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(_CREATE_TABLES)
        await db.executescript(_SEED_INTEGRATIONS)
        # Run additive migrations — each is safe to fail if the column already exists.
        for migration in _MIGRATIONS:
            try:
                await db.execute(migration)
            except Exception:
                pass  # Column already exists — safe to ignore
        await db.commit()
