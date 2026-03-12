"""Sandboxed shell command execution with allowlist."""

from __future__ import annotations

import asyncio
import os
import re
import shlex
from pathlib import Path

# Commands that are always blocked (security)
BLOCKED_COMMANDS: set[str] = {
    # Destructive
    "rm", "rmdir", "del", "erase", "format", "mkfs", "dd",
    "shutdown", "reboot", "halt", "init",
    # Network (no outbound from shell)
    "curl", "wget", "nc", "ncat", "netcat", "ssh", "scp", "sftp", "ftp",
    "telnet", "nmap", "dig", "nslookup",
    # Privilege escalation
    "sudo", "su", "doas", "runas",
    # Permission changes
    "chmod", "chown", "chgrp", "icacls", "cacls", "takeown",
    # Shell interpreters (bypass vector — can run any blocked cmd inside)
    "cmd", "powershell", "pwsh", "bash", "sh", "zsh", "fish",
    "csh", "tcsh", "ksh", "dash",
    # Script interpreters (can execute arbitrary code)
    "python", "python3", "python3.11", "python3.12", "python3.13",
    "node", "bun", "deno", "ruby", "perl", "php", "lua",
    "java", "javac",
    # Windows registry
    "reg", "regedit",
    # Windows script hosts
    "wscript", "cscript", "mshta",
    # Windows LOLBins (common living-off-the-land binaries)
    "certutil", "bitsadmin", "regsvr32", "rundll32", "msiexec",
    "wmic", "forfiles", "pcalua", "cmstp", "infdefaultinstall",
    "msbuild", "installutil",
    # Package managers (could install malicious packages)
    "pip", "pip3", "npm", "npx", "yarn", "pnpm", "gem", "cargo",
    # Environment manipulation
    "env", "export", "setx", "set",
    # Disk/mount
    "mount", "umount", "fdisk", "parted", "diskpart",
    # Process control
    "kill", "killall", "pkill", "taskkill",
}

# Dangerous characters that could indicate shell injection
_DANGEROUS_CHARS = re.compile(r'[|;&`$]|>\s|<\s|>>|<<|\$\(|`')

_SAFE_ROOTS: list[str] = [
    str(Path.home()),
    "C:/Users",
    "C:\\Users",
    "C:/tmp",
    "C:\\tmp",
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
    """
    # Check for dangerous shell metacharacters BEFORE parsing
    if _DANGEROUS_CHARS.search(command):
        return {
            "output": "Command contains blocked characters (pipes, redirects, semicolons, backticks, $).",
            "exit_code": 1,
            "blocked": True,
            "block_reason": "Shell metacharacters detected — use separate commands instead",
        }

    # Parse into argument list
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

    # Check base command
    base_cmd = os.path.basename(args[0]).lower()
    if base_cmd.endswith(".exe"):
        base_cmd = base_cmd[:-4]
    if base_cmd.endswith(".cmd") or base_cmd.endswith(".bat"):
        base_cmd = base_cmd[:-4]

    if base_cmd in BLOCKED_COMMANDS:
        return {
            "output": f"Command '{base_cmd}' is blocked for security reasons.",
            "exit_code": 1,
            "blocked": True,
            "block_reason": f"'{base_cmd}' is on the blocked-commands list",
        }

    # Also check if any argument starts with a known interpreter path
    for arg in args[1:]:
        arg_base = os.path.basename(arg).lower()
        if arg_base.endswith(".exe"):
            arg_base = arg_base[:-4]
        if arg_base in BLOCKED_COMMANDS:
            return {
                "output": f"Argument references blocked command '{arg_base}'.",
                "exit_code": 1,
                "blocked": True,
                "block_reason": f"Argument '{arg_base}' is blocked",
            }

    # Working directory confinement
    cwd = str(Path(working_dir).expanduser().resolve()) if working_dir else str(Path.home())

    if working_dir:
        cwd_path = str(Path(cwd))
        confined = any(cwd_path.startswith(root) for root in _SAFE_ROOTS)
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
