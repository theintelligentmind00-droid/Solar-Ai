"""Gmail skill — read-only email access via OAuth2."""

from __future__ import annotations

from pathlib import Path
from typing import Any

CREDENTIALS_PATH = Path(__file__).parent.parent / "credentials.json"
TOKEN_PATH = Path(__file__).parent.parent / "gmail_token.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def is_configured() -> bool:
    """Return True if credentials.json exists on disk."""
    return CREDENTIALS_PATH.exists()


def get_service() -> Any:
    """Return an authenticated Gmail API service, or raise if not configured."""
    if not is_configured():
        raise RuntimeError(
            "Gmail not configured. Download credentials.json from Google Cloud Console "
            "and place it in the agent-service/ directory."
        )

    try:
        from google.auth.transport.requests import Request  # type: ignore[import]
        from google.oauth2.credentials import Credentials  # type: ignore[import]
        from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore[import]
        from googleapiclient.discovery import build  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "Gmail dependencies not installed. "
            "Run: pip install google-auth google-auth-oauthlib google-api-python-client"
        ) from exc

    creds: Credentials | None = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def list_unread(max_results: int = 10) -> list[dict[str, Any]]:
    """Return a list of unread message snippets."""
    service = get_service()
    result = service.users().messages().list(  # type: ignore[attr-defined]
        userId="me", q="is:unread", maxResults=max_results
    ).execute()

    messages = result.get("messages", [])
    output: list[dict[str, Any]] = []
    for msg in messages:
        detail = service.users().messages().get(  # type: ignore[attr-defined]
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"]
        ).execute()
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        output.append({
            "id": msg["id"],
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", "(no subject)"),
            "date": headers.get("Date", ""),
            "snippet": detail.get("snippet", ""),
        })
    return output
