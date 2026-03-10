"""CRUD endpoints for planets (projects)."""

import re
import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from db.schema import DB_PATH

router = APIRouter(prefix="/planets", tags=["planets"])

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class PlanetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    orbit_radius: float = Field(200.0, ge=50.0, le=2000.0)
    color: str = "#FFD700"

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not _HEX_COLOR.match(v):
            raise ValueError("color must be a 6-digit hex color (e.g. #FFD700)")
        return v


class PlanetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    status: str | None = None
    orbit_radius: float | None = Field(None, ge=50.0, le=2000.0)
    color: str | None = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None and not _HEX_COLOR.match(v):
            raise ValueError("color must be a 6-digit hex color (e.g. #FFD700)")
        return v


@router.get("")
async def list_planets() -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, status, orbit_radius, color, created_at, last_activity_at "
            "FROM planets ORDER BY created_at"
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("", status_code=201)
async def create_planet(body: PlanetCreate) -> dict[str, Any]:
    planet_id = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO planets (id, name, orbit_radius, color) VALUES (?, ?, ?, ?)",
            (planet_id, body.name, body.orbit_radius, body.color),
        )
        await db.commit()
    return {"id": planet_id, "name": body.name, "status": "active"}


@router.get("/{planet_id}")
async def get_planet(planet_id: str) -> dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, status, orbit_radius, color, created_at, last_activity_at FROM planets WHERE id = ?",
            (planet_id,),
        ) as cursor:
            row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
    return dict(row)


@router.delete("/{planet_id}", status_code=204)
async def delete_planet(planet_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        result = await db.execute("DELETE FROM planets WHERE id = ?", (planet_id,))
        await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
