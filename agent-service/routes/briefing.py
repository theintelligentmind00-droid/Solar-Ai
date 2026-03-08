"""Proactive briefing route — Solar generates a status update for a planet."""

import os
from typing import Any

import aiosqlite
from anthropic import AsyncAnthropic
from fastapi import APIRouter

from db.schema import DB_PATH

router = APIRouter(prefix="/briefing", tags=["briefing"])

_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


@router.get("/{planet_id}")
async def get_briefing(planet_id: str) -> dict[str, Any]:
    """Generate a proactive briefing for the planet using Claude Haiku."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Planet name
        async with db.execute("SELECT name FROM planets WHERE id = ?", (planet_id,)) as cur:
            planet_row = await cur.fetchone()
        planet_name = planet_row["name"] if planet_row else planet_id

        # Recent messages (last 10)
        async with db.execute(
            "SELECT role, content FROM messages WHERE planet_id = ? ORDER BY rowid DESC LIMIT 10",
            (planet_id,),
        ) as cur:
            messages = [dict(r) for r in await cur.fetchall()]
        messages.reverse()

        # Memories
        async with db.execute(
            """
            SELECT key, value FROM memories
            WHERE planet_id = ? OR planet_id IS NULL
            ORDER BY created_at DESC LIMIT 10
            """,
            (planet_id,),
        ) as cur:
            memories = [dict(r) for r in await cur.fetchall()]

        # Tasks
        async with db.execute(
            """
            SELECT title, status, priority FROM tasks
            WHERE planet_id = ? ORDER BY created_at DESC LIMIT 10
            """,
            (planet_id,),
        ) as cur:
            tasks = [dict(r) for r in await cur.fetchall()]

    context_parts: list[str] = []
    if memories:
        mem_lines = "\n".join(f"- {m['key']}: {m['value']}" for m in memories)
        context_parts.append(f"MEMORIES:\n{mem_lines}")
    if tasks:
        task_lines = "\n".join(
            f"- [{t['status'].upper()}] {t['title']} ({t['priority']} priority)"
            for t in tasks
        )
        context_parts.append(f"TASKS:\n{task_lines}")
    if messages:
        chat_lines = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        )
        context_parts.append(f"RECENT CHAT:\n{chat_lines}")

    context = "\n\n".join(context_parts) if context_parts else "No activity yet."

    project_line = f'Generate a brief, useful status briefing for the project "{planet_name}".'
    prompt = (
        f"You are Solar, a sharp personal AI. {project_line}\n\n"
        f"Context:\n{context}\n\n"
        "Write 2-3 sentences max. Be specific and actionable. "
        "Mention what's in progress, what needs attention, or what's notable. "
        "No fluff, no corporate speak. Sound like a smart teammate giving a quick heads-up."
    )

    response = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    briefing_text = response.content[0].text if response.content else "No briefing available."

    return {"planet_id": planet_id, "planet_name": planet_name, "briefing": briefing_text}
