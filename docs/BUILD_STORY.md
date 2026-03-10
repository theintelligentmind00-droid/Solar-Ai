# Solar AI OS — Build Story
> "The AI that orbits around you."

Full technical build log — every decision, every fix, real code. Written for engineers.

---

## 📋 How to Import This Into Notion

**Step 1 — Open this file**
Open `docs/BUILD_STORY.md` in VS Code (or any text editor).

**Step 2 — Copy everything**
Select all (`Ctrl+A`) → Copy (`Ctrl+C`).

**Step 3 — Paste into Notion**
Open Notion → create a new full-page → paste (`Ctrl+V`).
Notion auto-converts markdown: headings, code blocks, tables, bullets — all import cleanly.

**Step 4 — Add the screenshots**
The screenshots are on your machine at `C:\Users\liamf\Pictures\Screenshots\`.
For each `📸 Screenshot` section below:
- Click into the Notion page at that spot
- Type `/image` → choose "Upload"
- Upload the file listed in that section

**That's it.** The page is ready to share.

---

## The Idea

The problem: every AI assistant is stateless and generic. You explain yourself every single time. Your startup goals, your co-founder's name, your communication style — blank slate on every conversation.

The second problem: your life isn't one thing. Work is not the same as health. Health is not the same as finance. Generic chat treats all of it as one blob.

The insight: build an AI that organizes itself around how you actually think — in domains, in contexts, in worlds.

**The solar system metaphor:** You are the Sun. Everything orbits around you. Each planet is a domain of your life — Work, Health, Finance, Travel. Each planet has its own gravity — its own memory, history, and context. The AI lives in the Sun and reaches into any planet when you need it.

This is not just visual. It's the product philosophy.

📸 **Upload:** `Screenshot 2026-03-09 201207.png`
*(The Metaphor/Codex screen — Sun, Planets, Moons, Satellites explained)*

---

## Stack Decision

| Option | Verdict | Reason |
|--------|---------|--------|
| Electron + Node | Rejected | Chromium + Node runtime = massive bundle, no clean sidecar story |
| Pure web app | Rejected | No local file access, no offline, no OS integration |
| Swift/SwiftUI | Rejected | macOS only |
| **Tauri v2 + Python sidecar** | **Chosen** | Lightweight Rust shell (~4MB), Python for all AI logic, cross-platform |

**Final stack:**
- **Tauri v2** (Rust) — desktop shell, OS integration, spawns the Python sidecar
- **React + TypeScript + Vite** — UI layer, pure display, zero direct DB access
- **Python FastAPI** — all AI logic, tool execution, memory, LLM calls
- **SQLite + aiosqlite** — zero-config local database, fully async
- **Anthropic Claude API** — `claude-sonnet-4-6` for chat, `claude-haiku-4-5` for background extraction
- **PyInstaller** — bundles the entire Python runtime + dependencies into one `.exe`

---

## 📸 Screenshot 1 — Solar System View

📸 **Upload:** `Screenshot 2026-03-09 190810.png`
*(The main solar system — dark space, orbiting planets, "Launch new mission" button)*

---

## The Rust Sidecar — `lib.rs`

The Tauri shell (Rust) spawns the Python FastAPI server as a sidecar process. This is the entry point when the app opens.

Three things it does that matter:

**1. Kill stale processes before spawning.** If the app crashes or is force-quit, the old `solar-agent.exe` stays alive and holds port 8000. Next launch fails. Fix: unconditional `taskkill` before every spawn.

**2. Stream all sidecar stdout/stderr to a log file.** No debugger in production — `~/.solar-ai/sidecar.log` is the only window into what the Python process is doing.

**3. Kill the sidecar cleanly on window close.** Without this, closing the UI leaves the Python server running forever in the background.

```rust
// lib.rs — abbreviated

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Kill any stale solar-agent from a previous session
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/IM", "solar-agent.exe", "/T"])
                .output();

            let (rx, child) = app.shell()
                .sidecar("solar-agent")?
                .spawn()?;

            // Stream stdout/stderr to ~/.solar-ai/sidecar.log
            tauri::async_runtime::spawn(async move {
                let mut rx = rx;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => write_log(&lp2, &format!("[stdout] {}", ...)),
                        CommandEvent::Stderr(line) => write_log(&lp2, &format!("[stderr] {}", ...)),
                        CommandEvent::Terminated(status) => break,
                        _ => {}
                    }
                }
            });

            // Store handle so we can kill it on window close
            *app.state::<SidecarState>().0.lock().unwrap() = Some(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill(); // clean shutdown
                }
            }
        })
}
```

---

## The Agentic Tool Loop — `chat.py`

This is the core of the product. Claude gets a message, decides whether to use tools, uses them, and loops until it has a final answer. Up to 8 rounds.

The non-streaming version (still used internally) is clean:

```python
# Agentic loop: let Claude call tools until it produces a final text reply
for _ in range(8):  # max 8 tool rounds
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        tools=_TOOLS,
        messages=messages,
    )

    if response.stop_reason == "tool_use":
        tool_results = []
        assistant_content = []

        for block in response.content:
            assistant_content.append(block)
            if block.type == "tool_use":
                result = await _run_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})
        continue  # back to top — Claude sees tool results and continues

    # stop_reason == "end_turn" — we have a final answer
    reply = next(block.text for block in response.content if hasattr(block, "text"))
    break
