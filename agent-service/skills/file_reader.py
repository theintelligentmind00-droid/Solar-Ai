"""File reading skill — reads local files and returns their content."""

from __future__ import annotations

import os

_MAX_BYTES = 1_048_576  # 1 MB

_SUPPORTED_EXTENSIONS: set[str] = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx",
    ".json", ".yaml", ".yml", ".csv", ".html", ".css",
}

# Extensions that are always blocked for security
_BLOCKED_EXTENSIONS: set[str] = {
    ".env", ".pem", ".key", ".pfx", ".p12", ".cer", ".der", ".ppk", ".kdb", ".kdbx",
}

# Path fragments that indicate sensitive directories
_BLOCKED_PATH_FRAGMENTS: list[str] = [
    ".ssh",
    ".aws",
    ".gnupg",
    "AppData\\Roaming\\Microsoft\\Credentials",
    "AppData/Roaming/Microsoft/Credentials",
]


async def read_file(path: str) -> str:
    """Read the contents of a local file and return them as a string.

    Returns a formatted string with a header, or an error message if the
    file cannot be read.
    """
    expanded = os.path.expanduser(path)
    abs_path = os.path.abspath(expanded)

    # Block sensitive path fragments
    for fragment in _BLOCKED_PATH_FRAGMENTS:
        if fragment in abs_path:
            return "Access to this path is restricted for security reasons."

    if not os.path.exists(abs_path):
        return f"Error: File not found: {path}"

    if not os.path.isfile(abs_path):
        return f"Error: Path is not a file: {path}"

    _, ext = os.path.splitext(abs_path)
    if ext.lower() in _BLOCKED_EXTENSIONS:
        return "Access to this path is restricted for security reasons."

    if ext.lower() not in _SUPPORTED_EXTENSIONS:
        return (
            f"Unsupported file type: {ext or '(no extension)'}. "
            f"Supported types: {', '.join(sorted(_SUPPORTED_EXTENSIONS))}"
        )

    try:
        file_size = os.path.getsize(abs_path)
    except OSError as exc:
        return f"Error reading file: {exc}"

    if file_size > _MAX_BYTES:
        return (
            f"Error: File is too large ({file_size:,} bytes). "
            "Maximum supported size is 1 MB."
        )

    try:
        with open(abs_path, encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError as exc:
        return f"Error reading file: {exc}"

    return f"File: {abs_path}\n\n{content}"
