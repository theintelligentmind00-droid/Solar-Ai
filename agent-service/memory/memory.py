"""Memory read/write helpers — rich persistent memory and personality system."""

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
    user_id: str = "local",
) -> list[dict[str, Any]]:
    """Load the last `limit` messages for a planet, formatted for the Claude API."""
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            """
            SELECT role, content FROM messages
            WHERE planet_id = ? AND user_id = ?
            ORDER BY rowid DESC
            LIMIT ?
            """,
            (planet_id, user_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()

    return [{"role": row[0], "content": row[1]} for row in reversed(rows)]


async def save_message(
    planet_id: str,
    role: str,
    content: str,
    db_path: str = DB_PATH,
    user_id: str = "local",
) -> None:
    """Persist a single message to the messages table."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO messages (id, planet_id, role, content, user_id) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), planet_id, role, content, user_id),
        )
        await db.commit()


async def upsert_memory(
    key: str,
    value: str,
    planet_id: str | None = None,
    memory_type: str = "fact",
    importance: float = 0.5,
    db_path: str = DB_PATH,
    user_id: str = "local",
) -> None:
    """Insert or update a memory by key+planet_id scope. Updates value and importance on conflict."""
    async with aiosqlite.connect(db_path) as db:
        if planet_id is not None:
            async with db.execute(
                "SELECT id FROM memories WHERE key = ? AND planet_id = ? AND user_id = ?",
                (key, planet_id, user_id),
            ) as cursor:
                existing = await cursor.fetchone()
        else:
            async with db.execute(
                "SELECT id FROM memories WHERE key = ? AND planet_id IS NULL AND user_id = ?",
                (key, user_id),
            ) as cursor:
                existing = await cursor.fetchone()

        if existing:
            await db.execute(
                """UPDATE memories
                   SET value = ?, type = ?, importance = ?,
                       last_accessed = datetime('now'),
                       access_count = access_count + 1
                   WHERE id = ?""",
                (value, memory_type, importance, existing[0]),
            )
        else:
            await db.execute(
                """INSERT INTO memories
                   (id, planet_id, key, value, type, importance, last_accessed, access_count, user_id)
                   VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0, ?)""",
                (str(uuid.uuid4()), planet_id, key, value, memory_type, importance, user_id),
            )
        await db.commit()


async def save_memory(
    key: str,
    value: str,
    planet_id: str | None = None,
    db_path: str = DB_PATH,
) -> None:
    """Legacy interface — delegates to upsert_memory."""
    await upsert_memory(key, value, planet_id=planet_id, db_path=db_path)


async def upsert_profile(
    key: str,
    value: str,
    confidence: float = 0.5,
    db_path: str = DB_PATH,
    user_id: str = "local",
) -> None:
    """Insert or update a user personality/profile observation."""
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT id, confidence FROM user_profile WHERE key = ? AND user_id = ?", (key, user_id)
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            if confidence >= existing[1]:
                await db.execute(
                    "UPDATE user_profile SET value = ?, confidence = ?, updated_at = datetime('now') WHERE id = ?",
                    (value, confidence, existing[0]),
                )
        else:
            await db.execute(
                "INSERT INTO user_profile (id, key, value, confidence, user_id) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), key, value, confidence, user_id),
            )
        await db.commit()


async def load_user_profile(db_path: str = DB_PATH, user_id: str = "local") -> dict[str, str]:
    """Return the user profile as a key→value dict, highest confidence first."""
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT key, value FROM user_profile WHERE user_id = ? ORDER BY confidence DESC, updated_at DESC",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
    return {row[0]: row[1] for row in rows}


async def load_memories_categorized(
    planet_id: str,
    db_path: str = DB_PATH,
    user_id: str = "local",
) -> dict[str, list[tuple[str, str]]]:
    """Return memories grouped by type, sorted by importance desc.

    Returns: {type_name: [(key, value), ...]}
    Global memories (planet_id IS NULL) are included alongside project-specific ones.
    """
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            """
            SELECT key, value, COALESCE(type, 'fact') as type
            FROM memories
            WHERE (planet_id = ? OR planet_id IS NULL) AND user_id = ?
            ORDER BY COALESCE(importance, 0.5) DESC, created_at DESC
            """,
            (planet_id, user_id),
        ) as cursor:
            rows = await cursor.fetchall()

    result: dict[str, list[tuple[str, str]]] = {}
    for key, value, mem_type in rows:
        if mem_type not in result:
            result[mem_type] = []
        result[mem_type].append((key, value))
    return result


async def load_memories(
    planet_id: str,
    db_path: str = DB_PATH,
) -> str:
    """Flat bullet-point string of all memories (legacy interface)."""
    categorized = await load_memories_categorized(planet_id, db_path=db_path)
    if not categorized:
        return ""
    lines = [f"- {key}: {value}" for items in categorized.values() for key, value in items]
    return "\n".join(lines)


def build_context_block(
    planet_name: str,
    profile: dict[str, str],
    categorized: dict[str, list[tuple[str, str]]],
) -> str:
    """Build a rich, structured context block to inject into Solar's system prompt."""
    parts: list[str] = []

    # ── User personality / profile ──────────────────────────────────────────
    if profile:
        _PROFILE_LABELS: dict[str, str] = {
            "communication_style": "Communication style",
            "message_style": "How they write",
            "personality_traits": "Personality",
            "energy_level": "Energy/pace",
            "how_they_think": "How they think",
            "what_they_value": "What they value",
            "frustrations": "What frustrates them",
            "domain_expertise": "Domain expertise",
        }
        lines: list[str] = []
        for key, value in profile.items():
            label = _PROFILE_LABELS.get(key, key.replace("_", " ").title())
            lines.append(f"- **{label}:** {value}")
        parts.append("## Who you're talking to:\n" + "\n".join(lines))

    # ── Memories by type ─────────────────────────────────────────────────────
    _TYPE_LABELS: dict[str, str] = {
        "goal": "Their active goals",
        "fact": "Facts about them",
        "preference": "Their preferences",
        "person": "People in their life",
        "pattern": "Patterns you've noticed",
    }
    for mem_type, label in _TYPE_LABELS.items():
        items = categorized.get(mem_type, [])
        if not items:
            continue
        # Cap per category to avoid prompt bloat; most important are first
        capped = items[:10]
        lines = [f"- {value}" for _, value in capped]
        parts.append(f"## {label}:\n" + "\n".join(lines))

    if not parts:
        return ""

    header = f"# Your knowledge of this person (project: {planet_name})\n"
    footer = (
        "\n**Use this knowledge naturally. Reference past context when relevant — "
        "\"You mentioned...\", \"Given your goal to...\". "
        "Never ask for information you already have. "
        "Notice connections between what they're saying now and what you know about them.**"
    )
    return header + "\n\n".join(parts) + footer


