"""API key authentication middleware for Solar AI OS."""

import hashlib
import hmac
import os
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Routes that skip authentication entirely
_UNPROTECTED: set[str] = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/setup/api-key",
    "/setup/validate-key",
    "/gmail/callback",
    "/calendar/callback",
}

# Prefix-based unprotected routes (e.g. /docs/*)
_UNPROTECTED_PREFIXES: tuple[str, ...] = (
    "/docs",
    "/redoc",
)

_WEB_MODE = os.getenv("WEB_MODE", "false").lower() == "true"


def _hash_key(api_key: str) -> str:
    """Derive a stable user_id from an API key via SHA-256 (first 16 hex chars)."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:16]


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Reject requests missing a valid X-Api-Key header.

    In WEB_MODE the X-Api-Key header carries the user's own Anthropic key.
    We hash it to derive a per-user user_id and store both on request.state
    so downstream routes can isolate data and make Claude calls with the
    correct key.

    When SOLAR_API_KEY is set (desktop packaged builds) we validate against
    that secret instead. When neither is set we allow all (dev mode).
    """

    def __init__(self, app: ASGIApp, **kwargs: Any) -> None:
        super().__init__(app, **kwargs)

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        path = request.url.path

        # Default state for all requests
        request.state.user_id = "local"
        request.state.api_key = None

        # Skip auth for unprotected paths
        if path in _UNPROTECTED:
            return await call_next(request)

        # Skip prefix matches
        for prefix in _UNPROTECTED_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Skip CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)

        provided = request.headers.get("X-Api-Key", "")

        if _WEB_MODE:
            # In web mode the header IS the user's Anthropic API key
            if not provided:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "API key required"},
                )
            request.state.user_id = _hash_key(provided)
            request.state.api_key = provided
            return await call_next(request)

        # Desktop mode — gate on SOLAR_API_KEY if configured
        secret = os.environ.get("SOLAR_API_KEY", "")
        if not secret:
            # No key configured — dev mode, allow all
            return await call_next(request)

        if not provided or not hmac.compare_digest(provided, secret):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
