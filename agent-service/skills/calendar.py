"""Google Calendar skill — OAuth2 via DB-stored credentials, pure httpx."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite
import httpx

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
SERVICE = "calendar"
CAL_API = "https://www.googleapis.com/calendar/v3"
TOKEN_URI = "https://oauth2.googleapis.com/token"
TIMEOUT = 20  # seconds


# ── Credential & token helpers ────────────────────────────────────────────────

async def is_configured() -> bool:
    """Return True if client_id/secret AND a valid token exist in DB."""
    if USE_SUPABASE:
        cfg = supa_table("oauth_configs").select("id").eq("service", SERVICE).limit(1).execute()
        tok = supa_table("oauth_tokens").select("id").eq("service", SERVICE).limit(1).execute()
        return bool(cfg.data) and bool(tok.data)
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id FROM oauth_configs WHERE service = ?", (SERVICE,)
            ) as cur:
                has_config = await cur.fetchone() is not None
            async with db.execute(
                "SELECT id FROM oauth_tokens WHERE service = ?", (SERVICE,)
            ) as cur:
                has_token = await cur.fetchone() is not None
        return has_config and has_token


async def has_config() -> bool:
    """Return True if client credentials have been saved."""
    if USE_SUPABASE:
        result = supa_table("oauth_configs").select("id").eq("service", SERVICE).limit(1).execute()
        return bool(result.data)
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT id FROM oauth_configs WHERE service = ?", (SERVICE,)
            ) as cur:
                return await cur.fetchone() is not None


async def get_client_credentials() -> tuple[str, str] | None:
    """Return (client_id, client_secret) from DB, or None."""
    if USE_SUPABASE:
        result = supa_table("oauth_configs").select("client_id, client_secret").eq("service", SERVICE).limit(1).execute()
        row = result.data[0] if result.data else None
        if row is None:
            return None
        return row["client_id"], row["client_secret"]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT client_id, client_secret FROM oauth_configs WHERE service = ?",
                (SERVICE,),
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return row["client_id"], row["client_secret"]


async def save_config(client_id: str, client_secret: str) -> None:
    """Save or update OAuth client credentials."""
    if USE_SUPABASE:
        supa_table("oauth_configs").upsert({
            "id": "cfg-calendar",
            "service": SERVICE,
            "client_id": client_id,
            "client_secret": client_secret,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="service").execute()
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """
                INSERT INTO oauth_configs (id, service, client_id, client_secret)
                VALUES ('cfg-calendar', ?, ?, ?)
                ON CONFLICT(service) DO UPDATE SET
                    client_id = excluded.client_id,
                    client_secret = excluded.client_secret,
                    updated_at = datetime('now')
                """,
                (SERVICE, client_id, client_secret),
            )
            await db.commit()


async def save_token(token_data: dict[str, Any]) -> None:
    """Persist OAuth token dict to DB."""
    if USE_SUPABASE:
        supa_table("oauth_tokens").upsert({
            "id": "tok-calendar",
            "service": SERVICE,
            "access_token": token_data.get("access_token", ""),
            "refresh_token": token_data.get("refresh_token"),
            "token_expiry": token_data.get("expiry"),
            "scopes": json.dumps(token_data.get("scopes", SCOPES)),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="service").execute()
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """
                INSERT INTO oauth_tokens
                    (id, service, access_token, refresh_token, token_expiry, scopes)
                VALUES ('tok-calendar', ?, ?, ?, ?, ?)
                ON CONFLICT(service) DO UPDATE SET
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    token_expiry = excluded.token_expiry,
                    scopes = excluded.scopes,
                    updated_at = datetime('now')
                """,
                (
                    SERVICE,
                    token_data.get("access_token", ""),
                    token_data.get("refresh_token"),
                    token_data.get("expiry"),
                    json.dumps(token_data.get("scopes", SCOPES)),
                ),
            )
            await db.commit()


async def delete_token() -> None:
    """Remove stored token (disconnect)."""
    if USE_SUPABASE:
        supa_table("oauth_tokens").delete().eq("service", SERVICE).execute()
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("DELETE FROM oauth_tokens WHERE service = ?", (SERVICE,))
            await db.commit()


async def _get_access_token() -> str:
    """Return a valid Bearer token, refreshing via httpx if needed."""
    creds_pair = await get_client_credentials()
    if creds_pair is None:
        raise RuntimeError("Calendar not configured — save client credentials first.")
    client_id, client_secret = creds_pair

    if USE_SUPABASE:
        result = supa_table("oauth_tokens").select(
            "access_token, refresh_token, token_expiry"
        ).eq("service", SERVICE).limit(1).execute()
        row = result.data[0] if result.data else None
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT access_token, refresh_token, token_expiry FROM oauth_tokens"
                " WHERE service = ?",
                (SERVICE,),
            ) as cur:
                row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Calendar not authorized — complete the OAuth flow first.")

    access_token: str = row["access_token"]
    refresh_token: str | None = row["refresh_token"]
    token_expiry: str | None = row["token_expiry"]

    needs_refresh = False
    if not access_token or token_expiry is None:
        needs_refresh = True
    else:
        try:
            expiry_dt = datetime.fromisoformat(token_expiry)
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= expiry_dt - timedelta(minutes=5):
                needs_refresh = True
        except (ValueError, TypeError):
            needs_refresh = True

    if needs_refresh:
        if not refresh_token:
            raise RuntimeError(
                "Calendar token expired and no refresh token available. "
                "Please reconnect Calendar in Settings."
            )
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                TOKEN_URI,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            token_data = resp.json()

        expires_in = int(token_data.get("expires_in", 3600))
        new_expiry = (
            datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat()
        access_token = token_data["access_token"]
        await save_token({
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token", refresh_token),
            "expiry": new_expiry,
            "scopes": token_data.get("scope", "").split() or SCOPES,
        })
        logger.info("Calendar token refreshed, expires in %ds", expires_in)

    return access_token


# ── Event read helpers ────────────────────────────────────────────────────────

async def get_upcoming_events(days: int = 7) -> list[dict[str, Any]]:
    """Return upcoming events from the primary calendar for the next `days` days."""
    token = await _get_access_token()
    auth_headers = {"Authorization": f"Bearer {token}"}

    time_min = datetime.now(timezone.utc)
    time_max = time_min + timedelta(days=days)

    async with httpx.AsyncClient(timeout=TIMEOUT, headers=auth_headers) as client:
        resp = await client.get(
            f"{CAL_API}/calendars/primary/events",
            params={
                "timeMin": time_min.isoformat(),
                "timeMax": time_max.isoformat(),
                "maxResults": 20,
                "singleEvents": "true",
                "orderBy": "startTime",
            },
        )
        resp.raise_for_status()
        result = resp.json()

    events: list[dict[str, Any]] = []
    for item in result.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})
        event: dict[str, Any] = {
            "id": item.get("id", ""),
            "summary": item.get("summary", "(no title)"),
            "start": start.get("dateTime") or start.get("date", ""),
            "end": end.get("dateTime") or end.get("date", ""),
        }
        if item.get("location"):
            event["location"] = item["location"]
        if item.get("description"):
            event["description"] = item["description"][:200]
        events.append(event)

    return events


async def get_todays_events() -> list[dict[str, Any]]:
    """Return events occurring today (next 24 hours)."""
    return await get_upcoming_events(days=1)


def _fmt_event_time(start_raw: str) -> tuple[str, str]:
    """Return (date_str, time_str) for display, Windows-safe."""
    try:
        dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
        # Windows-safe: strip leading zeros manually
        date_str = dt.strftime("%a %b ") + str(dt.day)
        hour = dt.hour % 12 or 12
        time_str = f"{hour}:{dt.strftime('%M')} {dt.strftime('%p')}"
    except (ValueError, AttributeError):
        date_str = start_raw
        time_str = "all day"
    return date_str, time_str


async def get_events(days_ahead: int = 7) -> str:
    """Get upcoming calendar events for the next N days. Returns a formatted list."""
    if not await is_configured():
        return "Calendar not connected. Connect it in Settings."

    events = await get_upcoming_events(days=days_ahead)
    if not events:
        return f"No events in the next {days_ahead} days."

    lines: list[str] = []
    for e in events:
        date_str, time_str = _fmt_event_time(e.get("start", ""))
        lines.append(f"• {e.get('summary', '(no title)')} — {date_str} {time_str}")

    return f"Upcoming events (next {days_ahead} days):\n" + "\n".join(lines)


# ── Event write helpers ───────────────────────────────────────────────────────

async def create_event(
    title: str,
    date: str,
    time: str = "",
    duration_minutes: int = 60,
    description: str = "",
) -> str:
    """Create a calendar event. Returns confirmation or error string."""
    if not await is_configured():
        return "Calendar not connected. Connect it in Settings."

    token = await _get_access_token()
    auth_headers = {"Authorization": f"Bearer {token}"}

    body: dict[str, Any] = {"summary": title}
    if description:
        body["description"] = description

    if time:
        try:
            start_dt = datetime.fromisoformat(f"{date}T{time}:00")
        except ValueError:
            return f"Invalid date/time: {date} {time}. Use YYYY-MM-DD and HH:MM."
        end_dt = start_dt + timedelta(minutes=duration_minutes)
        body["start"] = {"dateTime": start_dt.isoformat(), "timeZone": "UTC"}
        body["end"] = {"dateTime": end_dt.isoformat(), "timeZone": "UTC"}
    else:
        body["start"] = {"date": date}
        body["end"] = {"date": date}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=auth_headers) as client:
            resp = await client.post(
                f"{CAL_API}/calendars/primary/events",
                json=body,
            )
            resp.raise_for_status()
        return f"Event created: {title} on {date}"
    except httpx.HTTPStatusError as exc:
        return f"Failed to create event: {exc.response.text}"
    except Exception as exc:  # noqa: BLE001
        return f"Failed to create event: {exc}"
