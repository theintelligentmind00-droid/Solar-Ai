"""Setup routes — API key management via OS keychain."""

import logging
import os
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/setup", tags=["setup"])

# Keyring identifiers — must match config.py
_KEYRING_SERVICE = "solar-ai-os"
_KEYRING_USERNAME = "anthropic_api_key"

# Local .env fallback: ~/.solar-ai/.env (user home dir — writable in packaged app)
_ENV_PATH = Path.home() / ".solar-ai" / ".env"

_KEY_RE = re.compile(r"^sk-ant-.{10,}$")


class ApiKeyPayload(BaseModel):
    api_key: str

    @field_validator("api_key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        v = v.strip()
        if not _KEY_RE.match(v):
            raise ValueError("Key must start with 'sk-ant-' and be at least 17 characters")
        return v


def _update_env_file(key: str, value: str) -> None:
    """Write or update a KEY=VALUE line in the .env file."""
    lines: list[str] = []
    if _ENV_PATH.exists():
        lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()

    updated = False
    new_lines: list[str] = []
    for line in lines:
        if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
            new_lines.append(f"{key}={value}")
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.append(f"{key}={value}")

    _ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def _remove_from_env_file(key: str) -> None:
    """Remove a KEY=VALUE line from the .env file if present."""
    if not _ENV_PATH.exists():
        return
    lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()
    new_lines = [
        line for line in lines
        if not (line.startswith(f"{key}=") or line.startswith(f"{key} ="))
    ]
    _ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@router.post("/api-key")
async def save_api_key(payload: ApiKeyPayload) -> dict[str, bool]:
    """Persist the Anthropic API key to the OS keychain and agent-service/.env (fallback)."""
    # 1. Save to OS keychain
    try:
        import keyring  # type: ignore[import-untyped]

        keyring.set_password(_KEYRING_SERVICE, _KEYRING_USERNAME, payload.api_key)
    except Exception:
        logger.warning("Keychain unavailable — falling back to .env for API key storage")

    # 2. Save to .env as fallback / development convenience
    _update_env_file("ANTHROPIC_API_KEY", payload.api_key)

    # 3. Hot-load into the current process so subsequent requests use it immediately
    os.environ["ANTHROPIC_API_KEY"] = payload.api_key

    return {"ok": True}


@router.get("/api-key/status")
async def get_api_key_status() -> dict[str, bool]:
    """Return whether an API key is configured in keyring, environment, or .env."""
    # Check keyring
    try:
        import keyring  # type: ignore[import-untyped]

        stored = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
        if stored:
            return {"configured": True}
    except Exception:
        logger.warning("Failed to read API key from keychain — checking other sources")

    # Check environment variable
    if os.environ.get("ANTHROPIC_API_KEY"):
        return {"configured": True}

    # Check .env file
    if _ENV_PATH.exists():
        content = _ENV_PATH.read_text(encoding="utf-8")
        for line in content.splitlines():
            if line.startswith("ANTHROPIC_API_KEY=") or line.startswith("ANTHROPIC_API_KEY ="):
                value = line.split("=", 1)[1].strip()
                if value:
                    return {"configured": True}

    return {"configured": False}


@router.delete("/api-key")
async def delete_api_key() -> dict[str, bool]:
    """Remove the Anthropic API key from keyring and .env."""
    # Remove from OS keychain
    try:
        import keyring  # type: ignore[import-untyped]
        import keyring.errors  # type: ignore[import-untyped]

        keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
    except Exception:
        logger.warning("Could not delete API key from keyring — key may not exist")

    # Remove from .env file
    _remove_from_env_file("ANTHROPIC_API_KEY")

    # Clear from running process environment
    os.environ.pop("ANTHROPIC_API_KEY", None)

    return {"ok": True}


@router.get("/profile")
async def get_user_profile() -> dict[str, Any]:
    """Return the user personality profile as a key→value dict."""
    from memory.memory import load_user_profile

    profile = await load_user_profile()
    return {"profile": profile}
