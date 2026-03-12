"""Integrations management routes for Solar AI OS."""

from datetime import datetime, timezone
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table
from skills.permissions import log_action

router = APIRouter(prefix="/integrations")


class Integration(BaseModel):
    id: str
    name: str
    enabled: bool
    scopes: str | None
    updated_at: str


class PatchIntegrationBody(BaseModel):
    enabled: bool


def _row_to_integration(row: dict[str, Any] | aiosqlite.Row) -> Integration:
    return Integration(
        id=row["id"],
        name=row["name"],
        enabled=bool(row["enabled"]),
        scopes=row["scopes"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=list[Integration])
async def list_integrations() -> list[Integration]:
    """Return all integrations."""
    if USE_SUPABASE:
        result = (
            supa_table("integrations")
            .select("id, name, enabled, scopes, updated_at")
            .order("name")
            .execute()
        )
        return [_row_to_integration(row) for row in result.data]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, name, enabled, scopes, updated_at FROM integrations ORDER BY name"
            ) as cursor:
                rows = await cursor.fetchall()
        return [_row_to_integration(row) for row in rows]


@router.get("/{name}", response_model=Integration)
async def get_integration(name: str) -> Integration:
    """Return a single integration by name, or 404 if not found."""
    if USE_SUPABASE:
        result = (
            supa_table("integrations")
            .select("id, name, enabled, scopes, updated_at")
            .eq("name", name)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Integration '{name}' not found.")
        return _row_to_integration(result.data[0])
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, name, enabled, scopes, updated_at FROM integrations WHERE name = ?",
                (name,),
            ) as cursor:
                row = await cursor.fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"Integration '{name}' not found.")

        return _row_to_integration(row)


@router.patch("/{name}", response_model=Integration)
async def toggle_integration(name: str, body: PatchIntegrationBody) -> Integration:
    """Enable or disable an integration by name."""
    if USE_SUPABASE:
        existing = (
            supa_table("integrations")
            .select("id")
            .eq("name", name)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Integration '{name}' not found.")

        supa_table("integrations").update({
            "enabled": body.enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("name", name).execute()

        result = (
            supa_table("integrations")
            .select("id, name, enabled, scopes, updated_at")
            .eq("name", name)
            .limit(1)
            .execute()
        )
        updated = _row_to_integration(result.data[0])
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            async with db.execute(
                "SELECT id FROM integrations WHERE name = ?", (name,)
            ) as cursor:
                existing_row = await cursor.fetchone()

            if existing_row is None:
                raise HTTPException(status_code=404, detail=f"Integration '{name}' not found.")

            await db.execute(
                "UPDATE integrations SET enabled = ?, updated_at = datetime('now') WHERE name = ?",
                (int(body.enabled), name),
            )
            await db.commit()

            async with db.execute(
                "SELECT id, name, enabled, scopes, updated_at FROM integrations WHERE name = ?",
                (name,),
            ) as cursor:
                updated_row = await cursor.fetchone()

        updated = _row_to_integration(updated_row)  # type: ignore[arg-type]

    action_label = "enabled" if body.enabled else "disabled"
    await log_action(
        "permissions",
        f"Integration '{name}' {action_label}",
        success=True,
    )

    return updated
