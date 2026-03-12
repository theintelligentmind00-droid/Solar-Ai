"""Civilization data endpoints — drives the 3D planet visualization."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite
from fastapi import APIRouter

from db.schema import DB_PATH
from db.supabase_client import USE_SUPABASE
from db.supabase_client import table as supa_table

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/civilization", tags=["civilization"])


def _parse_created_at(created_at: str | None) -> int:
    """Parse a created_at timestamp and return age in days."""
    if not created_at:
        return 0
    try:
        ts = created_at.replace("Z", "+00:00")
        if "T" not in ts:
            ts = ts.replace(" ", "T")
        return (datetime.now(timezone.utc) - datetime.fromisoformat(ts)).days
    except Exception:
        return 0


@router.get("/{planet_id}")
async def get_civilization(planet_id: str) -> dict[str, Any]:
    """Return civilization metrics for a planet — activity, health, settlements, milestones."""
    if USE_SUPABASE:
        cutoff_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        cutoff_24h = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

        # Activity score: messages in last 7 days
        result = supa_table("messages").select("id", count="exact").eq("planet_id", planet_id).gte("created_at", cutoff_7d).execute()
        msg_count_7d = result.count or 0

        # Messages in last 24h
        result = supa_table("messages").select("id", count="exact").eq("planet_id", planet_id).gte("created_at", cutoff_24h).execute()
        msg_count_24h = result.count or 0

        # Last activity timestamp
        result = supa_table("planets").select("last_activity_at").eq("id", planet_id).limit(1).execute()
        last_activity = result.data[0]["last_activity_at"] if result.data else None

        # Task health: counts by status (no GROUP BY in supabase-py — fetch all and count in Python)
        result = supa_table("tasks").select("status").eq("planet_id", planet_id).execute()
        task_counts = {"todo": 0, "doing": 0, "done": 0}
        for r in (result.data or []):
            status = r.get("status")
            if status in task_counts:
                task_counts[status] += 1

        total_tasks = sum(task_counts.values())
        health_score = task_counts["done"] / total_tasks if total_tasks > 0 else 0.5

        # Overdue tasks (doing for more than 7 days)
        result = supa_table("tasks").select("id", count="exact").eq("planet_id", planet_id).eq("status", "doing").lt("created_at", cutoff_7d).execute()
        overdue_count = result.count or 0

        # Memory count
        result = supa_table("memories").select("id", count="exact").eq("planet_id", planet_id).execute()
        memory_count = result.count or 0

        # Completed tasks (milestones)
        result = supa_table("tasks").select("id, title, completed_at").eq("planet_id", planet_id).eq("status", "done").order("completed_at", desc=True).limit(10).execute()
        milestones = result.data or []

        # Planet created_at for age calculation
        result = supa_table("planets").select("created_at").eq("id", planet_id).limit(1).execute()
        created_at = result.data[0]["created_at"] if result.data else None
        age_days = _parse_created_at(created_at)

        # All tasks for settlements
        result = supa_table("tasks").select("title, status, priority").eq("planet_id", planet_id).order("created_at").execute()
        all_tasks = result.data or []
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            # Activity score: messages in last 7 days
            async with db.execute(
                "SELECT COUNT(*) as cnt FROM messages WHERE planet_id = ? AND created_at > datetime('now', '-7 days')",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                msg_count_7d = row["cnt"] if row else 0

            # Messages in last 24h (for "hot" detection)
            async with db.execute(
                "SELECT COUNT(*) as cnt FROM messages WHERE planet_id = ? AND created_at > datetime('now', '-1 day')",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                msg_count_24h = row["cnt"] if row else 0

            # Last activity timestamp
            async with db.execute(
                "SELECT last_activity_at FROM planets WHERE id = ?",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                last_activity = row["last_activity_at"] if row else None

            # Task health: counts by status
            async with db.execute(
                "SELECT status, COUNT(*) as cnt FROM tasks WHERE planet_id = ? GROUP BY status",
                (planet_id,),
            ) as cur:
                task_rows = await cur.fetchall()

            task_counts = {"todo": 0, "doing": 0, "done": 0}
            for r in task_rows:
                task_counts[r["status"]] = r["cnt"]

            total_tasks = sum(task_counts.values())
            health_score = task_counts["done"] / total_tasks if total_tasks > 0 else 0.5

            # Overdue tasks (doing for more than 7 days)
            async with db.execute(
                "SELECT COUNT(*) as cnt FROM tasks WHERE planet_id = ? AND status = 'doing' AND created_at < datetime('now', '-7 days')",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                overdue_count = row["cnt"] if row else 0

            # Memory count (for civilization richness)
            async with db.execute(
                "SELECT COUNT(*) as cnt FROM memories WHERE planet_id = ?",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                memory_count = row["cnt"] if row else 0

            # Completed tasks (milestones)
            async with db.execute(
                "SELECT id, title, completed_at FROM tasks WHERE planet_id = ? AND status = 'done' ORDER BY completed_at DESC LIMIT 10",
                (planet_id,),
            ) as cur:
                milestones = [dict(r) for r in await cur.fetchall()]

            # Determine civilization stage based on planet age and activity
            async with db.execute(
                "SELECT created_at FROM planets WHERE id = ?",
                (planet_id,),
            ) as cur:
                row = await cur.fetchone()
                created_at = row["created_at"] if row else None

            age_days = _parse_created_at(created_at)

            # Settlement data: group tasks by category (use task title first word as rough grouping)
            async with db.execute(
                "SELECT title, status, priority FROM tasks WHERE planet_id = ? ORDER BY created_at",
                (planet_id,),
            ) as cur:
                all_tasks = [dict(r) for r in await cur.fetchall()]

    # Calculate activity level
    if msg_count_24h >= 5:
        activity_level = "very_active"
    elif msg_count_7d >= 10:
        activity_level = "active"
    elif msg_count_7d >= 3:
        activity_level = "moderate"
    elif msg_count_7d >= 1:
        activity_level = "low"
    else:
        activity_level = "dormant"

    # Calculate prosperity level
    if health_score >= 0.75:
        prosperity = "thriving"
    elif health_score >= 0.5:
        prosperity = "steady"
    elif health_score >= 0.25:
        prosperity = "struggling"
    else:
        prosperity = "critical"

    if age_days >= 90 and msg_count_7d >= 10:
        civ_stage = "metropolis"
    elif age_days >= 30 and msg_count_7d >= 5:
        civ_stage = "city"
    elif age_days >= 7 and msg_count_7d >= 2:
        civ_stage = "settlement"
    else:
        civ_stage = "outpost"

    # Check for "wonder" status (metropolis + thriving)
    if civ_stage == "metropolis" and prosperity == "thriving":
        civ_stage = "wonder"

    # Simple settlement generation: each high-priority task area = settlement
    settlements = []
    seen_categories: set[str] = set()
    for i, task in enumerate(all_tasks):
        category = task["title"].split()[0].lower() if task["title"] else "general"
        if category not in seen_categories:
            seen_categories.add(category)
            settlements.append({
                "id": f"settlement-{i}",
                "name": category.capitalize(),
                "lat": ((hash(category) % 180) - 90),  # pseudo-random lat
                "lon": ((hash(category + planet_id) % 360) - 180),  # pseudo-random lon
                "size": len([t for t in all_tasks if t["title"].lower().startswith(category)]),
                "has_overdue": any(t["status"] == "doing" for t in all_tasks if t["title"].lower().startswith(category)),
            })

    return {
        "planet_id": planet_id,
        "activity_level": activity_level,
        "activity_score": min(1.0, msg_count_7d / 20),  # normalized 0-1
        "prosperity": prosperity,
        "health_score": round(health_score, 2),
        "civ_stage": civ_stage,
        "age_days": age_days,
        "msg_count_7d": msg_count_7d,
        "msg_count_24h": msg_count_24h,
        "last_activity": last_activity,
        "task_counts": task_counts,
        "overdue_count": overdue_count,
        "memory_count": memory_count,
        "milestones": milestones,
        "settlements": settlements,
    }
