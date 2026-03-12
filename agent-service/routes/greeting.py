"""Greeting endpoint — generates a context-aware welcome back message via Claude."""

import os

import aiosqlite
import anthropic
from fastapi import APIRouter

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table
from memory.memory import load_context, load_memories

router = APIRouter()


def format_messages(messages: list[dict]) -> str:
    return "\n".join(f"{m['role'].title()}: {m['content'][:100]}" for m in messages[-4:])


@router.get("/greeting/{planet_id}")
async def get_greeting(planet_id: str) -> dict[str, str | None]:
    """Return a brief AI-generated welcome back greeting for the given planet."""
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return {"greeting": None, "planet_id": planet_id}

        if planet_id == "sun":
            planet_name = "Main Agent"
        elif USE_SUPABASE:
            result = supa_table("planets").select("name").eq("id", planet_id).limit(1).execute()
            planet_name = result.data[0]["name"] if result.data else planet_id
        else:
            async with aiosqlite.connect(DB_PATH) as db:
                async with db.execute(
                    "SELECT name FROM planets WHERE id = ?",
                    (planet_id,),
                ) as cursor:
                    row = await cursor.fetchone()
            planet_name = row[0] if row else planet_id

        context = await load_context(planet_id, limit=6)
        memories_text = await load_memories(planet_id)

        if not context and not memories_text:
            return {"greeting": None, "planet_id": planet_id}

        user_message = (
            f"Project: {planet_name}\n\n"
            f"Memories:\n{memories_text or 'None'}\n\n"
            f"Recent messages:\n{format_messages(context)}\n\n"
            "Write a brief welcome back greeting."
        )

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            system=(
                "You are Solar, a personal AI assistant. Generate a warm, brief "
                "(2-3 sentences max) 'welcome back' greeting that summarizes where "
                "things stand with this project. Be specific, reference actual context. "
                "Never say 'I don't have information'."
            ),
            messages=[{"role": "user", "content": user_message}],
        )

        greeting_text: str = response.content[0].text  # type: ignore[index]
        return {"greeting": greeting_text, "planet_id": planet_id}

    except Exception:
        return {"greeting": None, "planet_id": planet_id}
