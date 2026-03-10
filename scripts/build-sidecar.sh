#!/usr/bin/env bash
# build-sidecar.sh — Build the solar-agent PyInstaller bundle and place it
# where Tauri expects it: ui/src-tauri/binaries/solar-agent-<target-triple>
#
# Usage (from repo root):
#   bash scripts/build-sidecar.sh
#
# Requirements:
#   - Python venv at agent-service/.venv  (create with: python -m venv .venv)
#   - All requirements installed in the venv

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="$REPO_ROOT/agent-service"
BINARIES_DIR="$REPO_ROOT/ui/src-tauri/binaries"

echo "[build-sidecar] Repo root: $REPO_ROOT"

# ── Activate venv ────────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    VENV_ACTIVATE="$AGENT_DIR/.venv/Scripts/activate"
else
    VENV_ACTIVATE="$AGENT_DIR/.venv/bin/activate"
fi

if [[ ! -f "$VENV_ACTIVATE" ]]; then
    echo "[build-sidecar] ERROR: venv not found at $VENV_ACTIVATE"
    echo "  Create it with: python -m venv agent-service/.venv"
    exit 1
fi

# shellcheck disable=SC1090
source "$VENV_ACTIVATE"
echo "[build-sidecar] venv activated: $(python --version)"

# ── Install PyInstaller if missing ───────────────────────────────────────────
if ! python -m PyInstaller --version &>/dev/null; then
    echo "[build-sidecar] Installing PyInstaller…"
    pip install pyinstaller
fi

# ── Ensure binaries output dir exists ────────────────────────────────────────
mkdir -p "$BINARIES_DIR"

# ── Run PyInstaller ──────────────────────────────────────────────────────────
echo "[build-sidecar] Running PyInstaller…"
cd "$AGENT_DIR"
python -m PyInstaller solar_agent.spec \
    --distpath "$BINARIES_DIR" \
    --workpath "$AGENT_DIR/build" \
    --noconfirm

# ── Determine Rust target triple and rename binary ───────────────────────────
# Try to get the default target from rustc; fall back to a sensible default.
if command -v rustc &>/dev/null; then
    TARGET_TRIPLE="$(rustc -vV | grep '^host:' | awk '{print $2}')"
else
    # Fallback defaults by OS
    case "$OSTYPE" in
        msys*|cygwin*|win32*) TARGET_TRIPLE="x86_64-pc-windows-msvc" ;;
        darwin*)              TARGET_TRIPLE="aarch64-apple-darwin" ;;
        linux*)               TARGET_TRIPLE="x86_64-unknown-linux-gnu" ;;
        *)                    TARGET_TRIPLE="x86_64-pc-windows-msvc" ;;
    esac
fi

echo "[build-sidecar] Target triple: $TARGET_TRIPLE"

SRC_BIN="$BINARIES_DIR/solar-agent"
DST_BIN="$BINARIES_DIR/solar-agent-${TARGET_TRIPLE}"

# On Windows the binary produced by PyInstaller has a .exe extension
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    SRC_BIN="${SRC_BIN}.exe"
    DST_BIN="${DST_BIN}.exe"
fi

if [[ -f "$SRC_BIN" ]]; then
    cp "$SRC_BIN" "$DST_BIN"
    echo "[build-sidecar] Sidecar binary written to: $DST_BIN"
else
    echo "[build-sidecar] ERROR: expected binary not found at $SRC_BIN"
    exit 1
fi

echo "[build-sidecar] Done. You can now run: cd ui && npm run tauri build"
