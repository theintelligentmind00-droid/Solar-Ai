"""Read-only endpoint for the action log."""

from typing import Any

import aiosqlite
from fastapi import APIRouter

from db.schema import DB_PATH

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(limit: int = 50) -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, skill, summary, success, created_at "
            "FROM logs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(row) for row in rows]
