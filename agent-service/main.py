"""Solar AI OS — Local Agent Service entry point."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.schema import init_db
from routes.chat import router as chat_router
from routes.logs import router as logs_router
from routes.planets import router as planets_router

load_dotenv()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    print(f"[Solar AI OS] Agent service started. DB: {os.path.abspath('solar_ai.db')}")
    yield


app = FastAPI(title="Solar AI OS Agent Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "http://localhost:1420",  # Tauri dev server
        "http://localhost:5173",  # Vite dev server fallback
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(planets_router)
app.include_router(logs_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Solar AI OS Agent"}
