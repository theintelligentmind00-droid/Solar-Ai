"""Chat endpoint — routes messages through Claude and persists history."""

import os
from typing import Any

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.schema import DB_PATH
from memory.memory import load_context, save_message

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PROMPT = (
    "You are Solar, a helpful personal AI assistant and project manager. "
    "You are part of a 'solar system' dashboard — the user's central sun agent. "
    "Be concise, proactive, and warm. "
    "Help the user track their projects and actually get things done."
)


class ChatRequest(BaseModel):
    planet_id: str
    message: str


@router.post("")
async def chat(body: ChatRequest) -> dict[str, Any]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set in environment")

    # Load recent conversation history
    context = await load_context(body.planet_id, limit=20, db_path=DB_PATH)

    # Call Claude
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=context + [{"role": "user", "content": body.message}],
    )
    reply: str = response.content[0].text  # type: ignore[union-attr]

    # Persist both messages
    await save_message(body.planet_id, "user", body.message, db_path=DB_PATH)
    await save_message(body.planet_id, "assistant", reply, db_path=DB_PATH)

    return {"reply": reply, "planet_id": body.planet_id}
