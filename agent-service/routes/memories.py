"""Memories endpoints — read and delete persisted memory facts."""

from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException

from db.schema import DB_PATH

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("/{planet_id}")
async def get_planet_memories(planet_id: str) -> list[dict[str, Any]]:
    """Return all memories scoped to *planet_id* plus global memories (planet_id IS NULL)."""
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
