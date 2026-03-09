# Solar AI OS — Build Story
> "The AI that orbits around you."

This document is the full story of Solar AI OS — every decision, every dead end, every breakthrough — written as we went. It doubles as internal documentation and the foundation of our public narrative.

---

## The Idea

**The problem:** Everyone is building AI assistants that are generic, stateless, and forgettable. They don't know you. They don't remember what you told them last week. They live in a browser tab you close and reopen and start from zero every time.

**The insight:** Your life isn't one thing. You're a founder AND a parent AND someone trying to stay healthy AND someone managing money. Generic AI treats all of that as one blob. We wanted AI that organizes itself around how you actually think — in domains, in contexts, in worlds.

**The metaphor:** A solar system. You are the Sun. Everything orbits around you. Each planet is a domain of your life — Work, Health, Finance, Travel, whatever matters to you. Each planet has its own gravity — its own memory, history, and context. The AI lives in the Sun and reaches into any planet when you need it.

This metaphor isn't just visual. It's the product philosophy. **You are the center. The AI orbits around you.**

---

## Phase 0 — Laying the Foundation

### The Stack Decision

We evaluated several approaches before landing on this stack:

| Option | Considered | Why We Rejected It |
|--------|------------|-------------------|
| Electron + Node backend | Yes | Too heavy, Chromium + Node = huge bundle |
| Pure web app | Yes | No local file access, no sidecar, no offline |
| Swift/SwiftUI | Yes | macOS only, no Windows |
| **Tauri + Python sidecar** | **Chosen** | Lightweight Rust shell, Python for AI logic, cross-platform |

**Final stack:**
- **Tauri v2** (Rust) — desktop shell, window management, OS integration
- **React + TypeScript + Vite** — UI, hot reload, type safety
- **Python FastAPI** — AI logic, tool execution, all LLM calls
- **SQLite (aiosqlite)** — local database, zero config, works in packaged app
- **Anthropic Claude API** — claude-sonnet for chat, claude-haiku for background tasks
- **PyInstaller** — bundles Python + all dependencies into a single `.exe` sidecar

**Why Python for the backend instead of Rust?**
Claude's SDK is Python-first. The ecosystem for AI tooling (Gmail API, calendar, web search) is Python. Moving fast matters more than optimal performance for a v0.1.

**Why local-first?**
Privacy is a genuine competitive advantage. Your emails, your calendar, your files, your conversations — none of it leaves your machine. No cloud DB, no telemetry, no SaaS middleman. Your data stays yours.

### Initial Commit
`7b362e6` — First commit. Empty shell. The name, the philosophy, the directory structure.

---

## Phase 1 — The MVP

### Step 1: Agent Service + SQLite Schema

The first real code was the Python agent service. Core decisions:

**Database schema (SQLite):**
- `planets` table — user's domains (Work, Health, etc.)
- `messages` table — full conversation history per planet
- `memories` table — what Solar knows about the user
- `tasks` table — tasks surfaced or created through conversation
- `user_profile` table — personality/communication style observations

**DB path:** `~/.solar-ai/solar_ai.db`

Why home directory? Packaged apps can't write to `Program Files`. Early mistake: we had the path as relative to the executable. This broke everything in production. Fixed to absolute home dir path.

📸 *[Screenshot: SQLite schema diagram / DB browser view]*

### Step 2: Claude Integration

The chat endpoint (`/chat`) was the heart of the service. Key architectural decision:

**Tool loop pattern:** Claude responds → detects `tool_use` stop reason → executes tool → sends result back → Claude continues. This loop runs up to 10 iterations before forcing a final answer.

**Tools available to Solar:**
- `get_gmail_summary` / `get_unread_emails` / `get_email_body` — Gmail integration
- `search_web` / `fetch_url` — Brave Search + Tavily fallback
- `get_upcoming_events` / `create_calendar_event` — Google Calendar
- `read_file` — local file access (up to 1MB)
- `run_shell_command` — sandboxed terminal (blocklist enforced, 30s timeout, no `shell=True`)

**Security thinking:** Shell access is genuinely powerful. We blocked: `rm -rf`, `del /f`, `format`, `shutdown`, `reboot`, `mkfs`, `dd`, and anything that pipes to shell. Working directory sandboxed to user home. Every tool call is logged.

### Step 3: The Solar System UI

This is where the product became real. The solar system isn't decoration — it IS the navigation paradigm.

