"""File reading skill — reads local files and returns their content."""

from __future__ import annotations

import os

_MAX_BYTES = 1_048_576  # 1 MB

_SUPPORTED_EXTENSIONS: set[str] = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx",
    ".json", ".yaml", ".yml", ".csv", ".html", ".css",
    ".jsx", ".toml", ".cfg", ".ini", ".log", ".xml",
    ".rs", ".go", ".java", ".c", ".cpp", ".h",
}

# Extensions that are always blocked
_BLOCKED_EXTENSIONS: set[str] = {
    ".env", ".pem", ".key", ".pfx", ".p12", ".cer", ".der",
    ".ppk", ".kdb", ".kdbx",
    ".exe", ".dll", ".so", ".dylib", ".bat", ".cmd", ".ps1",
    ".msi", ".com", ".scr",
    ".sqlite", ".db", ".sqlite3",  # no reading raw DB files
}

# Path fragments that indicate sensitive directories
_BLOCKED_PATH_FRAGMENTS: list[str] = [
    ".ssh",
    ".aws",
    ".gnupg",
    ".config/gcloud",
    ".azure",
    ".docker",
    ".kube",
    ".npmrc",
    ".pypirc",
    ".netrc",
    ".git/config",
    ".git-credentials",
    # Windows-specific
    "AppData\\Roaming\\Microsoft\\Credentials",
    "AppData/Roaming/Microsoft/Credentials",
    "AppData\\Local\\Microsoft\\Credentials",
    "AppData/Local/Microsoft/Credentials",
    "AppData\\Roaming\\Microsoft\\Protect",
    "AppData/Roaming/Microsoft/Protect",
    "AppData\\Local\\Google\\Chrome\\User Data",
    "AppData/Local/Google/Chrome/User Data",
    "AppData\\Roaming\\Mozilla\\Firefox\\Profiles",
    "AppData/Roaming/Mozilla/Firefox/Profiles",
    # Linux browser profiles
    ".mozilla/firefox",
    ".config/google-chrome",
    ".config/chromium",
    # Sensitive system dirs
    "/etc/shadow",
    "/etc/passwd",
    "/etc/sudoers",
    "\\Windows\\System32\\config",
    "/proc/",
    "/sys/",
]


async def read_file(path: str) -> str:
    """Read the contents of a local file and return them as a string.

    Returns a formatted string with a header, or an error message if the
    file cannot be read.
    """
    # Block environment variable expansion tricks
    if "%" in path or "${" in path:
        return "Path contains disallowed characters (environment variable references)."

    expanded = os.path.expanduser(path)
    abs_path = os.path.abspath(expanded)

    # Block path traversal with .. AFTER normalization
    # Check if resolved path differs from abs_path (symlink attack)
    try:
        real_path = os.path.realpath(abs_path)
    except (OSError, ValueError):
        return "Error: Could not resolve file path."

    # Block sensitive path fragments on both abs_path and real_path
    for fragment in _BLOCKED_PATH_FRAGMENTS:
        if fragment in abs_path or fragment in real_path:
            return "Access to this path is restricted for security reasons."

    # If realpath differs from abspath, a symlink is involved
    # Block if the symlink target is in a blocked area
    if real_path != abs_path:
        for fragment in _BLOCKED_PATH_FRAGMENTS:
            if fragment in real_path:
                return "Access to this path is restricted for security reasons (symlink target blocked)."

    if not os.path.exists(real_path):
        return f"Error: File not found: {path}"

    if not os.path.isfile(real_path):
        return f"Error: Path is not a file: {path}"

    _, ext = os.path.splitext(real_path)
    ext_lower = ext.lower()

    if ext_lower in _BLOCKED_EXTENSIONS:
        return "Access to this file type is restricted for security reasons."

    if ext_lower not in _SUPPORTED_EXTENSIONS:
        return (
            f"Unsupported file type: {ext or '(no extension)'}. "
            f"Supported types: {', '.join(sorted(_SUPPORTED_EXTENSIONS))}"
        )

    try:
        file_size = os.path.getsize(real_path)
    except OSError as exc:
        return f"Error reading file: {exc}"

    if file_size > _MAX_BYTES:
        return (
            f"Error: File is too large ({file_size:,} bytes). "
            "Maximum supported size is 1 MB."
        )

    try:
        with open(real_path, encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError as exc:
        return f"Error reading file: {exc}"

    return f"File: {abs_path}\n\n{content}"
