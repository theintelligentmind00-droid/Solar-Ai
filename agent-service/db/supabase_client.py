"""Supabase client singleton for Solar AI OS web deployments."""

import os
from typing import Any

from supabase import Client, create_client

_client: Client | None = None

# Detect Supabase mode: requires both URL and key to be set.
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
USE_SUPABASE: bool = bool(SUPABASE_URL and SUPABASE_KEY)


def get_client() -> Client:
    """Return the module-level Supabase client, creating it once per process."""
    global _client  # noqa: PLW0603
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set to use Supabase mode."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def table(name: str) -> Any:
    """Shorthand for get_client().table(name)."""
    return get_client().table(name)
