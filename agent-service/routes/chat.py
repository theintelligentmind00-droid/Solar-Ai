"""Chat endpoint — routes messages through Claude and persists history."""

import os
from typing import Any

import aiosqlite
import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.schema import DB_PATH
from memory.memory import (
    load_context,
    load_memories,
    save_message,
    smart_extract_memories,
)
from skills.permissions import log_action

router = APIRouter(prefix="/chat", tags=["chat"])

BASE_SYSTEM_PROMPT = (
    "You are Solar, a personal AI assistant and project manager built into the user's "
    "private 'Solar AI OS' dashboard. You are their central intelligence — the sun "
    "that everything orbits around.\n\n"
    "Personality & tone:\n"
    "- Read the user's communication style carefully: their vocabulary, sentence length, "
    "energy, and formality. Mirror it naturally. If they're casual and punchy, match that. "
    "If they're formal and detailed, rise to that. Never go so casual it feels unprofessional.\n"
    "- Be warm and genuinely interested in the user and their work — not in a sycophantic way, "
    "but like a sharp colleague who actually cares.\n"
    "- Be direct and confident. Don't hedge everything. When you have an opinion, share it.\n"
    "- Avoid corporate filler phrases: 'Certainly!', 'Great question!', 'Absolutely!', "
    "'Of course!' — just get to the point.\n"
    "- Keep responses tight. If something can be said in two sentences, don't use five.\n\n"
    "Your job: help the user make real progress on their projects. Be proactive — "
    "notice patterns, surface what matters, push back gently if something seems off."
)


class ChatRequest(BaseModel):
    planet_id: str
    message: str


async def _get_planet_name(planet_id: str, db_path: str = DB_PATH) -> str:
    """Look up a planet's display name, falling back to the id."""
    if planet_id == "sun":
        return "Main Agent"
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT name FROM planets WHERE id = ?", (planet_id,)
        ) as cursor:
            row = await cursor.fetchone()
    return row[0] if row else planet_id


@router.post("")
async def chat(body: ChatRequest) -> dict[str, Any]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set in environment")

    planet_name = await _get_planet_name(body.planet_id)

    # Load recent conversation history and long-term memories
    context = await load_context(body.planet_id, limit=20, db_path=DB_PATH)
    memories_text = await load_memories(body.planet_id, db_path=DB_PATH)

    # Build system prompt with planet context + injected memories
    system_prompt = (
        f"{BASE_SYSTEM_PROMPT}\n\n"
        f"You are currently helping with the project: {planet_name}"
    )
    if memories_text:
        system_prompt += f"\n\n## What I know about you:\n{memories_text}"

    # Call Claude (async client)
    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=context + [{"role": "user", "content": body.message}],
    )
    reply: str = response.content[0].text  # type: ignore[union-attr]

    # Persist both messages
    await save_message(body.planet_id, "user", body.message, db_path=DB_PATH)
    await save_message(body.planet_id, "assistant", reply, db_path=DB_PATH)

    # Auto-extract memories via Claude Haiku (fire-and-forget style — errors are swallowed)
    await smart_extract_memories(
        body.message, reply, body.planet_id, planet_name, api_key, db_path=DB_PATH
    )

    # Log token usage to the action log
    usage = response.usage
    await log_action(
        skill="chat",
        summary=(
            f"[{planet_name}] {usage.input_tokens} in / {usage.output_tokens} out tokens"
        ),
        success=True,
    )

    return {"reply": reply, "planet_id": body.planet_id}
