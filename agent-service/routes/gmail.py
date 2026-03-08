"""Gmail integration routes for Solar AI OS."""

import os
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException

from skills import gmail as gmail_skill

router = APIRouter(prefix="/gmail", tags=["gmail"])
_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


@router.get("/status")
async def gmail_status() -> dict[str, Any]:
    """Return whether Gmail is configured."""
    return {
        "configured": gmail_skill.is_configured(),
        "setup_instructions": (
            None if gmail_skill.is_configured() else
            "1. Go to console.cloud.google.com\n"
            "2. Create a project and enable the Gmail API\n"
            "3. Create OAuth2 credentials (Desktop app)\n"
            "4. Download credentials.json and place it in agent-service/"
        ),
    }


@router.get("/unread")
async def get_unread() -> dict[str, Any]:
    """Return unread emails."""
    if not gmail_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail not configured. Check /gmail/status for setup instructions.",
        )
    try:
        messages = gmail_skill.list_unread(max_results=15)
        return {"count": len(messages), "messages": messages}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/summary")
async def get_gmail_summary() -> dict[str, Any]:
    """Return an AI-generated summary of unread emails."""
    if not gmail_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail not configured. Check /gmail/status for setup instructions.",
        )
    try:
        messages = gmail_skill.list_unread(max_results=15)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not messages:
        return {"summary": "No unread emails.", "count": 0}

    email_list = "\n".join(
        f"- From: {m['from']}\n  Subject: {m['subject']}\n  Preview: {m['snippet'][:120]}"
        for m in messages
    )
    prompt = (
        f"You are Solar, a sharp personal AI. Summarize these {len(messages)} unread emails "
        f"in 3-5 bullet points. Flag anything urgent or needing a reply. Be direct.\n\n{email_list}"
    )
    response = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    summary_text = response.content[0].text if response.content else "Unable to summarize."
    return {"summary": summary_text, "count": len(messages), "messages": messages}
