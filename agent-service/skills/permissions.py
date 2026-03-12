"""Permission checks for skills that require user approval."""

import uuid
from datetime import datetime, timezone

import aiosqlite

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table


async def check_permission(skill: str, db_path: str = DB_PATH) -> bool:
    """Return True if the named skill is enabled by the user."""
    if USE_SUPABASE:
        result = supa_table("integrations").select("enabled").eq("name", skill).limit(1).execute()
        row = result.data[0] if result.data else None
        return bool(row and row["enabled"])
    else:
        async with aiosqlite.connect(db_path) as db:
            async with db.execute(
                "SELECT enabled FROM integrations WHERE name = ?", (skill,)
            ) as cursor:
                row = await cursor.fetchone()
        return bool(row and row[0])


async def set_permission(skill: str, enabled: bool, db_path: str = DB_PATH) -> None:
    """Enable or disable a skill integration."""
    if USE_SUPABASE:
        supa_table("integrations").update({
            "enabled": enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("name", skill).execute()
    else:
        async with aiosqlite.connect(db_path) as db:
            await db.execute(
                """
                UPDATE integrations
                SET enabled = ?, updated_at = datetime('now')
                WHERE name = ?
                """,
                (1 if enabled else 0, skill),
            )
            await db.commit()


async def log_action(
    skill: str,
    summary: str,
    success: bool = True,
    db_path: str = DB_PATH,
) -> None:
    """Append an entry to the action log."""
    if USE_SUPABASE:
        supa_table("logs").insert({
            "id": str(uuid.uuid4()),
            "skill": skill,
            "summary": summary,
            "success": success,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    else:
        async with aiosqlite.connect(db_path) as db:
            await db.execute(
                "INSERT INTO logs (id, skill, summary, success) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), skill, summary, 1 if success else 0),
            )
            await db.commit()
