"""Memory read/write helpers — load chat context and persist messages."""

import json
import uuid
from typing import Any

import aiosqlite
import anthropic

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


async def load_memories(
    planet_id: str,
    db_path: str = DB_PATH,
) -> str:
    """Fetch all memories for a planet plus global memories (planet_id IS NULL).

    Returns a formatted bullet-point string, or an empty string when no rows exist.
    """
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            """
            SELECT key, value FROM memories
            WHERE planet_id = ? OR planet_id IS NULL
            ORDER BY created_at ASC
            """,
            (planet_id,),
        ) as cursor:
            rows = await cursor.fetchall()

    if not rows:
        return ""

    lines = [f"- {row[0]}: {row[1]}" for row in rows]
    return "\n".join(lines)


async def extract_and_save_memories(
    user_message: str,
    planet_id: str,
    db_path: str = DB_PATH,
) -> None:
    """Detect explicit memory requests in the user message and persist them.

    Saves a memory only when the message starts with "remember:" (case-insensitive)
    or contains the phrase "remember that".  The entire user message is stored
    with key="note".
    """
    normalized = user_message.strip().lower()
    should_save = normalized.startswith("remember:") or "remember that" in normalized

    if should_save:
        await save_memory(
            key="note",
            value=user_message.strip(),
            planet_id=planet_id,
            db_path=db_path,
        )


async def smart_extract_memories(
    user_message: str,
    assistant_reply: str,
    planet_id: str,
    planet_name: str,
    api_key: str,
    db_path: str = DB_PATH,
) -> list[str]:
    """Use Claude to extract key facts from a conversation turn and persist them.

    Returns a list of memory keys that were saved, or [] on any error or when
    nothing worth remembering is found.
    """
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=(
                "You extract key facts worth remembering from conversations. "
                "Return ONLY a JSON array of objects like "
                '[{"key": "short_label", "value": "fact to remember"}]. '
                "Return [] if nothing is worth remembering. "
                "Max 3 facts per turn. "
                "Focus on: names, goals, decisions, preferences, project details. "
                "Also note communication style if evident — e.g. "
                '{"key": "user_style", "value": "casual, terse, uses slang"} or '
                '{"key": "user_style", "value": "formal, detailed, technical"}. '
                "Only emit user_style if you have enough signal to be confident."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Planet/Project: {planet_name}\n"
                        f"User said: {user_message}\n"
                        f"Solar replied: {assistant_reply}\n\n"
                        "What key facts should Solar remember?"
                    ),
                }
            ],
        )

        raw_text = response.content[0].text.strip()

        try:
            facts: list[dict[str, str]] = json.loads(raw_text)
        except (json.JSONDecodeError, IndexError):
            return []

        if not isinstance(facts, list) or not facts:
            return []

        saved_keys: list[str] = []
        for fact in facts:
            if not isinstance(fact, dict):
                continue
            key = fact.get("key", "").strip()
            value = fact.get("value", "").strip()
            if key and value:
                await save_memory(
                    key=key,
                    value=value,
                    planet_id=planet_id,
                    db_path=db_path,
                )
                saved_keys.append(key)

        return saved_keys

    except Exception:
        return []
