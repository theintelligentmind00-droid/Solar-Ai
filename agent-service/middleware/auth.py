"""API key authentication middleware for Solar AI OS."""

import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

_UNPROTECTED = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/setup/api-key",
    "/gmail/callback",
    "/calendar/callback",
}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Reject requests missing a valid X-Api-Key header."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        # Skip auth for unprotected paths
        if request.url.path in _UNPROTECTED:
            return await call_next(request)

        # Skip OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        secret = os.environ.get("SOLAR_API_KEY", "")
        if not secret:
            # No key configured — allow all (dev mode)
            return await call_next(request)

        import hmac

        provided = request.headers.get("X-Api-Key", "")
        if not hmac.compare_digest(provided, secret):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
