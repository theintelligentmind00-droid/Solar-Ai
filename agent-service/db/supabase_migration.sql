-- Supabase migration for Solar AI OS
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ── Planets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    orbit_radius REAL NOT NULL DEFAULT 200.0,
    color TEXT NOT NULL DEFAULT '#FFD700',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local',
    last_activity_at TIMESTAMPTZ,
    planet_type TEXT DEFAULT 'terra'
);
CREATE INDEX IF NOT EXISTS idx_planets_user_id ON planets(user_id);

-- ── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_messages_planet_user ON messages(planet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ── Memories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    planet_id TEXT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local',
    type TEXT DEFAULT 'fact',
    importance REAL DEFAULT 0.5,
    last_accessed TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_memories_planet_user ON memories(planet_id, user_id);

-- ── Integrations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    scopes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local'
);

-- Seed default integrations
INSERT INTO integrations (id, name, enabled)
VALUES ('int-gmail', 'gmail', 0),
       ('int-calendar', 'calendar', 0),
       ('int-files', 'files', 0)
ON CONFLICT (id) DO NOTHING;

-- ── Logs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    skill TEXT NOT NULL,
    summary TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

-- ── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    user_id TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_tasks_planet ON tasks(planet_id);

-- ── User Profile ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local',
    UNIQUE(key, user_id)
);

-- ── OAuth Configs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_configs (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local'
);

-- ── OAuth Tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    scopes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NOT NULL DEFAULT 'local'
);

-- ── Enable Row Level Security (optional, for future auth) ───────────────────
-- ALTER TABLE planets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oauth_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