📸 *[Screenshot: Solar system main view with planets orbiting]*

**Implementation:**
- Pure CSS animations — orbiting planets use `transform: rotate(Xdeg) translateX(Ypx) rotate(-Xdeg)` to keep planets upright while orbiting
- Each planet is a clickable entity that slides open a side panel
- The Sun is the central AI — clicking it opens a global chat (future feature: proactive notifications)
- Planets are color-coded (auto-generated from name hash for consistency)

**The panel:** Slides in from the right. Three tabs: Chat, Tasks, Memory. Resizable via drag handle on the left edge (min 320px, max 760px).

📸 *[Screenshot: Planet detail panel open with chat tab]*

### Step 4: Auth + Security

**SOLAR_API_KEY:** Optional auth gate. If set, every request requires `X-Api-Key` header. Designed for when we host a relay server — users set a Solar-specific key, not their Anthropic key.

**CORS challenge (packaged app):**
On Windows, Tauri v2 uses Chromium's WebView2. The origin is `http://tauri.localhost` — NOT `tauri://localhost` (which is macOS/Linux). This burned us. Every POST request failed with CORS errors in the packaged app even though the dev version worked fine. Fixed by adding all four origin variants to the allowlist.

**API key storage:** OS keychain (Windows Credential Manager) via `keyring` library, with `~/.solar-ai/.env` as fallback. Never stored in the app bundle.

📸 *[Screenshot: Onboarding — API key setup screen]*

### Step 5: Gmail OAuth

Full OAuth2 flow — in-app, no file management required.

The flow:
1. User clicks "Connect Gmail" in Settings
2. App calls `/gmail/auth` → server generates state token → returns Google OAuth URL
3. UI opens URL in system browser via `open::that()`
4. User authorizes → Google redirects to `http://localhost:8000/gmail/callback`
5. Server exchanges code for tokens → stores in keychain + `.env`
6. UI polls `/gmail/status` until connected

**Key decision:** State tokens are 10-minute TTL, single-use. Prevents CSRF. The callback page is a plain HTML page served by FastAPI — no React involved, no WebSocket needed.

📸 *[Screenshot: Settings panel — Gmail connected, green checkmark]*

### Step 6: Tasks System

Tasks surface organically through conversation. When Solar notices you're committing to something ("I need to finish that report by Friday"), it can create a task. The Tasks tab in each planet shows pending/completed tasks for that domain.

Also built: APScheduler integration for daily briefings at 8am. Solar generates a personalized morning briefing based on your emails, calendar, and what it knows about you — delivered as a notification when you open the app.

📸 *[Screenshot: Tasks tab with a list of tasks]*

---

## Phase 2 — Making It Real

### The Packaging Problem

Packaging a Python + Tauri app into a distributable installer was the hardest engineering challenge. Issues we hit:

**Problem 1: PyInstaller hidden imports**
`apscheduler` and `keyring` use dynamic imports that PyInstaller can't detect automatically. The sidecar would start but crash immediately with `ModuleNotFoundError`. Fix: explicitly add them to `hiddenimports` in `solar_agent.spec`.

**Problem 2: DB path**
Relative path worked in dev, silently broke in production (the exe runs from `C:\Program Files\...` which is read-only). Fix: `Path.home() / ".solar-ai" / "solar_ai.db"`.

**Problem 3: Stale process on restart**
When the app relaunches after a crash, the old `solar-agent.exe` still holds port 8000. The new sidecar fails to start. Fix: `taskkill /F /IM solar-agent.exe /T` in `lib.rs` before spawning the new sidecar.

**Problem 4: CORS in packaged app**
See above — Windows WebView2 origin is `http://tauri.localhost`. Added to CORS allowlist.

**Problem 5: Hardcoded `/api/` prefix**
Vite's dev proxy strips `/api` before forwarding to `localhost:8000`. In production there's no proxy — bare `http://localhost:8000` is correct. Four places in the UI had hardcoded `/api/` fetch calls. Fixed with `import.meta.env.DEV` detection.

```typescript
export const BASE_URL = import.meta.env.DEV ? "/api" : "http://localhost:8000";
```

📸 *[Screenshot: Packaged app running — solar system visible, no errors]*

### The Memory System

This is what makes Solar different from a chat window with a space theme.

**The problem with most AI memory:** It's a flat list of facts. "User likes coffee. User works at Acme Corp." That's a database, not understanding.

**Our approach:** Typed memories with importance scores, extracted automatically after every conversation turn.

