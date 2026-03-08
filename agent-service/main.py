"""Solar AI OS — Local Agent Service entry point."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.schema import init_db
from routes.briefing import router as briefing_router
from routes.chat import router as chat_router
from routes.greeting import router as greeting_router
from routes.integrations import router as integrations_router
from routes.logs import router as logs_router
from routes.memories import router as memories_router
from routes.planets import router as planets_router
from routes.tasks import router as tasks_router

load_dotenv()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    print(f"[Solar AI OS] Agent service started. DB: {os.path.abspath('solar_ai.db')}")
    yield


app = FastAPI(title="Solar AI OS Agent Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(planets_router)
app.include_router(logs_router)
app.include_router(memories_router)
app.include_router(greeting_router)
app.include_router(integrations_router)
app.include_router(tasks_router)
app.include_router(briefing_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Solar AI OS Agent"}
