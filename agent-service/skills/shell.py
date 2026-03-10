"""Sandboxed shell command execution with allowlist."""

from __future__ import annotations

import asyncio
import os
import shlex
from pathlib import Path

# Commands that are always blocked (security)
BLOCKED_COMMANDS: set[str] = {
    "rm", "del", "format", "mkfs", "dd", "shutdown", "reboot", "halt",
    "curl", "wget", "nc", "ncat", "netcat",  # no outbound network from shell
    "sudo", "su", "chmod", "chown",
    "reg", "regedit",  # Windows registry
    "cmd", "powershell", "pwsh",  # shell interpreters
    "wscript", "cscript", "mshta",  # Windows script hosts
    "certutil", "bitsadmin",  # common LOLBins
    "regsvr32", "rundll32", "msiexec", "wmic",  # Windows exec/install primitives
}

_SAFE_ROOTS: list[str] = [
    str(Path.home()),
    "C:/Users",
    "C:/tmp",
    "/tmp",
    "/home",
]

_MAX_OUTPUT_CHARS = 10_000


async def run_command(
    command: str,
    working_dir: str | None = None,
    timeout_seconds: int = 30,
) -> dict[str, object]:
    """Run a shell command with safety checks.

    Returns:
        {
            "output": str,
            "exit_code": int,
            "blocked": bool,
            "block_reason": str | None,
        }

    Safety rules:
    1. Parse the command with shlex.split()
    2. Check if first token is in BLOCKED_COMMANDS — if so, return blocked=True
    3. Truncate output to _MAX_OUTPUT_CHARS chars max
    4. Timeout after timeout_seconds
    5. Working dir defaults to user home dir if not specified
    6. Never allow shell=True — always use list form
    """
    # Parse command into a list — raises ValueError on bad quoting
    try:
        args = shlex.split(command)
    except ValueError as exc:
        return {
            "output": f"Failed to parse command: {exc}",
            "exit_code": 1,
            "blocked": True,
            "block_reason": f"Command parse error: {exc}",
        }

    if not args:
        return {
            "output": "Empty command.",
            "exit_code": 1,
            "blocked": True,
            "block_reason": "Empty command",
        }

    base_cmd = os.path.basename(args[0]).lower()
    # Strip .exe suffix on Windows
    if base_cmd.endswith(".exe"):
        base_cmd = base_cmd[:-4]

    if base_cmd in BLOCKED_COMMANDS:
        return {
            "output": f"Command '{base_cmd}' is blocked for security reasons.",
            "exit_code": 1,
            "blocked": True,
            "block_reason": f"'{base_cmd}' is on the blocked-commands list",
        }

    cwd = str(Path(working_dir).expanduser().resolve()) if working_dir else str(Path.home())

    if working_dir:
        cwd_path = Path(cwd)
        confined = any(
            str(cwd_path).startswith(root) for root in _SAFE_ROOTS
        )
        if not confined:
            return {
                "output": (
                    f"Working directory '{cwd}' is outside allowed paths. "
                    "Only paths under the user home directory are permitted."
                ),
                "exit_code": 1,
                "blocked": True,
                "block_reason": "working_dir outside allowed roots",
            }

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return {
                "output": f"Command timed out after {timeout_seconds} seconds.",
                "exit_code": 124,
                "blocked": False,
                "block_reason": None,
            }
    except FileNotFoundError:
        return {
            "output": f"Command not found: {args[0]}",
            "exit_code": 127,
            "blocked": False,
            "block_reason": None,
        }
    except OSError as exc:
        return {
            "output": f"OS error running command: {exc}",
            "exit_code": 1,
            "blocked": False,
            "block_reason": None,
        }

    output = stdout.decode("utf-8", errors="replace")
    if len(output) > _MAX_OUTPUT_CHARS:
        output = output[:_MAX_OUTPUT_CHARS] + "\n[output truncated]"

    return {
        "output": output,
        "exit_code": proc.returncode if proc.returncode is not None else 0,
        "blocked": False,
        "block_reason": None,
    }
