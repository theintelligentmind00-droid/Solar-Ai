"""Task management routes for Solar AI OS."""

import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.schema import DB_PATH

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"


class TaskPatch(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None
    priority: str | None = None


@router.get("/{planet_id}", response_model=list[dict[str, Any]])
async def get_tasks(planet_id: str) -> list[dict[str, Any]]:
    """Return all tasks for a planet ordered by priority then created_at."""
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
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)) as cursor:
            if await cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Task not found")

        updates: list[str] = []
        params: list[Any] = []

        if body.title is not None:
            updates.append("title = ?")
            params.append(body.title)
        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)
        if body.priority is not None:
            updates.append("priority = ?")
            params.append(body.priority)
        if body.status is not None:
            updates.append("status = ?")
            params.append(body.status)
            if body.status == "done":
                updates.append("completed_at = datetime('now')")
            else:
                updates.append("completed_at = NULL")

        if updates:
            params.append(task_id)
            await db.execute(
                f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", params
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
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)) as cursor:
            if await cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Task not found")
        await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        await db.commit()
    return {"deleted": task_id}
