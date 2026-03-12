"""Chat endpoint — routes messages through Claude and persists history."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

import aiosqlite
import anthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import config
from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table
from memory.memory import (
    build_context_block,
    load_context,
    load_memories_categorized,
    load_user_profile,
    save_message,
    smart_extract_memories,
)
from skills import calendar as calendar_skill
from skills import file_reader as file_reader_skill
from skills import gmail as gmail_skill
from skills import shell as shell_skill
from skills import web_search as web_search_skill
from skills.permissions import log_action

router = APIRouter(prefix="/chat", tags=["chat"])

_anthropic_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    """Return a module-level Anthropic client, creating it once per process."""
    global _anthropic_client  # noqa: PLW0603
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=config.get_api_key())
    return _anthropic_client


BASE_SYSTEM_PROMPT = (
    "You are Solar, a personal AI built into the user's private 'Solar AI OS' dashboard. "
    "You are their central intelligence — the sun that everything orbits around. "
    "You are not a generic assistant. You are THEIR assistant, shaped by everything you've "
    "learned about them over time.\n\n"

    "Personality & tone:\n"
    "- Your primary directive is to mirror the user's communication style. Read their vocabulary, "
    "sentence length, energy, and formality. If they're casual and terse, match it exactly. "
    "If they're technical and detailed, rise to that. Never be more formal than they are.\n"
    "- Be warm and genuinely invested — like a sharp colleague who actually cares about their work, "
    "not a customer service bot.\n"
    "- Be direct and confident. Share opinions. Don't hedge everything.\n"
    "- Cut corporate filler entirely: no 'Certainly!', 'Great question!', 'Absolutely!', "
    "'Of course!', 'I'd be happy to'. Just answer.\n"
    "- Keep responses tight. Match the user's message length roughly. "
    "Short question → short answer. Detailed question → detailed answer.\n\n"

    "Memory & continuity:\n"
    "- You have persistent memory about this person. Use it actively, not passively.\n"
    "- Reference past context naturally when it's relevant: 'You mentioned...', "
    "'Given your goal to...', 'Last time we talked about this you said...'\n"
    "- Notice connections: if what they're saying now links to something you know about them, "
    "surface it. 'This sounds like it connects to [X you told me]...'\n"
    "- Never ask for information you already have stored.\n"
    "- Your personality adapts to who they are. The more you know about them, "
    "the more specifically Solar-for-them you become.\n\n"

    "Your job: help the user make real progress. Be proactive — notice patterns, "
    "surface what matters, push back gently when something seems off.\n\n"

    "Tools: use them proactively whenever the user asks for live data. "
    "Never say you can't access something if you have a tool for it."
)

# ── Tool definitions ──────────────────────────────────────────────────────────

_TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_gmail_summary",
        "description": (
            "Fetch and summarize the user's unread Gmail messages. "
            "Use this whenever the user asks about their email, inbox, unread messages, "
            "or wants a summary of what's going on in their Gmail."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_unread_emails",
        "description": (
            "Fetch the raw list of unread Gmail messages with sender, subject, date, "
            "and snippet. Use when the user wants to see specific emails, not just a summary."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_email_body",
        "description": (
            "Fetch the full body text of a specific email by its message ID. "
            "Use this when the user wants to read a specific email in full, "
            "or when you need the complete content of an email to answer a question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message_id": {
                    "type": "string",
                    "description": "The Gmail message ID (from get_unread_emails results)",
                }
            },
            "required": ["message_id"],
        },
    },
    {
        "name": "search_web",
        "description": (
            "Search the web for current information, news, facts, or research. "
            "Use this for anything that requires up-to-date information beyond your "
            "training data, or when the user asks you to look something up."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Number of results to return (default 5, max 10)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_url",
        "description": (
            "Fetch and read the content of any URL. Use this when the user pastes a link "
            "and wants a summary, or when you need to read a webpage to answer a question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch",
                }
            },
            "required": ["url"],
        },
    },
    {
        "name": "get_upcoming_events",
        "description": (
            "Fetch upcoming Google Calendar events. Use when the user asks about their "
            "schedule, calendar, meetings, or what's coming up."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of days ahead to look (default 7)",
                    "default": 7,
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_todays_events",
        "description": (
            "Fetch today's Google Calendar events. Use when the user asks what's "
            "happening today or wants their daily schedule."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_calendar_events",
        "description": (
            "Get upcoming calendar events for the next N days as a formatted list. "
            "Use this when the user wants a clear summary of upcoming events."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days ahead to look (default 7)",
                    "default": 7,
                }
            },
            "required": [],
        },
    },
    {
        "name": "create_calendar_event",
        "description": (
            "Create a new Google Calendar event. Use when the user asks to schedule, "
            "add, or create an event or meeting."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Event title",
                },
                "date": {
                    "type": "string",
                    "description": "Event date in YYYY-MM-DD format",
                },
                "time": {
                    "type": "string",
                    "description": (
                        "Start time in HH:MM (24-hour) format. "
                        "Omit to create an all-day event."
                    ),
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Duration in minutes (default 60). Ignored for all-day events.",
                    "default": 60,
                },
                "description": {
                    "type": "string",
                    "description": "Optional event description or notes",
                },
            },
            "required": ["title", "date"],
        },
    },
    {
        "name": "read_file",
        "description": (
            "Read the contents of a local file. Use this when the user asks you to "
            "read, review, summarise, or analyse a file on their computer. "
            "Supports: .txt, .md, .py, .js, .ts, .tsx, .json, .yaml, .yml, .csv, "
            ".html, .css files up to 1 MB."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "Absolute or ~ path to the file, e.g. ~/Documents/notes.md"
                    ),
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_shell_command",
        "description": (
            "Run a shell command on the user's computer and return the output. "
            "Use for tasks like listing files, running scripts, checking system info, "
            "or automating development tasks. Dangerous commands (rm, format, etc.) "
            "are automatically blocked. Always explain to the user what command you're "
            "about to run before running it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to run, e.g. 'ls ~/Documents'",
                },
                "working_dir": {
                    "type": "string",
                    "description": "Optional working directory (defaults to home directory)",
                },
            },
            "required": ["command"],
        },
    },
]

# Tools disabled in web mode (dangerous for hosted deployments).
_WEB_MODE_BLOCKED_TOOLS: set[str] = {"run_shell_command", "read_file"}

_WEB_MODE: bool = os.getenv("WEB_MODE", "false").lower() == "true"


def _get_tools() -> list[dict[str, Any]]:
    """Return the tool list, filtering out dangerous tools in web mode."""
    if _WEB_MODE:
        return [t for t in _TOOLS if t["name"] not in _WEB_MODE_BLOCKED_TOOLS]
    return _TOOLS


async def _run_tool(name: str, tool_input: dict[str, Any]) -> str:
    """Execute a tool by name and return a string result."""

    # Block dangerous tools in web mode even if called directly.
    if _WEB_MODE and name in _WEB_MODE_BLOCKED_TOOLS:
        return f"Tool '{name}' is disabled in web mode."

    # ── Gmail ─────────────────────────────────────────────────────────────────
    if name == "get_gmail_summary":
        if not await gmail_skill.is_configured():
            return "Gmail is not connected. The user needs to connect Gmail in Settings first."
        messages = await gmail_skill.list_unread(max_results=15)
        if not messages:
            return "No unread emails."
        lines = [
            f"- ID: {m['id']}\n  From: {m['from']}\n"
            f"  Subject: {m['subject']}\n  Preview: {m['snippet'][:150]}"
            for m in messages
        ]
        return f"{len(messages)} unread emails:\n\n" + "\n\n".join(lines)

    if name == "get_unread_emails":
        if not await gmail_skill.is_configured():
            return "Gmail is not connected. The user needs to connect Gmail in Settings first."
        messages = await gmail_skill.list_unread(max_results=15)
        if not messages:
            return "No unread emails."
        lines = [
            f"ID: {m['id']}\nFrom: {m['from']}\n"
            f"Subject: {m['subject']}\nDate: {m['date']}\n{m['snippet']}"
            for m in messages
        ]
        return "\n\n---\n\n".join(lines)

    if name == "get_email_body":
        if not await gmail_skill.is_configured():
            return "Gmail is not connected."
        message_id = tool_input.get("message_id", "")
        if not message_id:
            return "message_id is required."
        email = await gmail_skill.get_email_body(message_id)
        return (
            f"From: {email['from']}\n"
            f"Subject: {email['subject']}\n"
            f"Date: {email['date']}\n\n"
            f"{email['body']}"
        )

    # ── Web search ────────────────────────────────────────────────────────────
    if name == "search_web":
        query = tool_input.get("query", "")
        max_results = int(tool_input.get("max_results", 5))
        results = await web_search_skill.search_web(query, max_results=min(max_results, 10))
        if not results:
            return "No results found."
        lines = [
            f"**{r.get('title', 'No title')}**\n{r.get('url', '')}\n{r.get('content', '')[:300]}"
            for r in results
        ]
        return "\n\n---\n\n".join(lines)

    if name == "fetch_url":
        url = tool_input.get("url", "")
        if not url:
            return "url is required."
        return await web_search_skill.fetch_url(url)

    # ── Calendar ──────────────────────────────────────────────────────────────
    if name == "get_upcoming_events":
        if not await calendar_skill.is_configured():
            return (
                "Google Calendar is not connected. "
                "The user needs to connect Calendar in Settings first."
            )
        days = int(tool_input.get("days", 7))
        events = await calendar_skill.get_upcoming_events(days=days)
        if not events:
            return f"No events in the next {days} days."
        lines = [
            f"- {e.get('summary', 'Untitled')}\n"
            f"  Start: {e.get('start', '')}\n"
            f"  End: {e.get('end', '')}"
            + (f"\n  Location: {e['location']}" if e.get("location") else "")
            for e in events
        ]
        return f"Upcoming events ({days} days):\n\n" + "\n\n".join(lines)

    if name == "get_todays_events":
        if not await calendar_skill.is_configured():
            return (
                "Google Calendar is not connected. "
                "The user needs to connect Calendar in Settings first."
            )
        events = await calendar_skill.get_todays_events()
        if not events:
            return "No events today."
        lines = [
            f"- {e.get('summary', 'Untitled')}\n"
            f"  Start: {e.get('start', '')}\n"
            f"  End: {e.get('end', '')}"
            + (f"\n  Location: {e['location']}" if e.get("location") else "")
            for e in events
        ]
        return "Today's events:\n\n" + "\n\n".join(lines)

    if name == "get_calendar_events":
        days_ahead = int(tool_input.get("days_ahead", 7))
        return await calendar_skill.get_events(days_ahead=days_ahead)

    if name == "create_calendar_event":
        title = tool_input.get("title", "")
        date = tool_input.get("date", "")
        if not title or not date:
            return "title and date are required."
        return await calendar_skill.create_event(
            title=title,
            date=date,
            time=str(tool_input.get("time", "")),
            duration_minutes=int(tool_input.get("duration_minutes", 60)),
            description=str(tool_input.get("description", "")),
        )

    # ── File reader ───────────────────────────────────────────────────────────
    if name == "read_file":
        path = tool_input.get("path", "")
        if not path:
            return "path is required."
        return await file_reader_skill.read_file(path)

    # ── Shell ─────────────────────────────────────────────────────────────────
    if name == "run_shell_command":
        command = tool_input.get("command", "")
        if not command:
            return "command is required."
        result = await shell_skill.run_command(
            command=command,
            working_dir=tool_input.get("working_dir") or None,
        )
        if result["blocked"]:
            return f"Command blocked: {result['block_reason']}"
        output = result["output"] or "(no output)"
        return f"Exit code: {result['exit_code']}\n\n{output}"

    return f"Unknown tool: {name}"


@router.get("/history/{planet_id}")
async def get_chat_history(planet_id: str, request: Request, limit: int = 50) -> list[dict[str, str]]:
    """Return the last `limit` messages for a planet in chronological order."""
    uid = request.state.user_id
    return await load_context(planet_id, limit=limit, db_path=DB_PATH, user_id=uid)


class ChatRequest(BaseModel):
    planet_id: str
    message: str = Field("", max_length=32000)


async def _get_planet_name(planet_id: str, db_path: str = DB_PATH) -> str:
    """Look up a planet's display name, falling back to the id."""
    if planet_id == "sun":
        return "Main Agent"
    if USE_SUPABASE:
        result = (
            supa_table("planets")
            .select("name")
            .eq("id", planet_id)
            .limit(1)
            .execute()
        )
        return result.data[0]["name"] if result.data else planet_id
    else:
        async with aiosqlite.connect(db_path) as db:
            async with db.execute(
                "SELECT name FROM planets WHERE id = ?", (planet_id,)
            ) as cursor:
                row = await cursor.fetchone()
        return row[0] if row else planet_id


