"""Solar AI OS — Local Agent Service entry point."""

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.schema import init_db
from middleware.auth import ApiKeyMiddleware
from middleware.security_headers import SecurityHeadersMiddleware
from routes.briefing import router as briefing_router
from routes.calendar import router as calendar_router
from routes.chat import router as chat_router
from routes.civilization import router as civilization_router
from routes.gmail import router as gmail_router
from routes.greeting import router as greeting_router
from routes.integrations import router as integrations_router
from routes.logs import router as logs_router
from routes.memories import router as memories_router
from routes.planets import router as planets_router
from routes.setup import router as setup_router
from routes.shell import router as shell_router
from routes.tasks import router as tasks_router

load_dotenv()

# Web mode disables dangerous tools (shell, file reader) for hosted deployments.
WEB_MODE: bool = os.getenv("WEB_MODE", "false").lower() == "true"

# In-memory store for the latest generated briefing, polled by the frontend.
latest_briefing: dict[str, Any] = {}

# APScheduler instance — exposed at module level so routes can reschedule jobs.
scheduler = AsyncIOScheduler()

_DATA_DIR = Path.home() / ".solar-ai"
_DATA_DIR.mkdir(exist_ok=True)
_SCHEDULE_PATH = _DATA_DIR / "briefing_schedule.json"


def _load_schedule() -> dict[str, Any]:
    """Read saved schedule from disk, falling back to defaults (8:00 AM, enabled)."""
    if _SCHEDULE_PATH.exists():
        try:
            data: dict[str, Any] = json.loads(_SCHEDULE_PATH.read_text())
            return {
                "hour": int(data.get("hour", 8)),
                "minute": int(data.get("minute", 0)),
                "enabled": bool(data.get("enabled", True)),
            }
        except Exception:  # noqa: BLE001
            pass
    return {"hour": 8, "minute": 0, "enabled": True}


async def run_daily_briefing() -> None:
    """Called by the scheduler — generates the briefing and caches it in memory."""
    from skills.briefing import generate_briefing  # noqa: PLC0415

    text = await generate_briefing()
    latest_briefing["text"] = text
    latest_briefing["generated_at"] = datetime.now(timezone.utc).isoformat()
    latest_briefing["notification_pending"] = True
    print(f"[Solar AI OS] Daily briefing generated at {latest_briefing['generated_at']}")


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    from db.schema import DB_PATH as _db_path
    print(f"[Solar AI OS] Agent service started. DB: {_db_path}")
    if WEB_MODE:
        print("[Solar AI OS] WEB_MODE enabled — shell and file reader tools disabled.")

    # Start the daily briefing scheduler.
    schedule = _load_schedule()
    scheduler.add_job(
        run_daily_briefing,
        trigger="cron",
        id="daily_briefing",
        hour=schedule["hour"],
        minute=schedule["minute"],
        replace_existing=True,
    )
    scheduler.start()
    if not schedule["enabled"]:
        scheduler.pause_job("daily_briefing")
    print(
        f"[Solar AI OS] Briefing scheduler started — "
        f"{'enabled' if schedule['enabled'] else 'paused'} at "
        f"{schedule['hour']:02d}:{schedule['minute']:02d} UTC"
    )

    yield

    scheduler.shutdown(wait=False)
    print("[Solar AI OS] Scheduler shut down.")


app = FastAPI(title="Solar AI OS Agent Service", version="0.1.0", lifespan=lifespan)

if WEB_MODE:
    # In web mode, restrict origins to explicitly allowed domains.
    _env_origins = os.getenv("ALLOWED_ORIGINS", "")
    _ALLOWED_ORIGINS: list[str] = [
        o.strip() for o in _env_origins.split(",") if o.strip()
    ] if _env_origins else []
else:
    _ALLOWED_ORIGINS = [
        "http://localhost:1420",       # Tauri dev
        "http://localhost:5173",       # Vite dev
        "http://localhost:8000",       # Same-origin (OAuth callback page)
        "tauri://localhost",           # Tauri production (macOS/Linux)
        "http://tauri.localhost",      # Tauri production (Windows — Chromium WebView2)
        "https://tauri.localhost",     # Tauri production (Windows, secure context)
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Api-Key"],
)
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(chat_router)
app.include_router(planets_router)
app.include_router(logs_router)
app.include_router(memories_router)
app.include_router(greeting_router)
app.include_router(integrations_router)
app.include_router(tasks_router)
app.include_router(briefing_router)
app.include_router(calendar_router)
app.include_router(gmail_router)
app.include_router(setup_router)
if not WEB_MODE:
    app.include_router(shell_router)
app.include_router(civilization_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Solar AI OS Agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
