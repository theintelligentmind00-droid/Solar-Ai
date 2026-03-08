"""Gmail skill — OAuth2 via DB-stored credentials."""
from __future__ import annotations

import json
from typing import Any

import aiosqlite

from db.schema import DB_PATH

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
SERVICE = "gmail"


async def is_configured() -> bool:
    """Return True if client_id/secret AND a valid token exist in DB."""
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
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id FROM oauth_configs WHERE service = ?", (SERVICE,)
        ) as cur:
            return await cur.fetchone() is not None


async def get_client_credentials() -> tuple[str, str] | None:
    """Return (client_id, client_secret) from DB, or None."""
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
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM oauth_tokens WHERE service = ?", (SERVICE,))
        await db.commit()


async def get_service() -> Any:
    """Return an authenticated Gmail API service using DB-stored credentials."""
    try:
        from google.auth.transport.requests import Request  # type: ignore[import]
        from google.oauth2.credentials import Credentials  # type: ignore[import]
        from googleapiclient.discovery import build  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "Gmail dependencies not installed. "
            "Run: pip install google-auth google-auth-oauthlib google-api-python-client"
        ) from exc

    creds_pair = await get_client_credentials()
    if creds_pair is None:
        raise RuntimeError("Gmail not configured — save client credentials first.")

    client_id, client_secret = creds_pair

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

    creds = Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        await save_token({
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "scopes": list(creds.scopes or SCOPES),
        })

    return build("gmail", "v1", credentials=creds)


async def list_unread(max_results: int = 10) -> list[dict[str, Any]]:
    """Return a list of unread message snippets."""
    service = await get_service()
    result = (
        service.users()
        .messages()
        .list(userId="me", q="is:unread", maxResults=max_results)
        .execute()
    )
    messages = result.get("messages", [])
    output: list[dict[str, Any]] = []
    for msg in messages:
        detail = (
            service.users()
            .messages()
            .get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            )
            .execute()
        )
        headers = {
            h["name"]: h["value"]
            for h in detail.get("payload", {}).get("headers", [])
        }
        output.append({
            "id": msg["id"],
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", "(no subject)"),
            "date": headers.get("Date", ""),
            "snippet": detail.get("snippet", ""),
        })
    return output