```

The streaming version is more complex — it has to stream text tokens AND handle tool calls in the same generator:

```python
@router.post("/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:

    async def generate():
        for _ in range(8):  # agentic loop
            async with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                tools=_TOOLS,
                messages=messages,
            ) as stream:
                # Stream text tokens to the client in real-time
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
                final = await stream.get_final_message()

            if final.stop_reason == "tool_use":
                for block in final.content:
                    if block.type == "tool_use":
                        # Tell the UI what tool is running
                        yield f"data: {json.dumps({'type': 'tool_start', 'name': block.name})}\n\n"
                        result = await _run_tool(block.name, block.input)
                        yield f"data: {json.dumps({'type': 'tool_end', 'name': block.name})}\n\n"
                        tool_results.append({...})

                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({"role": "user", "content": tool_results})
                continue  # loop — Claude sees results and keeps going

            break  # end_turn — done

        # Save messages + extract memories BEFORE signalling done
        await save_message(planet_id, "user", body.message)
        await save_message(planet_id, "assistant", full_reply)
        await smart_extract_memories(body.message, full_reply, ...)

        yield f"data: {json.dumps({'type': 'done', 'planet_id': body.planet_id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Key call order:** memory extraction runs with `await` before the `done` event — not as a background task. Early versions used `asyncio.create_task()` which is fire-and-forget inside a generator, meaning the stream could close before extraction finished. Memories were silently dropped.

---

## 📸 Screenshot 2 — Streaming Chat

📸 **Upload:** `Screenshot 2026-03-09 193954.png`
*(Agent mid-response — streaming text or tool indicator visible)*

---

## The Memory System — `memory.py`

The memory system is what separates this from a themed chat window.

After every reply, a background call to `claude-haiku-4-5` extracts what's worth remembering. The extraction model gets a tight system prompt:

```python
_EXTRACTION_SYSTEM = """
You are the memory and personality engine for Solar AI OS.

Return ONLY valid JSON with this structure:
{
  "memories": [{
    "key": "snake_case_identifier",
    "value": "specific, rich description",
    "type": "fact|preference|goal|person|pattern",
    "importance": 0.7,
    "global": true
  }],
  "profile": [{
    "key": "communication_style",
    "value": "terse, direct, no filler words",
    "confidence": 0.8
  }]
}

MEMORY TYPES:
- fact:       Objective ("builds a startup called SolarAI", "based in London")
- preference: What they like/dislike ("hates bullet lists", "wants direct answers")
- goal:       Active goals ("wants to launch by Q2")
- person:     People in their life ("Alex is his co-founder")
- pattern:    Behavioral patterns ("messages late at night", "pivots quickly")

"global": true = about them as a person across all projects.
"global": false = specific to THIS project only.

IMPORTANCE: 0.9+ = defining identity. 0.7-0.89 = high. 0.5-0.69 = medium. 0.3-0.49 = low.
Max 4 memories per turn. Only save genuinely worth-remembering, long-term information.
"""
```

Memories are stored with upsert semantics — consistent keys update existing memories instead of creating duplicates:

```python
async def upsert_memory(key, value, planet_id, memory_type, importance):
    async with aiosqlite.connect(DB_PATH) as db:
        existing = await db.execute(
            "SELECT id FROM memories WHERE key = ? AND planet_id = ?",
            (key, planet_id)
        )
        if existing:
            await db.execute("""
                UPDATE memories
                SET value = ?, type = ?, importance = ?,
                    last_accessed = datetime('now'),
                    access_count = access_count + 1
                WHERE id = ?
            """, (value, memory_type, importance, existing[0]))
        else:
            await db.execute("""
                INSERT INTO memories (id, planet_id, key, value, type, importance, ...)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)
            """, (uuid4(), planet_id, key, value, memory_type, importance))
```

The memory is injected into every system prompt as a structured context block:

