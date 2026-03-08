"""Gmail integration routes — OAuth2 flow + email access."""

from __future__ import annotations

import os
import secrets
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from skills import gmail as gmail_skill

router = APIRouter(prefix="/gmail", tags=["gmail"])
_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# In-memory CSRF state store: {state: True}  (expires on use)
_pending_states: dict[str, bool] = {}

REDIRECT_URI = "http://localhost:8000/gmail/callback"


class GmailConfigBody(BaseModel):
    client_id: str
    client_secret: str


# ── Setup & OAuth flow ────────────────────────────────────────────────────────

@router.get("/status")
async def gmail_status() -> dict[str, Any]:
    """Return connection status and whether credentials are saved."""
    configured = await gmail_skill.has_config()
    connected = await gmail_skill.is_configured()
    return {
        "configured": configured,
        "connected": connected,
        "redirect_uri": REDIRECT_URI,
    }


@router.post("/configure")
async def configure_gmail(body: GmailConfigBody) -> dict[str, Any]:
    """Save Google OAuth client credentials."""
    if not body.client_id.strip() or not body.client_secret.strip():
        raise HTTPException(status_code=422, detail="client_id and client_secret are required.")
    await gmail_skill.save_config(body.client_id.strip(), body.client_secret.strip())
    return {"ok": True, "message": "Gmail credentials saved."}


@router.get("/auth-url")
async def get_auth_url() -> dict[str, str]:
    """Generate a Google OAuth2 authorization URL."""
    creds = await gmail_skill.get_client_credentials()
    if creds is None:
        raise HTTPException(
            status_code=400,
            detail="Gmail not configured. POST /gmail/configure first.",
        )

    client_id, _ = creds
    state = secrets.token_urlsafe(32)
    _pending_states[state] = True

    scope = "https://www.googleapis.com/auth/gmail.readonly"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        f"&scope={scope}"
        "&access_type=offline"
        "&prompt=consent"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/callback", response_class=HTMLResponse)
async def gmail_callback(
    code: str = Query(...),
    state: str = Query(...),
) -> HTMLResponse:
    """Handle Google OAuth2 callback, exchange code for token."""
    if state not in _pending_states:
        return HTMLResponse(
            _callback_page("error", "Invalid or expired state token. Please try again."),
            status_code=400,
        )
    del _pending_states[state]

    creds = await gmail_skill.get_client_credentials()
    if creds is None:
        return HTMLResponse(
            _callback_page("error", "Gmail not configured on server."),
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
        return HTMLResponse(
            _callback_page("error", f"Token exchange failed: {exc}"),
            status_code=500,
        )

    await gmail_skill.save_token({
        "access_token": token_data.get("access_token", ""),
        "refresh_token": token_data.get("refresh_token"),
        "expiry": None,
        "scopes": token_data.get("scope", "").split(),
    })

    return HTMLResponse(_callback_page("success", "Gmail connected! You can close this tab."))


@router.delete("/disconnect")
async def disconnect_gmail() -> dict[str, str]:
    """Remove stored Gmail token (revokes local access)."""
    await gmail_skill.delete_token()
    return {"ok": "disconnected"}


# ── Email access ──────────────────────────────────────────────────────────────

@router.get("/unread")
async def get_unread() -> dict[str, Any]:
    """Return unread emails."""
    if not await gmail_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail not connected. Complete the OAuth flow first.",
        )
    try:
        messages = await gmail_skill.list_unread(max_results=15)
        return {"count": len(messages), "messages": messages}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/summary")
async def get_gmail_summary() -> dict[str, Any]:
    """Return an AI-generated summary of unread emails."""
    if not await gmail_skill.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail not connected. Complete the OAuth flow first.",
        )
    try:
        messages = await gmail_skill.list_unread(max_results=15)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not messages:
        return {"summary": "No unread emails.", "count": 0}

    email_list = "\n".join(
        f"- From: {m['from']}\n  Subject: {m['subject']}\n  Preview: {m['snippet'][:120]}"
        for m in messages
    )
    prompt = (
        f"You are Solar, a sharp personal AI. Summarize these {len(messages)} unread"
        f" emails in 3-5 bullet points. Flag anything urgent or needing a reply."
        f" Be direct.\n\n{email_list}"
    )
    response = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    summary_text = (
        response.content[0].text if response.content else "Unable to summarize."
    )
    return {"summary": summary_text, "count": len(messages), "messages": messages}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _callback_page(status: str, message: str) -> str:
    icon = "\u2713" if status == "success" else "\u2717"
    color = "#4ade80" if status == "success" else "#f87171"
    return f"""<!DOCTYPE html>
<html>
<head>
  <title>Solar AI \u2014 Gmail {status}</title>
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
    <p class="msg">{message}</p>
    <p class="close">You can close this window.</p>
  </div>
</body>
</html>"""
