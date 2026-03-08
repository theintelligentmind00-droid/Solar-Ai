"""Tests for DB schema init and memory helpers."""

import aiosqlite

from db.schema import init_db
from memory.memory import load_context, save_memory, save_message


async def test_init_db_creates_all_tables(use_temp_db):
    await init_db(db_path=use_temp_db)
    async with aiosqlite.connect(use_temp_db) as db:
        async with db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ) as cursor:
            tables = {row[0] for row in await cursor.fetchall()}
    expected = {"planets", "messages", "memories", "integrations", "logs"}
    assert expected.issubset(tables)


async def test_init_db_seeds_integrations(use_temp_db):
    await init_db(db_path=use_temp_db)
    async with aiosqlite.connect(use_temp_db) as db:
        async with db.execute("SELECT name, enabled FROM integrations") as cursor:
            rows = {row[0]: row[1] for row in await cursor.fetchall()}
    assert rows == {"gmail": 0, "calendar": 0, "files": 0}


async def test_init_db_is_idempotent(use_temp_db):
    """Calling init_db twice should not raise or duplicate data."""
    await init_db(db_path=use_temp_db)
    await init_db(db_path=use_temp_db)
    async with aiosqlite.connect(use_temp_db) as db:
        async with db.execute("SELECT COUNT(*) FROM integrations") as cursor:
            count = (await cursor.fetchone())[0]
    assert count == 3


async def test_save_and_load_messages(use_temp_db):
    await init_db(db_path=use_temp_db)
    planet_id = "planet-test-1"

    await save_message(planet_id, "user", "Hello Solar!", db_path=use_temp_db)
    await save_message(planet_id, "assistant", "Hi! How can I help?", db_path=use_temp_db)

    context = await load_context(planet_id, limit=10, db_path=use_temp_db)

    assert len(context) == 2
    assert context[0] == {"role": "user", "content": "Hello Solar!"}
    assert context[1] == {"role": "assistant", "content": "Hi! How can I help?"}


async def test_load_context_respects_limit(use_temp_db):
    await init_db(db_path=use_temp_db)
    planet_id = "planet-test-2"

    for i in range(5):
        await save_message(planet_id, "user", f"Message {i}", db_path=use_temp_db)

    context = await load_context(planet_id, limit=3, db_path=use_temp_db)
    assert len(context) == 3
    # Should return the LAST 3 messages (most recent), in chronological order
    assert context[-1]["content"] == "Message 4"


async def test_save_memory(use_temp_db):
    await init_db(db_path=use_temp_db)
    await save_memory("user_name", "Jeremy", planet_id=None, db_path=use_temp_db)

    async with aiosqlite.connect(use_temp_db) as db:
        async with db.execute("SELECT key, value FROM memories") as cursor:
            rows = await cursor.fetchall()
    assert rows == [("user_name", "Jeremy")]
