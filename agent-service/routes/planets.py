"""CRUD endpoints for planets (projects)."""

import re
import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

router = APIRouter(prefix="/planets", tags=["planets"])

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_VALID_PLANET_TYPES = {"terra", "forge", "oasis", "nexus", "citadel", "gaia", "void"}


class PlanetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    orbit_radius: float = Field(200.0, ge=50.0, le=2000.0)
    color: str = "#FFD700"
    planet_type: str = "terra"

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not _HEX_COLOR.match(v):
            raise ValueError("color must be a 6-digit hex color (e.g. #FFD700)")
        return v

    @field_validator("planet_type")
    @classmethod
    def validate_planet_type(cls, v: str) -> str:
        if v not in _VALID_PLANET_TYPES:
            raise ValueError(f"planet_type must be one of {sorted(_VALID_PLANET_TYPES)}")
        return v


class PlanetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    status: str | None = None
    orbit_radius: float | None = Field(None, ge=50.0, le=2000.0)
    color: str | None = None
    planet_type: str | None = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None and not _HEX_COLOR.match(v):
            raise ValueError("color must be a 6-digit hex color (e.g. #FFD700)")
        return v

    @field_validator("planet_type")
    @classmethod
    def validate_planet_type(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_PLANET_TYPES:
            raise ValueError(f"planet_type must be one of {sorted(_VALID_PLANET_TYPES)}")
        return v


_PLANET_COLUMNS = "id, name, status, orbit_radius, color, created_at, last_activity_at, planet_type"


@router.get("")
async def list_planets(request: Request) -> list[dict[str, Any]]:
    uid = request.state.user_id
    if USE_SUPABASE:
        result = (
            supa_table("planets")
            .select(_PLANET_COLUMNS)
            .eq("user_id", uid)
            .order("created_at")
            .execute()
        )
        return result.data
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT {_PLANET_COLUMNS} "
                "FROM planets WHERE user_id = ? ORDER BY created_at",
                (uid,),
            ) as cursor:
                rows = await cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("", status_code=201)
async def create_planet(body: PlanetCreate, request: Request) -> dict[str, Any]:
    uid = request.state.user_id
    planet_id = str(uuid.uuid4())
    if USE_SUPABASE:
        supa_table("planets").insert({
            "id": planet_id,
            "name": body.name,
            "orbit_radius": body.orbit_radius,
            "color": body.color,
            "planet_type": body.planet_type,
            "user_id": uid,
        }).execute()
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO planets (id, name, orbit_radius, color, planet_type, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                (planet_id, body.name, body.orbit_radius, body.color, body.planet_type, uid),
            )
            await db.commit()
    return {"id": planet_id, "name": body.name, "status": "active"}


@router.get("/{planet_id}")
async def get_planet(planet_id: str, request: Request) -> dict[str, Any]:
    uid = request.state.user_id
    if USE_SUPABASE:
        result = (
            supa_table("planets")
            .select(_PLANET_COLUMNS)
            .eq("id", planet_id)
            .eq("user_id", uid)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
        return result.data[0]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT {_PLANET_COLUMNS} "
                "FROM planets WHERE id = ? AND user_id = ?",
                (planet_id, uid),
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
        return dict(row)


@router.delete("/{planet_id}", status_code=204)
async def delete_planet(planet_id: str, request: Request) -> None:
    uid = request.state.user_id
    if USE_SUPABASE:
        # Check planet exists first
        check = (
            supa_table("planets")
            .select("id")
            .eq("id", planet_id)
            .eq("user_id", uid)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
        # Delete child rows before removing the planet
        supa_table("messages").delete().eq("planet_id", planet_id).eq("user_id", uid).execute()
        supa_table("tasks").delete().eq("planet_id", planet_id).eq("user_id", uid).execute()
        supa_table("memories").delete().eq("planet_id", planet_id).eq("user_id", uid).execute()
        supa_table("action_log").delete().eq("planet_id", planet_id).execute()
        supa_table("planets").delete().eq("id", planet_id).eq("user_id", uid).execute()
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            # Delete orphaned child rows before removing the planet
            await db.execute("DELETE FROM messages WHERE planet_id = ? AND user_id = ?", (planet_id, uid))
            await db.execute("DELETE FROM tasks WHERE planet_id = ? AND user_id = ?", (planet_id, uid))
            await db.execute("DELETE FROM memories WHERE planet_id = ? AND user_id = ?", (planet_id, uid))
            await db.execute("DELETE FROM action_log WHERE planet_id = ?", (planet_id,))
            result = await db.execute("DELETE FROM planets WHERE id = ? AND user_id = ?", (planet_id, uid))
            await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Planet '{planet_id}' not found")