@router.post("")
async def chat(body: ChatRequest, request: Request) -> dict[str, Any]:
    # In web mode, use the per-user API key from the request
    api_key = getattr(request.state, "api_key", None) or config.get_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="API key not configured. Please add your Anthropic API key in Settings.",
        )
    uid = request.state.user_id

    planet_name = await _get_planet_name(body.planet_id)

    context = await load_context(body.planet_id, limit=20, db_path=DB_PATH, user_id=uid)
    profile = await load_user_profile(db_path=DB_PATH, user_id=uid)
    categorized = await load_memories_categorized(body.planet_id, db_path=DB_PATH, user_id=uid)
    context_block = build_context_block(planet_name, profile, categorized)

    system_prompt = f"{BASE_SYSTEM_PROMPT}\n\nCurrent project: {planet_name}"
    if context_block:
        system_prompt += f"\n\n{context_block}"

    # Use per-user client in web mode, shared client in desktop mode
    if request.state.api_key:
        client = anthropic.AsyncAnthropic(api_key=api_key)
    else:
        client = _get_client()
    messages: list[dict[str, Any]] = context + [{"role": "user", "content": body.message}]

    # Agentic loop: let Claude call tools until it produces a final text reply
    reply = ""
    response = None
    for _ in range(8):  # max 8 tool rounds
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            tools=_get_tools(),
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            tool_results = []
            assistant_content = []

            for block in response.content:
                assistant_content.append(block)
                if block.type == "tool_use":
                    try:
                        result = await _run_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })
                    except Exception as tool_exc:  # noqa: BLE001
                        logger.exception("Tool %s failed: %s", block.name, tool_exc)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": f"Tool error: {tool_exc}",
                            "is_error": True,
                        })

            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})
            continue

        for block in response.content:
            if hasattr(block, "text"):
                reply = block.text
                break
        break

    if not reply:
        reply = "Something went wrong generating a response."

    await save_message(body.planet_id, "user", body.message, db_path=DB_PATH, user_id=uid)
    await save_message(body.planet_id, "assistant", reply, db_path=DB_PATH, user_id=uid)

    if body.planet_id != "sun":
        if USE_SUPABASE:
            supa_table("planets").update({
                "last_activity_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", body.planet_id).eq("user_id", uid).execute()
        else:
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute(
                    "UPDATE planets SET last_activity_at = datetime('now') WHERE id = ? AND user_id = ?",
                    (body.planet_id, uid),
                )
                await db.commit()

    await smart_extract_memories(
        body.message, reply, body.planet_id, planet_name, api_key, db_path=DB_PATH, user_id=uid
    )

    if response is not None:
        usage = response.usage
        await log_action(
            skill="chat",
            summary=(
                f"[{planet_name}] {usage.input_tokens} in / {usage.output_tokens} out tokens"
            ),
            success=True,
        )

    return {"reply": reply, "planet_id": body.planet_id}


@router.post("/stream")
async def chat_stream(body: ChatRequest, request: Request) -> StreamingResponse:
    """Stream a chat response using Server-Sent Events."""
    _uid = request.state.user_id
    _user_api_key = getattr(request.state, "api_key", None)

    async def generate() -> Any:  # type: ignore[return]
        try:
            api_key = _user_api_key or config.get_api_key()
            if not api_key:
                yield f"data: {json.dumps({'type': 'error', 'message': 'API key not configured. Please add your Anthropic API key in Settings.'})}\n\n"
                return

            planet_name = await _get_planet_name(body.planet_id)

            context = await load_context(body.planet_id, limit=20, db_path=DB_PATH, user_id=_uid)
            profile = await load_user_profile(db_path=DB_PATH, user_id=_uid)
            categorized = await load_memories_categorized(body.planet_id, db_path=DB_PATH, user_id=_uid)
            context_block = build_context_block(planet_name, profile, categorized)

            system_prompt = f"{BASE_SYSTEM_PROMPT}\n\nCurrent project: {planet_name}"
            if context_block:
                system_prompt += f"\n\n{context_block}"

            client = anthropic.AsyncAnthropic(api_key=api_key) if _user_api_key else _get_client()
            messages: list[dict[str, Any]] = context + [{"role": "user", "content": body.message}]

            full_reply = ""

            # Agentic loop — up to 8 tool rounds
            for _ in range(8):
                async with client.messages.stream(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    system=system_prompt,
                    tools=_get_tools(),
                    messages=messages,
                ) as stream:
                    round_text = ""
                    async for text in stream.text_stream:
                        round_text += text
                        yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
                    final = await stream.get_final_message()

                full_reply += round_text

                if final.stop_reason == "tool_use":
                    tool_results = []
                    assistant_content = list(final.content)

                    for block in final.content:
                        if block.type == "tool_use":
                            yield f"data: {json.dumps({'type': 'tool_start', 'name': block.name})}\n\n"
                            try:
                                result = await _run_tool(block.name, block.input)
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": result,
                                })
                            except Exception as tool_exc:  # noqa: BLE001
                                logger.exception("Stream tool %s failed: %s", block.name, tool_exc)
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": f"Tool error: {tool_exc}",
                                    "is_error": True,
                                })
                            yield f"data: {json.dumps({'type': 'tool_end', 'name': block.name})}\n\n"

                    messages.append({"role": "assistant", "content": assistant_content})
                    messages.append({"role": "user", "content": tool_results})
                    continue

                # end_turn — done
                break

            if not full_reply:
                full_reply = "Something went wrong generating a response."

            # Save messages and extract memories before signalling done
            await save_message(body.planet_id, "user", body.message, db_path=DB_PATH, user_id=_uid)
            await save_message(body.planet_id, "assistant", full_reply, db_path=DB_PATH, user_id=_uid)

            if body.planet_id != "sun":
                if USE_SUPABASE:
                    supa_table("planets").update({
                        "last_activity_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", body.planet_id).eq("user_id", _uid).execute()
                else:
                    async with aiosqlite.connect(DB_PATH) as db:
                        await db.execute(
                            "UPDATE planets SET last_activity_at = datetime('now') WHERE id = ? AND user_id = ?",
                            (body.planet_id, _uid),
                        )
                        await db.commit()

            await smart_extract_memories(
                body.message, full_reply, body.planet_id, planet_name, api_key, db_path=DB_PATH, user_id=_uid
            )

            yield f"data: {json.dumps({'type': 'done', 'planet_id': body.planet_id})}\n\n"

        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
