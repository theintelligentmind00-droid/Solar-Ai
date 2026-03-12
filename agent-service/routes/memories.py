"""Memories endpoints — read and delete persisted memory facts."""

from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

router = APIRouter(prefix="/memories", tags=["memories"])

_MEMORY_COLUMNS = "id, planet_id, key, value, type, importance, created_at"


def _fill_defaults(row: dict[str, Any]) -> dict[str, Any]:
    """Fill in defaults for nullable columns to match SQLite COALESCE behavior."""
    if row.get("type") is None:
        row["type"] = "fact"
    if row.get("importance") is None:
        row["importance"] = 0.5
    return row


@router.get("/{planet_id}")
async def get_planet_memories(planet_id: str) -> list[dict[str, Any]]:
    """Return all memories scoped to *planet_id* plus global memories (planet_id IS NULL)."""
    if USE_SUPABASE:
        result = (
            supa_table("memories")
            .select(_MEMORY_COLUMNS)
            .or_(f"planet_id.eq.{planet_id},planet_id.is.null")
            .order("importance", desc=True)
            .order("created_at")
            .execute()
        )
        return [_fill_defaults(row) for row in result.data]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT id, planet_id, key, value,
                       COALESCE(type, 'fact') as type,
                       COALESCE(importance, 0.5) as importance,
                       created_at
                FROM memories
                WHERE planet_id = ? OR planet_id IS NULL
                ORDER BY COALESCE(importance, 0.5) DESC, created_at ASC
                """,
                (planet_id,),
            ) as cursor:
                rows = await cursor.fetchall()

        return [dict(row) for row in rows]


@router.get("")
async def get_global_memories() -> list[dict[str, Any]]:
    """Return all global memories (planet_id IS NULL)."""
    if USE_SUPABASE:
        result = (
            supa_table("memories")
            .select(_MEMORY_COLUMNS)
            .is_("planet_id", "null")
            .order("importance", desc=True)
            .order("created_at")
            .execute()
        )
        return [_fill_defaults(row) for row in result.data]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT id, planet_id, key, value,
                       COALESCE(type, 'fact') as type,
                       COALESCE(importance, 0.5) as importance,
                       created_at
                FROM memories
                WHERE planet_id IS NULL
                ORDER BY COALESCE(importance, 0.5) DESC, created_at ASC
                """,
            ) as cursor:
                rows = await cursor.fetchall()

        return [dict(row) for row in rows]


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str) -> dict[str, str]:
    """Delete a single memory row by its id."""
    if USE_SUPABASE:
        existing = supa_table("memories").select("id").eq("id", memory_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Memory not found")
        supa_table("memories").delete().eq("id", memory_id).execute()
        return {"deleted": memory_id}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT id FROM memories WHERE id = ?",
                (memory_id,),
            ) as cursor:
                existing = await cursor.fetchone()

            if existing is None:
                raise HTTPException(status_code=404, detail="Memory not found")

            await db.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
            await db.commit()

        return {"deleted": memory_id}