```python
def build_context_block(planet_name, profile, categorized):
    parts = []

    if profile:
        lines = [f"- **{label}:** {value}" for key, value in profile.items()]
        parts.append("## Who you're talking to:\n" + "\n".join(lines))

    for mem_type, label in TYPE_LABELS.items():
        items = categorized.get(mem_type, [])[:10]  # cap at 10 per category
        if items:
            lines = [f"- {value}" for _, value in items]
            parts.append(f"## {label}:\n" + "\n".join(lines))

    return f"# Your knowledge of this person (project: {planet_name})\n\n" + "\n\n".join(parts)
```

---

## 📸 Screenshot 3 — Memory Tab

📸 **Upload:** `Screenshot 2026-03-09 200941.png`
*(Memory tab — user profile, typed memory badges: fact, goal, preference)*

---

## The Shell Sandboxing — `skills/shell.py`

Solar can run terminal commands on your behalf. With that power comes a security surface. The sandboxing has three layers:

**Layer 1 — Blocklist.** A hardcoded set of commands that never run, ever.

```python
BLOCKED_COMMANDS: set[str] = {
    "rm", "del", "format", "mkfs", "dd",         # destructive filesystem
    "shutdown", "reboot", "halt",                  # OS control
    "curl", "wget", "nc", "ncat", "netcat",        # no outbound network from shell
    "sudo", "su", "chmod", "chown",               # privilege escalation
    "reg", "regedit",                              # Windows registry
    "cmd", "powershell", "pwsh",                  # shell interpreter spawning
    "wscript", "cscript", "mshta",                # Windows script hosts
    "certutil", "bitsadmin",                      # LOLBins
    "regsvr32", "rundll32", "msiexec", "wmic",    # Windows exec primitives
}
```

**Layer 2 — Never `shell=True`.** Always `asyncio.create_subprocess_exec(*args)` with a parsed argument list. No string interpolation into a shell. No injection surface.

```python
# Safe — args is a list from shlex.split(), no shell=True
proc = await asyncio.create_subprocess_exec(
    *args,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.STDOUT,
    cwd=cwd,
)
```

**Layer 3 — Working directory confinement + 30s timeout.**

```python
_SAFE_ROOTS = [str(Path.home()), "C:/Users", "C:/tmp", "/tmp", "/home"]

if not any(str(cwd_path).startswith(root) for root in _SAFE_ROOTS):
    return {"blocked": True, "block_reason": "working_dir outside allowed roots"}

stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
```

---

## The CORS Bug That Broke the Packaged App

This one was a significant time sink. Everything worked in dev. Nothing worked in the `.exe`.

**Root cause:** Tauri v2 on Windows uses Chromium's **WebView2** engine. WebView2 sets the browser's `Origin` header to `http://tauri.localhost`. On macOS/Linux it's `tauri://localhost`. These are different strings. Our CORS allowlist only had the macOS version.

Every POST request from the packaged Windows app was getting silently blocked by CORS preflight. GETs worked (no preflight). POSTs didn't. So the health check passed but every chat message failed.

```python
# main.py — CORS origins
_ALLOWED_ORIGINS = [
    "http://localhost:1420",       # Tauri dev server
    "http://localhost:5173",       # Vite dev server
    "http://localhost:8000",       # Same-origin (OAuth callback)
    "tauri://localhost",           # Tauri production — macOS/Linux
    "http://tauri.localhost",      # Tauri production — Windows WebView2
    "https://tauri.localhost",     # Tauri production — Windows, secure context
]
```

Four characters. Fixed it.

---

## The BASE_URL Bug

Related issue. In dev, Vite proxies `/api/*` requests to `http://localhost:8000/*`, stripping the `/api` prefix. In the packaged app, there's no proxy. The bare URL is `http://localhost:8000`.

Four places in the UI had hardcoded `/api/setup/api-key`, `/api/health`, etc. In the packaged app, these silently failed — meaning API keys entered during onboarding were never saved.

```typescript
// api/agent.ts
// Before: BASE_URL = "/api"  — only worked with Vite proxy
// After:
export const BASE_URL = import.meta.env.DEV
  ? "/api"           // Vite proxy strips this and forwards to localhost:8000
  : "http://localhost:8000";  // packaged app: direct to sidecar
```

---

## 📸 Screenshot 4 — Settings: Gmail + Calendar Connected

📸 **Upload:** `Screenshot 2026-03-09 193722.png`
*(Settings & Permissions — Gmail connected ✓, Google Calendar connected ✓, both green)*

---

## The Gmail OAuth Flow — `skills/gmail.py`

Full OAuth2 in-app. No token files to manage. The flow:

