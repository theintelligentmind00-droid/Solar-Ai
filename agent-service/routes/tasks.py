"""Task management routes for Solar AI OS."""

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

router = APIRouter(prefix="/tasks", tags=["tasks"])

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(None, max_length=5000)
    priority: Literal["low", "medium", "high"] = "medium"


class TaskPatch(BaseModel):
    status: Literal["todo", "doing", "done"] | None = None
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = Field(None, max_length=5000)
    priority: Literal["low", "medium", "high"] | None = None


@router.get("/{planet_id}", response_model=list[dict[str, Any]])
async def get_tasks(planet_id: str) -> list[dict[str, Any]]:
    """Return all tasks for a planet ordered by priority then created_at."""
    if USE_SUPABASE:
        result = (
            supa_table("tasks")
            .select("id, planet_id, title, description, status, priority, created_at, completed_at")
            .eq("planet_id", planet_id)
            .order("created_at")
            .execute()
        )
        rows = result.data
        rows.sort(key=lambda r: (_PRIORITY_ORDER.get(r.get("priority", "low"), 2), r.get("created_at", "")))
        return rows
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT id, planet_id, title, description, status, priority, created_at, completed_at
                FROM tasks WHERE planet_id = ?
                ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                created_at ASC
                """,
                (planet_id,),
            ) as cursor:
                rows = await cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("/{planet_id}", response_model=dict[str, Any])
async def create_task(planet_id: str, body: TaskCreate) -> dict[str, Any]:
    """Create a new task for a planet."""
    task_id = f"task-{uuid.uuid4().hex[:12]}"
    if USE_SUPABASE:
        supa_table("tasks").insert({
            "id": task_id,
            "planet_id": planet_id,
            "title": body.title,
            "description": body.description,
            "priority": body.priority,
        }).execute()
        result = (
            supa_table("tasks")
            .select("id, planet_id, title, description, status, priority, created_at, completed_at")
            .eq("id", task_id)
            .limit(1)
            .execute()
        )
        return result.data[0]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            await db.execute(
                """
                INSERT INTO tasks (id, planet_id, title, description, priority)
                VALUES (?, ?, ?, ?, ?)
                """,
                (task_id, planet_id, body.title, body.description, body.priority),
            )
            await db.commit()
            async with db.execute(
                "SELECT id, planet_id, title, description, status, priority, created_at,"
                " completed_at FROM tasks WHERE id = ?",
                (task_id,),
            ) as cursor:
                row = await cursor.fetchone()
        return dict(row)  # type: ignore[arg-type]


@router.patch("/{task_id}", response_model=dict[str, Any])
async def update_task(task_id: str, body: TaskPatch) -> dict[str, Any]:
    """Update status, title, description, or priority of a task."""
    if USE_SUPABASE:
        existing = supa_table("tasks").select("id").eq("id", task_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Task not found")

        updates: dict[str, Any] = {}
        if body.title is not None:
            updates["title"] = body.title
        if body.description is not None:
            updates["description"] = body.description
        if body.priority is not None:
            updates["priority"] = body.priority
        if body.status is not None:
            updates["status"] = body.status
            if body.status == "done":
                updates["completed_at"] = datetime.now(timezone.utc).isoformat()
            else:
                updates["completed_at"] = None

        if updates:
            supa_table("tasks").update(updates).eq("id", task_id).execute()

        result = (
            supa_table("tasks")
            .select("id, planet_id, title, description, status, priority, created_at, completed_at")
            .eq("id", task_id)
            .limit(1)
            .execute()
        )
        return result.data[0]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            async with db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)) as cursor:
                if await cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Task not found")

            update_parts: list[str] = []
            params: list[Any] = []

            if body.title is not None:
                update_parts.append("title = ?")
                params.append(body.title)
            if body.description is not None:
                update_parts.append("description = ?")
                params.append(body.description)
            if body.priority is not None:
                update_parts.append("priority = ?")
                params.append(body.priority)
            if body.status is not None:
                update_parts.append("status = ?")
                params.append(body.status)
                if body.status == "done":
                    update_parts.append("completed_at = datetime('now')")
                else:
                    update_parts.append("completed_at = NULL")

            if update_parts:
                params.append(task_id)
                await db.execute(
                    f"UPDATE tasks SET {', '.join(update_parts)} WHERE id = ?", params
                )
                await db.commit()

            async with db.execute(
                "SELECT id, planet_id, title, description, status, priority, created_at,"
                " completed_at FROM tasks WHERE id = ?",
                (task_id,),
            ) as cursor:
                row = await cursor.fetchone()

        return dict(row)  # type: ignore[arg-type]


@router.delete("/{task_id}")
async def delete_task(task_id: str) -> dict[str, str]:
    """Delete a task."""
    if USE_SUPABASE:
        existing = supa_table("tasks").select("id").eq("id", task_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Task not found")
        supa_table("tasks").delete().eq("id", task_id).execute()
        return {"deleted": task_id}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)) as cursor:
                if await cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Task not found")
            await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            await db.commit()
        return {"deleted": task_id}
