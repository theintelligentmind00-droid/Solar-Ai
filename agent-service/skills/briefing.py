"""Daily briefing generator — combines email, calendar, and tasks into an AI summary."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import aiosqlite
import anthropic

import config
from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table


async def _get_calendar_context() -> str:
    """Fetch today's calendar events, or a placeholder if unavailable."""
    try:
        from skills import calendar as calendar_skill  # noqa: PLC0415

        if not await calendar_skill.is_configured():
            return "Calendar not connected."
        events = await calendar_skill.get_todays_events()
        if not events:
            return "Nothing scheduled today."
        lines: list[str] = []
        for e in events:
            start_raw: str = e.get("start", "")
            try:
                dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                time_str = dt.strftime("%#I:%M %p") if os.name == "nt" else dt.strftime("%-I:%M %p")
            except (ValueError, AttributeError):
                time_str = "all day"
            summary: str = e.get("summary", "(no title)")
            lines.append(f"• {summary} — {time_str}")
        return "\n".join(lines)
    except Exception:  # noqa: BLE001
        return "Calendar unavailable."


async def _get_gmail_context() -> str:
    """Fetch unread email summary, or a placeholder if unavailable."""
    try:
        from skills import gmail as gmail_skill  # noqa: PLC0415

        if not await gmail_skill.is_configured():
            return "Gmail not connected."
        messages = await gmail_skill.list_unread(max_results=10)
        if not messages:
            return "No unread emails."
        lines: list[str] = [
            f"• From: {m['from']} — {m['subject']}" for m in messages[:5]
        ]
        count = len(messages)
        suffix = f"\n(+ {count - 5} more)" if count > 5 else ""
        return "\n".join(lines) + suffix
    except Exception:  # noqa: BLE001
        return "Gmail unavailable."


async def _get_tasks_context(planet_id: str | None = None) -> str:
    """Fetch top open tasks from DB, optionally filtered by planet."""
    try:
        if USE_SUPABASE:
            query = supa_table("tasks").select("title, status, priority").neq("status", "done")
            if planet_id:
                query = query.eq("planet_id", planet_id)
            query = query.order("priority").limit(20)
            result = query.execute()
            rows = result.data or []
            # Sort by priority in Python (Supabase sorts alphabetically, not by custom order)
            priority_order = {"high": 1, "medium": 2, "low": 3}
            rows.sort(key=lambda r: priority_order.get(r.get("priority", "low"), 3))
        else:
            async with aiosqlite.connect(DB_PATH) as db:
                db.row_factory = aiosqlite.Row
                if planet_id:
                    async with db.execute(
                        """
                        SELECT title, status, priority FROM tasks
                        WHERE status != 'done' AND planet_id = ?
                        ORDER BY CASE priority WHEN 'high' THEN 1
                                              WHEN 'medium' THEN 2
                                              ELSE 3 END
                        LIMIT 20
                        """,
                        (planet_id,),
                    ) as cur:
                        rows = [dict(r) for r in await cur.fetchall()]
                else:
                    async with db.execute(
                        """
                        SELECT title, status, priority FROM tasks
                        WHERE status != 'done'
                        ORDER BY CASE priority WHEN 'high' THEN 1
                                              WHEN 'medium' THEN 2
                                              ELSE 3 END
                        LIMIT 20
                        """
                    ) as cur:
                        rows = [dict(r) for r in await cur.fetchall()]
        if not rows:
            return "No open tasks."
        lines = [
            f"• [{r['priority'].upper()}] {r['title']} ({r['status']})"
            for r in rows
        ]
        return "\n".join(lines)
    except Exception:  # noqa: BLE001
        return "Tasks unavailable."


async def _get_memories_context(planet_id: str | None = None) -> str:
    """Fetch recent memories from DB."""
    try:
        if USE_SUPABASE:
            query = supa_table("memories").select("key, value")
            if planet_id:
                query = query.or_(f"planet_id.eq.{planet_id},planet_id.is.null")
            query = query.order("created_at", desc=True).limit(10)
            result = query.execute()
            rows = result.data or []
        else:
            async with aiosqlite.connect(DB_PATH) as db:
                db.row_factory = aiosqlite.Row
                if planet_id:
                    async with db.execute(
                        """
                        SELECT key, value FROM memories
                        WHERE planet_id = ? OR planet_id IS NULL
                        ORDER BY created_at DESC LIMIT 10
                        """,
                        (planet_id,),
                    ) as cur:
                        rows = [dict(r) for r in await cur.fetchall()]
                else:
                    async with db.execute(
                        "SELECT key, value FROM memories ORDER BY created_at DESC LIMIT 10"
                    ) as cur:
                        rows = [dict(r) for r in await cur.fetchall()]
        if not rows:
            return ""
        return "\n".join(f"- {r['key']}: {r['value']}" for r in rows)
    except Exception:  # noqa: BLE001
        return ""


async def generate_briefing(planet_id: str | None = None) -> str:
    """Generate a morning briefing.

    If planet_id is given, focus on that planet's tasks and memories.
    Returns a formatted markdown string.
    """
    api_key = config.get_api_key()
    if not api_key:
        return "Briefing unavailable — API key not set."

    _d_fmt = "%#d" if os.name == "nt" else "%-d"
    today = datetime.now(timezone.utc).strftime(f"%A, %B {_d_fmt}, %Y")

    calendar_context, gmail_context, tasks_context, memories_context = (
        await _get_calendar_context(),
        await _get_gmail_context(),
        await _get_tasks_context(planet_id),
        await _get_memories_context(planet_id),
    )

    context_block = (
        f"TODAY'S DATE: {today}\n\n"
        f"CALENDAR:\n{calendar_context}\n\n"
        f"EMAIL:\n{gmail_context}\n\n"
        f"OPEN TASKS:\n{tasks_context}"
    )
    if memories_context:
        context_block += f"\n\nMEMORIES:\n{memories_context}"

    system_prompt = (
        "You are generating a morning briefing for the user of Solar AI OS. "
        "Be concise and actionable. Use the context provided below.\n\n"
        f"Format your response EXACTLY as:\n"
        f"## Good morning! Here's your briefing for {today}\n"
        "### Today's Schedule\n"
        "[calendar events or 'Nothing scheduled']\n"
        "### Email Highlights\n"
        "[email summary or 'No new emails / Gmail not connected']\n"
        "### Top Priorities\n"
        "[top 5 tasks by priority]\n"
        "### Quick Insight\n"
        "[one short AI observation based on the context — be specific and useful]"
    )

    user_message = f"Here is the current context:\n\n{context_block}"

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        content: list[Any] = response.content
        if content and hasattr(content[0], "text"):
            return content[0].text
        return "Briefing could not be generated."
    except Exception as exc:  # noqa: BLE001
        return f"Briefing error: {exc}"
