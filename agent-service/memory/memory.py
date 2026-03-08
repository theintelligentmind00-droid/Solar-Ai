"""Memory read/write helpers — load chat context and persist messages."""

import uuid
from typing import Any

import aiosqlite

from db.schema import DB_PATH


async def load_context(
    planet_id: str,
    limit: int = 20,
    db_path: str = DB_PATH,
) -> list[dict[str, Any]]:
    """Load the last `limit` messages for a planet, formatted for the Claude API."""
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            """
            SELECT role, content FROM messages
            WHERE planet_id = ?
            ORDER BY rowid DESC
            LIMIT ?
            """,
            (planet_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()

    # Rows come back newest-first; reverse so oldest is first (correct order for LLM)
    return [{"role": row[0], "content": row[1]} for row in reversed(rows)]


async def save_message(
    planet_id: str,
    role: str,
    content: str,
    db_path: str = DB_PATH,
) -> None:
    """Persist a single message to the messages table."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO messages (id, planet_id, role, content) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), planet_id, role, content),
        )
        await db.commit()


async def save_memory(
    key: str,
    value: str,
    planet_id: str | None = None,
    db_path: str = DB_PATH,
) -> None:
    """Store a key/value memory fact, optionally scoped to a planet."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO memories (id, planet_id, key, value) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), planet_id, key, value),
        )
        await db.commit()
