"""Central configuration helpers for Solar AI OS agent service."""

import os
from pathlib import Path

from dotenv import dotenv_values

# Keyring service/username identifiers — must match what setup.py writes
_KEYRING_SERVICE = "solar-ai-os"
_KEYRING_USERNAME = "anthropic_api_key"

# Path to the local .env file written by the setup route
_ENV_PATH = Path(__file__).parent / ".env"


def get_api_key() -> str | None:
    """Return the Anthropic API key using a three-tier lookup:

    1. OS keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service)
    2. Running process environment variable ``ANTHROPIC_API_KEY``
    3. ``agent-service/.env`` file (development fallback)

    Returns ``None`` when no key is found in any location.
    """
    # 1. OS keyring — preferred secure storage
    try:
        import keyring  # type: ignore[import-untyped]

        stored = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
        if stored:
            return stored
    except Exception:
        # keyring unavailable or backend error — fall through
        pass

    # 2. Process environment variable
    env_key = os.environ.get("ANTHROPIC_API_KEY")
    if env_key:
        return env_key

    # 3. .env file (development; loaded lazily so hot-saves are picked up)
    if _ENV_PATH.exists():
        values = dotenv_values(_ENV_PATH)
        file_key = values.get("ANTHROPIC_API_KEY")
        if file_key:
            return file_key

    return None
