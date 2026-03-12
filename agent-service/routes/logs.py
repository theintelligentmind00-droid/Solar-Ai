"""Read-only endpoint for the action log."""

from typing import Any

import aiosqlite
from fastapi import APIRouter, Query

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(limit: int = Query(50, ge=1, le=200)) -> list[dict[str, Any]]:
    if USE_SUPABASE:
        result = (
            supa_table("logs")
            .select("id, skill, summary, success, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, skill, summary, success, created_at "
                "FROM logs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ) as cursor:
                rows = await cursor.fetchall()
        return [dict(row) for row in rows]