Memory types:
- `fact` — objective info ("based in London", "has a startup called SolarAI")
- `preference` — what they like/dislike ("wants direct answers, no caveats")
- `goal` — active goals ("wants to launch by Q2")
- `person` — people in their life ("Alex is their co-founder")
- `pattern` — behavioral patterns ("messages late at night", "pivots quickly")

**Global vs. scoped:** Memories can be global (apply across all planets) or scoped to a specific planet. "User is a morning person" is global. "Prefers technical depth in the Work planet" is scoped.

**Personality profile:** Separate from memories. Tracks communication style, energy level, how they think, what they value. Updated with confidence scores — high-confidence observations don't get overwritten by weak signals.

**Extraction:** After every assistant reply, a background call to claude-haiku extracts what's worth remembering. Haiku is fast and cheap — perfect for this use case.

📸 *[Screenshot: Memory tab showing user profile + typed memories with badges]*

### Streaming Responses

Early versions waited for the full response before displaying anything. For complex queries that trigger multiple tool calls, this meant 10-20 second blank screens.

Switched to Server-Sent Events (SSE) streaming:
1. Text tokens stream in real-time as Claude generates them
2. Tool activity shows inline: "Searching the web…", "Reading your emails…"
3. Memory extraction happens after the final token, before the stream closes
4. `done` event signals the client to finalize the message

📸 *[Screenshot: Chat with streaming text appearing, tool activity indicator visible]*

---

## The Architecture Today

```
┌─────────────────────────────────┐
│         Tauri v2 Shell          │  ← Rust, handles OS, windows, sidecar
│  ┌───────────────────────────┐  │
│  │    React + TypeScript UI  │  │  ← Solar system view, planet panels
│  │    (http://tauri.localhost)│  │
│  └────────────┬──────────────┘  │
│               │ HTTP            │
│  ┌────────────▼──────────────┐  │
│  │  Python FastAPI Sidecar   │  │  ← All AI logic, tools, DB writes
│  │  (http://localhost:8000)  │  │
│  │  ┌────────┐ ┌──────────┐  │  │
│  │  │ SQLite │ │ Claude   │  │  │
│  │  │ ~home  │ │ API      │  │  │
│  │  └────────┘ └──────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Data flow for a chat message:**
1. User types → React POSTs to `/chat/stream`
2. FastAPI loads planet context + memories + user profile
3. Claude generates response (streaming)
4. Tool calls execute inline (Gmail, Calendar, web search, shell)
5. Response streams back token by token via SSE
6. Memory extraction runs in background
7. Messages saved to SQLite

---

## What's Next

### Near-term (v0.2)
- **Proactive Solar** — push notifications, pattern surfacing, daily briefings delivered to desktop
- **Web version** — Next.js frontend + hosted Python backend (same agent, same memory, accessible anywhere)
- **Abstract the API key** — hosted relay so users sign in with email instead of managing Anthropic keys

### Medium-term (v0.3)
- **Planet substance** — each planet type has specialized tools and context (Finance planet has budget tracking, Health planet has habit logging)
- **macOS + Linux builds** — currently Windows only
- **Notion/Obsidian integration** — read your notes, surface relevant context

### Long-term vision
- Multi-device sync (Supabase backend option)
- iPhone companion app
- Code signing for enterprise distribution
- Plugin ecosystem — third-party planet types

---

## Decisions We're Proud Of

1. **Solar system metaphor as product philosophy, not decoration** — the spatial organization of your life into orbiting domains is genuinely novel
2. **Local-first by default** — your data doesn't leave your machine. Full stop.
3. **Typed memory with importance scores** — not a flat list of facts, but a weighted model of who you are
4. **Haiku for background extraction** — cheap, fast, right-sized for the task
5. **CSS display:none for tab switching** — keeps React state alive without re-mounting the chat component
6. **taskkill before sidecar spawn** — eliminates the ghost process problem on Windows without ceremony

## Decisions We'd Make Differently

1. **Relative DB path** — should have been absolute from day one
2. **Hardcoded `/api/` prefix** — should have used env-aware BASE_URL from the start
3. **asyncio.create_task for memory extraction** — fire-and-forget in a streaming generator is unreliable; should have been awaited from the start
4. **CORS allowlist** — should have included all Tauri origin variants before first packaged build

---

*Documentation updated: March 2026*
*Build started: Early 2026*
*Current version: v0.1.0*