1. UI calls `GET /gmail/auth` → server generates a `state` token (10-min TTL, single-use) → returns Google OAuth URL
2. Tauri opens the URL in the system browser via `open::that()`
3. User authorizes → Google redirects to `http://localhost:8000/gmail/callback`
4. Server exchanges code for tokens → stores in Windows Credential Manager via `keyring`
5. UI polls `GET /gmail/status` every 2s until connected

State tokens are UUID4, stored in a dict with a timestamp. Validated on callback:

```python
_pending_states: dict[str, float] = {}  # state → timestamp

@router.get("/auth")
async def gmail_auth():
    state = str(uuid.uuid4())
    _pending_states[state] = time.time()
    url = flow.authorization_url(state=state)[0]
    return {"url": url}

@router.get("/callback")
async def gmail_callback(code: str, state: str):
    ts = _pending_states.pop(state, None)
    if ts is None or time.time() - ts > 600:  # 10 min TTL
        raise HTTPException(400, "Invalid or expired state")
    # exchange code for tokens, store in keychain...
```

---

## 📸 Screenshot 5 — Gmail OAuth Setup Flow

📸 **Upload:** `Screenshot 2026-03-09 191224.png`
*(Settings panel mid-setup — Gmail OAuth credentials form with 3-step instructions)*

---

## 📸 Screenshot 6 — Gmail Summary in Chat

📸 **Upload:** `Screenshot 2026-03-09 201023.png`
*(Planet chat showing Gmail summary tool result — real emails summarized by Solar)*

📸 **Also upload:** `Screenshot 2026-03-09 201145.png` and `Screenshot 2026-03-09 201154.png`
*(Additional chat screenshots — briefings, calendar, or tool activity)*

---

## The PyInstaller Packaging — `solar_agent.spec`

Getting the Python sidecar to bundle correctly was the hardest part of the project.

`apscheduler` and `keyring` both use dynamic imports — they scan for installed backends at runtime using `importlib`. PyInstaller's static analysis can't see these. Without explicit `hiddenimports`, the bundled exe starts and immediately crashes with `ModuleNotFoundError`.

The fix in `solar_agent.spec`:

```python
hiddenimports=[
    # APScheduler job stores and executors
    'apscheduler.schedulers.asyncio',
    'apscheduler.schedulers.background',
    'apscheduler.executors.pool',
    'apscheduler.jobstores.memory',
    # keyring backends — Windows Credential Manager
    'keyring.backends',
    'keyring.backends.Windows',
    'keyring.backends.fail',
    'keyring.backends.null',
],
```

