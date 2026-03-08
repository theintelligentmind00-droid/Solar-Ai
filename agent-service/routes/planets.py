"""CRUD endpoints for planets (projects)."""

import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.schema import DB_PATH

router = APIRouter(prefix="/planets", tags=["planets"])


class PlanetCreate(BaseModel):
    name: str
    orbit_radius: float = 200.0
    color: str = "#FFD700"


class PlanetUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    orbit_radius: float | None = None
    color: str | None = None


@router.get("")
async def list_planets() -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, status, orbit_radius, color, created_at "
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
            "SELECT id, name, status, orbit_radius, color, created_at FROM planets WHERE id = ?",
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
