"""Shell command execution routes."""

from __future__ import annotations

from typing import Any

import aiosqlite
from fastapi import APIRouter
from pydantic import BaseModel

from db.schema import DB_PATH
from skills import shell as shell_skill
from skills.permissions import log_action

router = APIRouter(prefix="/shell", tags=["shell"])


class RunCommandRequest(BaseModel):
    command: str
    working_dir: str | None = None


class RunCommandResponse(BaseModel):
    output: str
    exit_code: int
    blocked: bool


class ShellHistoryEntry(BaseModel):
    summary: str
    created_at: str


@router.post("/run", response_model=RunCommandResponse)
async def run_shell_command(body: RunCommandRequest) -> RunCommandResponse:
    """Execute a sandboxed shell command and log the result."""
    result = await shell_skill.run_command(
        command=body.command,
        working_dir=body.working_dir,
    )

    blocked: bool = bool(result.get("blocked", False))
    exit_code: int = int(result.get("exit_code", 0))  # type: ignore[arg-type]
    output: str = str(result.get("output", ""))
    block_reason: str | None = result.get("block_reason") or None  # type: ignore[assignment]

    if blocked:
        summary = f"BLOCKED: {body.command!r} — {block_reason}"
    else:
        summary = (
            f"shell: {body.command!r} "
            f"(exit {exit_code})"
            + (f" in {body.working_dir}" if body.working_dir else "")
        )

    await log_action(
        skill="shell",
        summary=summary,
        success=not blocked and exit_code == 0,
    )

    return RunCommandResponse(output=output, exit_code=exit_code, blocked=blocked)


@router.get("/history", response_model=list[ShellHistoryEntry])
async def get_shell_history() -> list[dict[str, Any]]:
    """Return the last 20 shell command log entries."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT summary, created_at
            FROM logs
            WHERE skill = 'shell'
            ORDER BY created_at DESC
            LIMIT 20
            """
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(row) for row in rows]