Also critical: the DB path. Relative paths work in dev but the packaged exe runs from `C:\Program Files\Solar AI OS\` which is read-only. Every DB write silently fails.

```python
# db/schema.py
# Before: DB_PATH = "solar_ai.db"  — read-only in Program Files
# After:
DB_PATH = str(Path.home() / ".solar-ai" / "solar_ai.db")
```

Same fix for `briefing_schedule.json` and all other data files.

---

## Architecture: How It All Fits

```
┌───────────────────────────────────────────────┐
│               Tauri v2 Shell (Rust)            │
│  ┌─────────────────────────────────────────┐  │
│  │      React + TypeScript UI              │  │
│  │      (http://tauri.localhost)           │  │
│  │  - Solar system view (pure CSS)         │  │
│  │  - Planet panels (slide in from right)  │  │
│  │  - SSE stream reader (chat)             │  │
│  └──────────────────┬──────────────────────┘  │
│                     │ HTTP/SSE                 │
│  ┌──────────────────▼──────────────────────┐  │
│  │    Python FastAPI Sidecar               │  │
│  │    (http://localhost:8000)              │  │
│  │                                         │  │
│  │  routes/chat.py  ← agentic tool loop   │  │
│  │  memory/memory.py ← extract + store    │  │
│  │  skills/gmail.py  ← OAuth + read       │  │
│  │  skills/shell.py  ← sandboxed exec     │  │
│  │  skills/web_search.py ← Brave/Tavily   │  │
│  │                                         │  │
│  │  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │ SQLite   │  │ Anthropic Claude  │   │  │
│  │  │ ~/.solar │  │ sonnet + haiku    │   │  │
│  │  └──────────┘  └───────────────────┘   │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

**Data flow for a streaming chat message:**
1. User types → React POSTs to `/chat/stream`
2. FastAPI loads conversation history + user profile + typed memories
3. `build_context_block()` assembles a structured system prompt with everything known about the user
4. Claude generates response (streaming via SSE)
5. Tool calls execute inline — Gmail, Calendar, web search, shell
6. Text tokens stream to UI in real-time
7. Tool activity events (`tool_start`/`tool_end`) show UI indicators
8. Memory extraction runs (`await` — not fire-and-forget) before `done` event
9. Messages saved to SQLite

---

## What We'd Do Differently

1. **Absolute DB path from day 1.** Relative path works in dev, silently breaks in production. Always use `Path.home()`.
2. **Test the packaged build, not just dev.** CORS bug and BASE_URL bug both only appeared in the `.exe`. Would have been caught immediately with a packaged test.
3. **`await` background tasks, don't fire-and-forget.** `asyncio.create_task()` inside a streaming generator is unreliable — the generator can close before the task runs.
4. **Include all Tauri WebView origins in CORS from the start.** macOS (`tauri://localhost`) and Windows (`http://tauri.localhost`) are different. Both needed.

---

## What's Next

**v0.2 — Proactive Solar**
Solar pushes information to you instead of waiting to be asked. Daily briefings delivered as desktop notifications. Pattern surfacing: "You've mentioned being behind on X three times this week." Scheduled tasks that actually run.

**v0.3 — Web Version**
Same agent, same memory system, accessible from any browser. Next.js frontend + hosted Python backend. Supabase for multi-device sync.

**v0.4 — iPhone App**
Your solar system in your pocket. React Native or Swift. Real-time sync with desktop.

**Long-term — Abstract the API key**
Host a relay server. Users sign in with email. We handle the Anthropic API costs. No key management, no friction, no barrier to entry.

---

## v0.1.1 — The "It Actually Works" Update

Released shortly after v0.1.0 when we discovered that Gmail and Calendar were silently failing in production. Three bugs, one root cause: the Google API client library.

### The httplib2 Timeout Problem

`google-api-python-client` uses `httplib2` under the hood. `httplib2` has no default socket timeout. On Windows with Python 3.14, fetching 15 emails in parallel via `asyncio.to_thread` would deadlock on SSL reads:

```
TimeoutError: The read operation timed out
  File "httplib2/__init__.py", line 1399, in _conn_request
    response = conn.getresponse()
  File "ssl.py", line 1138, in read
    return self._sslobj.read(len, buffer)
```

The agent (Solar) would catch this, pass it to Claude as a tool error, and Claude would hallucinate an explanation about "SSL config issues" — because it had no idea what the real error was. That's what the user saw.

### The Fix: Replace the Entire Stack

Instead of patching `httplib2`, we removed it. Rewrote both `skills/gmail.py` and `skills/calendar.py` to use `httpx` directly — the same async HTTP client already in the project.

```python
# Before: blocking httplib2 via asyncio.to_thread
service = await get_service()  # builds google-api-python-client
result = await asyncio.to_thread(
    lambda: service.users().messages().list(...).execute()
)

# After: pure async httpx
async with httpx.AsyncClient(timeout=20, headers=auth_headers) as client:
    resp = await client.get(f"{GMAIL_API}/users/me/messages", params=...)
    resp.raise_for_status()
```

Result: no threads, explicit 20s timeout, proper async throughout, ~3x faster.

### Token Refresh Bug

The OAuth callback was storing `expiry: None` for all tokens. The `google-auth` library checks `creds.expired` — which is always False when expiry is not set. So expired access tokens were never refreshed.

Fix: calculate and store the real expiry from `expires_in` in the token response:

```python
_expires_in = int(token_data.get("expires_in", 3600))
_expiry_iso = (
    datetime.now(timezone.utc) + timedelta(seconds=_expires_in)
).isoformat()
```

Now the refresh check compares current time against stored expiry, refreshing 5 minutes before actual expiry.

### Google Calendar API Not Enabled

The Calendar skill was getting `403 Forbidden`. Root cause: the Google Calendar API wasn't enabled in the Google Cloud project. The Gmail API and Calendar API are separate — you enable them individually in the API Library. One-click fix in the console.

## 📸 Screenshot 7 — Briefings / Houston Tab

📸 **Upload:** `Screenshot 2026-03-09 191017.png`
*(Daily briefing or Houston mission control view)*

---

### Tauri OAuth Popup Fix

`window.open()` in Tauri's WebView2 does nothing for external URLs — silently blocked. Fixed by using `openUrl()` from `@tauri-apps/plugin-opener`:

```typescript
import { openUrl } from "@tauri-apps/plugin-opener";

async function openOAuthUrl(url: string) {
  try {
    await openUrl(url);  // opens system browser
  } catch {
    window.open(url, "_blank", "width=500,height=620");  // fallback
  }
}
```

---

*Version: 0.1.0 · Build started: Early 2026 · Platform: Windows*
