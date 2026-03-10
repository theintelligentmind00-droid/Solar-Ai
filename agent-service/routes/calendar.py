"""Google Calendar integration routes — OAuth2 flow + event access."""

from __future__ import annotations

import html
import logging
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from skills import calendar as calendar_skill

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar"])

# In-memory CSRF state store: {state: issued_at_timestamp}
_STATE_TTL = 600  # seconds
_pending_states: dict[str, float] = {}

REDIRECT_URI = "http://localhost:8000/calendar/callback"
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"


class CreateEventBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(default="", pattern=r"^(\d{2}:\d{2})?$")
    duration_minutes: int = Field(default=60, ge=1, le=1440)
    description: str = Field(default="", max_length=2000)


def _purge_expired_states() -> None:
    """Remove state tokens older than TTL."""
    cutoff = time.monotonic() - _STATE_TTL
    expired = [k for k, v in _pending_states.items() if v < cutoff]
    for k in expired:
        del _pending_states[k]


# ── Status & OAuth flow ───────────────────────────────────────────────────────

@router.get("/status")
async def calendar_status() -> dict[str, Any]:
    """Return connection status and whether credentials are saved."""
    configured = await calendar_skill.has_config()
    connected = await calendar_skill.is_configured()
    return {
        "configured": configured,
        "connected": connected,
        "redirect_uri": REDIRECT_URI,
    }


@router.post("/auth-url")
async def get_auth_url() -> dict[str, str]:
    """Generate a Google OAuth2 authorization URL for Calendar."""
    # Reuse Gmail credentials if Calendar credentials are not separately stored.
    creds = await calendar_skill.get_client_credentials()
    if creds is None:
        # Fall back to Gmail credentials so the user doesn't have to re-enter them.
        try:
            from skills import gmail as gmail_skill  # local import to avoid circular risk

            gmail_creds = await gmail_skill.get_client_credentials()
            if gmail_creds is not None:
                gmail_id, gmail_secret = gmail_creds
                await calendar_skill.save_config(gmail_id, gmail_secret)
                creds = (gmail_id, gmail_secret)
        except Exception:
            pass

    if creds is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Calendar not configured. "
                "Either configure Gmail first (credentials will be reused) "
                "or POST /calendar/configure."
            ),
        )

    _purge_expired_states()
    client_id, _ = creds
    state = secrets.token_urlsafe(32)
    _pending_states[state] = time.monotonic()

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        f"&scope={CALENDAR_SCOPE}"
        "&access_type=offline"
        "&prompt=consent"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/callback", response_class=HTMLResponse)
async def calendar_callback(
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str | None = Query(default=None),
) -> HTMLResponse:
    """Handle Google OAuth2 callback, exchange code for token."""
    if error:
        return HTMLResponse(
            _callback_page(
                "error",
                f"Google denied access: {html.escape(error)}. "
                "You can try again from the Settings panel.",
            ),
            status_code=400,
        )

    _purge_expired_states()

    issued_at = _pending_states.pop(state, None)
    if issued_at is None or (time.monotonic() - issued_at) > _STATE_TTL:
        return HTMLResponse(
            _callback_page("error", "Invalid or expired authorization request. Please try again."),
            status_code=400,
        )

    creds = await calendar_skill.get_client_credentials()
    if creds is None:
        return HTMLResponse(
            _callback_page("error", "Calendar not configured on server."),
            status_code=500,
        )
    client_id, client_secret = creds

    try:
        import httpx

        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        resp.raise_for_status()
        token_data = resp.json()
    except Exception as exc:
        logger.error("Calendar token exchange failed: %s", exc)
        return HTMLResponse(
            _callback_page("error", "Authorization failed. Please try again."),
            status_code=500,
        )

    import datetime as _dt
    _expires_in = int(token_data.get("expires_in", 3600))
    _expiry_iso = (
        _dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=_expires_in)
    ).isoformat()

    await calendar_skill.save_token({
        "access_token": token_data.get("access_token", ""),
        "refresh_token": token_data.get("refresh_token"),
        "expiry": _expiry_iso,
        "scopes": token_data.get("scope", "").split(),
    })

    msg = "Google Calendar connected! You can close this tab."
    return HTMLResponse(_callback_page("success", msg))


@router.delete("/disconnect")
async def disconnect_calendar() -> dict[str, str]:
    """Remove stored Calendar token (revokes local access)."""
    await calendar_skill.delete_token()
    return {"ok": "disconnected"}


# ── Event access ──────────────────────────────────────────────────────────────

@router.get("/events")
async def get_events(days: int = Query(default=7, ge=1, le=365)) -> dict[str, Any]:
    """Return upcoming calendar events as a formatted string."""
    if not await calendar_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Calendar not connected. Complete the OAuth flow first.",
        )
    try:
        events_text = await calendar_skill.get_events(days_ahead=days)
        return {"events": events_text}
    except Exception as exc:
        logger.error("Failed to fetch calendar events: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch events.") from exc


@router.post("/event")
async def create_event(body: CreateEventBody) -> dict[str, Any]:
    """Create a new calendar event."""
    if not await calendar_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Calendar not connected. Complete the OAuth flow first.",
        )
    try:
        result = await calendar_skill.create_event(
            title=body.title,
            date=body.date,
            time=body.time,
            duration_minutes=body.duration_minutes,
            description=body.description,
        )
        return {"result": result}
    except Exception as exc:
        logger.error("Failed to create calendar event: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create event.") from exc


# ── Helpers ───────────────────────────────────────────────────────────────────

def _callback_page(status: str, message: str) -> str:
    icon = "\u2713" if status == "success" else "\u2717"
    color = "#4ade80" if status == "success" else "#f87171"
    safe_message = html.escape(message)
    return f"""<!DOCTYPE html>
<html>
<head>
  <title>Solar AI \u2014 Calendar {status}</title>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'">
  <style>
    body {{
      margin: 0; font-family: -apple-system, sans-serif;
      background: #07070f; color: white;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; text-align: center;
    }}
    .icon {{ font-size: 3rem; color: {color}; margin-bottom: 1rem; }}
    .msg {{ font-size: 1rem; color: #a0aec0; max-width: 320px; }}
    .close {{ margin-top: 1.5rem; font-size: 0.8rem; color: #4a5568; }}
  </style>
</head>
<body>
  <div>
    <div class="icon">{icon}</div>
    <p class="msg">{safe_message}</p>
    <p class="close">You can close this window.</p>
  </div>
</body>
</html>"""