# ── Memory extraction ─────────────────────────────────────────────────────────

_EXTRACTION_SYSTEM = """\
You are the memory and personality engine for Solar AI OS — a personal AI that builds a deep, lasting understanding of its user over time.

Extract memories and personality observations from this conversation turn.

Return ONLY valid JSON with this exact structure:
{
  "memories": [
    {
      "key": "snake_case_identifier",
      "value": "specific, rich description — not just a label",
      "type": "fact|preference|goal|person|pattern",
      "importance": 0.7,
      "global": true
    }
  ],
  "profile": [
    {
      "key": "snake_case_identifier",
      "value": "observation about how this person communicates, thinks, or operates",
      "confidence": 0.6
    }
  ]
}

MEMORY TYPES — pick the most specific:
- fact: Objective facts ("builds a startup called SolarAI", "based in London", "has a dog named Max")
- preference: What they like/dislike ("hates long bullet lists", "wants direct answers with no caveats")
- goal: Active goals ("wants to launch by Q2", "targeting solo founders as first users")
- person: People in their life ("Alex is his co-founder", "Sarah is an investor they're pitching")
- pattern: Behavioral patterns ("messages late at night", "iterates fast, pivots quickly", "gets terse when frustrated")

"global": true = about them as a person across all projects. false = specific to THIS project only.

IMPORTANCE (be precise):
- 0.9+: Defining — name, core identity, major life goals, career
- 0.7–0.89: High — strong preferences, active goals, key people
- 0.5–0.69: Medium — useful patterns, project context, habits
- 0.3–0.49: Low — one-off observations, weak signal

PROFILE — personality and communication insights:
Useful keys: communication_style, message_style, personality_traits, energy_level, how_they_think, what_they_value, frustrations, domain_expertise

RULES:
- Max 4 memories per turn. Only save genuinely worth-remembering, long-term information.
- Use consistent keys to UPDATE existing memories rather than create duplicates.
  Example: if "goal_launch" already exists, use the same key to update it, don't create "goal_launch_v2".
- Prefer SPECIFIC over VAGUE: "prefers single-sentence replies over paragraphs" beats "likes brevity"
- If nothing new is worth saving, return {"memories": [], "profile": []}
- Never save filler, pleasantries, or transient information
"""


async def smart_extract_memories(
    user_message: str,
    assistant_reply: str,
    planet_id: str,
    planet_name: str,
    api_key: str,
    db_path: str = DB_PATH,
    user_id: str = "local",
) -> list[str]:
    """Extract typed memories and personality profile from a conversation turn.

    Returns list of saved memory keys, or [] on error / nothing to save.
    """
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=_EXTRACTION_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Project context: {planet_name}\n\n"
                        f"User said: {user_message}\n\n"
                        f"Solar replied: {assistant_reply}"
                    ),
                }
            ],
        )

        raw = response.content[0].text.strip()

        try:
            data: dict[str, Any] = json.loads(raw)
        except (json.JSONDecodeError, IndexError):
            return []

        saved_keys: list[str] = []

        for mem in data.get("memories", []):
            if not isinstance(mem, dict):
                continue
            key = str(mem.get("key", "")).strip()
            value = str(mem.get("value", "")).strip()
            if not key or not value:
                continue
            mem_type = str(mem.get("type", "fact"))
            importance = float(mem.get("importance", 0.5))
            is_global = bool(mem.get("global", False))

            await upsert_memory(
                key=key,
                value=value,
                planet_id=None if is_global else planet_id,
                memory_type=mem_type,
                importance=max(0.0, min(1.0, importance)),
                db_path=db_path,
                user_id=user_id,
            )
            saved_keys.append(key)

        for obs in data.get("profile", []):
            if not isinstance(obs, dict):
                continue
            key = str(obs.get("key", "")).strip()
            value = str(obs.get("value", "")).strip()
            if not key or not value:
                continue
            confidence = float(obs.get("confidence", 0.5))
            await upsert_profile(
                key=key,
                value=value,
                confidence=max(0.0, min(1.0, confidence)),
                db_path=db_path,
                user_id=user_id,
            )

        return saved_keys

    except Exception:  # noqa: BLE001
        return []
