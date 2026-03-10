"""Proactive briefing route — Solar generates a status update for a planet,
plus daily briefing and schedule management endpoints."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite
from anthropic import AsyncAnthropic
from fastapi import APIRouter
from pydantic import BaseModel, Field

from db.schema import DB_PATH

router = APIRouter(prefix="/briefing", tags=["briefing"])

# Path to the JSON file storing the user's preferred briefing schedule.
_SCHEDULE_PATH = Path.home() / ".solar-ai" / "briefing_schedule.json"
_DEFAULT_SCHEDULE: dict[str, Any] = {"hour": 8, "minute": 0, "enabled": True}


def _get_client() -> AsyncAnthropic:
    """Create client lazily so env var is read at request time, not import time."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    return AsyncAnthropic(api_key=api_key)


# ── Daily briefing endpoints (registered BEFORE /{planet_id} wildcard) ────────


@router.get("/daily")
async def get_daily_briefing() -> dict[str, Any]:
    """Generate and return the morning briefing across all planets."""
    from main import latest_briefing  # noqa: PLC0415
    from skills.briefing import generate_briefing  # noqa: PLC0415

    text = await generate_briefing()
    notification_pending = latest_briefing.get("notification_pending", False)
    latest_briefing["notification_pending"] = False
    return {
        "briefing": text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "notification_pending": notification_pending,
    }


@router.get("/schedule")
async def get_briefing_schedule() -> dict[str, Any]:
    """Return the user's preferred briefing schedule."""
    if _SCHEDULE_PATH.exists():
        try:
            data: dict[str, Any] = json.loads(_SCHEDULE_PATH.read_text())
            return {
                "hour": int(data.get("hour", 8)),
                "minute": int(data.get("minute", 0)),
                "enabled": bool(data.get("enabled", True)),
            }
        except Exception:  # noqa: BLE001
            pass
    return dict(_DEFAULT_SCHEDULE)


class _ScheduleBody(BaseModel):
    hour: int = Field(..., ge=0, le=23)
    minute: int = Field(..., ge=0, le=59)
    enabled: bool = True


@router.post("/schedule")
async def set_briefing_schedule(body: _ScheduleBody) -> dict[str, Any]:
    """Save the user's preferred briefing schedule and reschedule the job."""
    schedule: dict[str, Any] = {
        "hour": body.hour,
        "minute": body.minute,
        "enabled": body.enabled,
    }
    _SCHEDULE_PATH.write_text(json.dumps(schedule))

    # Reschedule the APScheduler job if the scheduler is running.
    try:
        from main import scheduler  # noqa: PLC0415

        if scheduler.running:
            scheduler.reschedule_job(
                "daily_briefing",
                trigger="cron",
                hour=body.hour,
                minute=body.minute,
            )
            if not body.enabled:
                scheduler.pause_job("daily_briefing")
            else:
                scheduler.resume_job("daily_briefing")
    except Exception:  # noqa: BLE001
        pass  # Scheduler not yet started or job not found — applies on next restart.

    return {"ok": True, **schedule}


# ── Planet-specific briefing (wildcard — must come AFTER static routes) ───────


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

    project_line = f'Generate a structured status briefing for the project "{planet_name}".'
    prompt = (
        f"You are Solar, a sharp personal AI. {project_line}\n\n"
        f"Context:\n{context}\n\n"
        "Format your response as 3-5 bullet points using markdown (- **Topic:** detail). "
        "Use **bold** for the key topic/label at the start of each bullet. "
        "Be specific and actionable — cover status, blockers, next actions, and what's notable. "
        "No fluff, no intro sentences, no outro. Just the bullets. "
        "Sound like a sharp teammate giving a quick intel dump."
    )
    max_tokens = 350

    response = await _get_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    briefing_text = response.content[0].text if response.content else "No briefing available."

    return {"planet_id": planet_id, "planet_name": planet_name, "briefing": briefing_text}
