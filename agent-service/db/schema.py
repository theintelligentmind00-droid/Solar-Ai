"""SQLite schema and initialization for Solar AI OS."""

import aiosqlite

DB_PATH = "solar_ai.db"

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS planets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    orbit_radius REAL NOT NULL DEFAULT 200.0,
    color TEXT NOT NULL DEFAULT '#FFD700',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (planet_id) REFERENCES planets(id)
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    planet_id TEXT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    scopes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    skill TEXT NOT NULL,
    summary TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    FOREIGN KEY (planet_id) REFERENCES planets(id)
);
"""

_SEED_INTEGRATIONS = """
INSERT OR IGNORE INTO integrations (id, name, enabled)
VALUES
    ('int-gmail', 'gmail', 0),
    ('int-calendar', 'calendar', 0),
    ('int-files', 'files', 0);
"""


async def init_db(db_path: str = DB_PATH) -> None:
    """Create all tables and seed default rows. Safe to call on every startup."""
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(_CREATE_TABLES)
        await db.executescript(_SEED_INTEGRATIONS)
        await db.commit()
