"""Gmail skill — OAuth2 via DB-stored credentials, pure httpx (no httplib2)."""
from __future__ import annotations

import asyncio
import base64
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

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
SERVICE = "gmail"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1"
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
            "id": "cfg-gmail",
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
                VALUES ('cfg-gmail', ?, ?, ?)
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
            "id": "tok-gmail",
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
                VALUES ('tok-gmail', ?, ?, ?, ?, ?)
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
        raise RuntimeError("Gmail not configured — save client credentials first.")
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
        raise RuntimeError("Gmail not authorized — complete the OAuth flow first.")

    access_token: str = row["access_token"]
    refresh_token: str | None = row["refresh_token"]
    token_expiry: str | None = row["token_expiry"]

    # Determine whether the token needs refreshing.
    needs_refresh = False
    if not access_token or token_expiry is None:
        needs_refresh = True
    else:
        try:
            expiry_dt = datetime.fromisoformat(token_expiry)
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            # Refresh 5 minutes before actual expiry.
            if datetime.now(timezone.utc) >= expiry_dt - timedelta(minutes=5):
                needs_refresh = True
        except (ValueError, TypeError):
            needs_refresh = True

    if needs_refresh:
        if not refresh_token:
            raise RuntimeError(
                "Gmail token expired and no refresh token available. "
                "Please reconnect Gmail in Settings."
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
        logger.info("Gmail token refreshed, expires in %ds", expires_in)

    return access_token


# ── Email access ──────────────────────────────────────────────────────────────

async def list_unread(max_results: int = 10) -> list[dict[str, Any]]:
    """Return a list of unread message snippets."""
    token = await _get_access_token()
    auth_headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=TIMEOUT, headers=auth_headers) as client:
        # 1. List message IDs
        resp = await client.get(
            f"{GMAIL_API}/users/me/messages",
            params={"q": "is:unread", "maxResults": max_results},
        )
        resp.raise_for_status()
        messages = resp.json().get("messages", [])
        if not messages:
            return []

        # 2. Fetch metadata for each message concurrently
        async def _fetch_one(msg_id: str) -> dict[str, Any]:
            r = await client.get(
                f"{GMAIL_API}/users/me/messages/{msg_id}",
                params={
                    "format": "metadata",
                    "metadataHeaders": ["From", "Subject", "Date"],
                },
            )
            r.raise_for_status()
            return r.json()

        details = await asyncio.gather(*[_fetch_one(m["id"]) for m in messages])

    output: list[dict[str, Any]] = []
    for msg, detail in zip(messages, details):
        hdrs = {
            h["name"]: h["value"]
            for h in detail.get("payload", {}).get("headers", [])
        }
        output.append({
            "id": msg["id"],
            "from": hdrs.get("From", ""),
            "subject": hdrs.get("Subject", "(no subject)"),
            "date": hdrs.get("Date", ""),
            "snippet": detail.get("snippet", ""),
        })
    return output


async def get_email_body(message_id: str) -> dict[str, Any]:
    """Fetch the full body text of a single email by message ID."""
    token = await _get_access_token()
    auth_headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=TIMEOUT, headers=auth_headers) as client:
        r = await client.get(
            f"{GMAIL_API}/users/me/messages/{message_id}",
            params={"format": "full"},
        )
        r.raise_for_status()
        detail = r.json()

    hdrs = {
        h["name"]: h["value"]
        for h in detail.get("payload", {}).get("headers", [])
    }

    def _extract_text(payload: dict[str, Any]) -> str:
        mime = payload.get("mimeType", "")
        if mime == "text/plain":
            data = payload.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data + "==").decode(
                    "utf-8", errors="replace"
                )
        if mime.startswith("multipart/"):
            for part in payload.get("parts", []):
                text = _extract_text(part)
                if text:
                    return text
        return ""

    body = _extract_text(detail.get("payload", {}))
    if not body:
        body = detail.get("snippet", "(no body)")

    return {
        "id": message_id,
        "from": hdrs.get("From", ""),
        "subject": hdrs.get("Subject", "(no subject)"),
        "date": hdrs.get("Date", ""),
        "body": body[:6000],
    }
