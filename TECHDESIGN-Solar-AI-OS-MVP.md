# Technical Design Document: Solar AI OS MVP

## 1. How We’ll Build It

### Recommended Approach: Desktop App + Local Agent Service

**Primary Recommendation:**  
- **Desktop shell:** Tauri (or Electron if devs prefer) + React/TypeScript UI  
- **Local agent service (gateway):** Node.js or Python process running on the user’s machine  
- **Local data:** SQLite for structured data + simple vector store (e.g., local file-based or Lite vector DB) for memory  

**Why this fits you:**
- Professional, modern stack used in real products (React/TS + Tauri/Electron). [web:144][web:146][web:148][web:151]  
- Runs mostly **on the user’s machine**, minimizing infra costs (good for your $30/month budget). [web:90][web:93][web:153]  
- Easy to evolve later into “serious startup stack” (can add cloud sync, server, more services). [web:151][web:122]  
- Plenty of docs and AI examples; AI tools understand this pattern well. [web:115][web:120][web:131]  

**Budget reality:**  
- Local desktop app + local SQLite = $0 hosting cost for a long time. [web:153]  
- External cost = LLM APIs + maybe a tiny cloud for updates/analytics, which can fit inside ~$30/month at small scale. [web:54][web:82][web:142]

### Alternatives (For Future Discussion)

| Option                           | Pros                                              | Cons                                                      |
|----------------------------------|---------------------------------------------------|-----------------------------------------------------------|
| **Electron + React/TS**         | Very common, lots of examples, fast to prototype | Heavier RAM/disk than Tauri, larger installers. [web:149][web:152] |
| **Pure web app + browser**      | No installer, instant access                      | Harder to get deep local access and “runs on my machine” feeling. [web:90][web:93] |
| **Full native (Swift/.NET, etc.)** | Best performance, native look                    | Harder for web/JS devs, fewer AI-ready examples, less vibe-coder friendly. [web:150] |

Recommendation: **Tauri + React/TS** for resource‑friendly desktop, but accept Electron if your devs strongly prefer it. [web:149][web:152]

---

## 2. High-Level Architecture

### 2.1 Components

1. **Desktop Client (UI layer)**
   - Built with Tauri/Electron + React/TypeScript.
   - Renders the solar‑system dashboard, planet/project views, settings, and logs.
   - Talks to the local agent service over `http://localhost` or WebSocket. [web:90][web:93]

2. **Local Agent Service (“Gateway/Daemon”)**
   - Node.js or Python process started with the app (or separately).
   - Responsibilities:
     - Manages sessions (per “sun” and per planet/project).
     - Routes prompts and tool calls to the LLM API(s).
     - Manages memory reads/writes.
     - Orchestrates skills (email, calendar, file access).
     - Enforces security and permission rules. [web:67][web:105][web:107][web:109]

3. **Local Data Layer**
   - **SQLite** for structured data: users (local profile), planets/projects, tasks, logs, basic memories index. [web:153]  
   - Simple vector store or embedding index (file-based) for semantic memory, if needed for v1. [web:84][web:87]  

4. **External Services**
   - **LLM APIs:** Start with Claude (where your Pro gives you access) and optionally another provider later. [web:115][web:120]  
   - Optional minimal cloud:
     - Error/analytics (can be added later).
     - Update checks / release management.

### 2.2 Data Flows (Simplified)

- User types a message in the **sun chat** → Desktop client sends it to the local agent service → agent service:
  - Loads relevant memory from SQLite/vector store
  - Calls LLM API with tools (if needed)
  - Receives response, updates memory and logs
  - Returns response + updates to the desktop client for display

- When user creates/edits a **planet/project**:
  - UI sends CRUD action to local service → service updates SQLite → UI refreshes solar system view.

- When agent performs a **skill** (e.g., reading email, adding calendar event):
  - Agent service checks permission state.
  - If allowed, invokes skill adapter (which talks to email/calendar API).
  - Logs action to SQLite and surfaces in UI logs & notifications. [web:79][web:83][web:86][web:85][web:88]

---

## 3. Core MVP Features – Implementation Notes

### 3.1 Solar-System Dashboard

**Tech:**  
- React + canvas/SVG library (e.g., D3, React-Three-Fiber, or a simpler 2D lib) to render sun + planets. [web:69][web:73][web:78]  
- State stored in SQLite: `planets` table with id, name, status, size, orbit radius, type, metadata. [web:153]

**Implementation Steps (for AI tools):**
- Create React component `<SolarSystemView>` that:
  - Fetches list of planets from local service (`GET /planets`).
  - Renders central sun + planet nodes with positions computed by simple layout logic.
  - Handles click on planet → open project detail.

### 3.2 Sun Chat + Basic Memory

**Memory MVP:**
- Store chat messages in SQLite (`messages` table) with `project_id` and timestamps. [web:153]  
- For “memory,” maintain a `memories` table with key facts or summaries (like Obsidian-style nodes). [web:74][web:84][web:87]  

**LLM Interaction:**
- Agent service endpoint: `POST /chat` with `{project_id, message}`.
- Server:
  - Loads last N messages + any explicit memories for the project.
  - Calls LLM API with system prompt (persona + safety) + context. [web:115][web:120]  
  - Writes AI response as new message + optionally writes a memory if flagged.

### 3.3 Secure Foundation & Permissions

**Permission Model MVP:**
- **Config tables** in SQLite for integrations and permissions:
  - `integrations` (email, calendar, files) with status: enabled/disabled + scopes. [web:105][web:109]  
- For any risky action (sending email, modifying files):
  - Agent service must:
    - Check permission.
    - If unknown/denied, return a “permission request” object to the UI.
  - UI shows a clear prompt: “Allow AI to [action]? Once / Always / Deny.” [web:105][web:109][web:112]  

**Action Logs:**
- `logs` table recording:
  - Time, type (skill call), summary, success/failure.
- Log view in UI so users can see what the AI did.

---

## 4. Stack and Tooling Details

### 4.1 Frontend/Desktop

- **Framework:** React + TypeScript. [web:144][web:146][web:148][web:151]  
- **Desktop wrapper:** Prefer **Tauri** for light footprint (8MB vs ~100MB, better RAM/battery) but allow Electron if devs insist. [web:149][web:152]  
- **UI toolkit:** Tailwind CSS or similar for fast iteration.

### 4.2 Agent Service

- **Language:** Node.js (TypeScript) or Python — choose based on dev preference; both are well‑supported in AI/agent ecosystems. [web:67][web:151][web:122]  
- **Responsibilities:**
  - HTTP/WebSocket server on localhost.
  - LLM API client (Claude, etc.).
  - Memory/DB layer (SQLite wrappers).
  - Skill dispatch and safety checks.

### 4.3 Data & Storage

- **SQLite**:
  - Runs locally on each machine, no server needed. [web:153]  
  - Tables: users/local profile, planets/projects, messages, memories, integrations, logs.  
- **Vector/Graph memory (later):**
  - For v1, a simple key-value/summary memory is enough.
  - Later, can add a lightweight vector DB or graph layer for more advanced recall. [web:84][web:87][web:74][web:122]

---

## 5. Cost & Scaling Plan

### 5.1 MVP Cost Targets

- **Hosting/infra:** $0 (purely local desktop) for early users. [web:153][web:151]  
- **LLM/API:** Use your Claude Pro where possible; keep additional API usage minimal and test with logs. [web:115][web:120][web:54][web:82]  
- **Monitoring/analytics:** Optional and can be free/cheap (or skipped for the first few users).

### 5.2 When Budget is Tight ($30/month)

- Prioritize:
  - LLM API usage for your own testing + a handful of friends.
  - Avoid external DBs/servers until necessary.
- Use:
  - Local SQLite only.
  - Manual feedback instead of heavy analytics.

### 5.3 When Parents Invest / Budget Increases

- Add:
  - Lightweight cloud backend for:
    - Centralized crash/error logging.
    - Optional cloud sync for solar system state.
  - More robust memory infra (hosted vector DB, etc.). [web:84][web:87]  
- Consider:
  - Serverless or managed Postgres for multi-device sync. [web:151][web:142]

---

## 6. Trade-Offs (Explicit)

- **Professional stack vs. budget:**  
  - Chosen stack is “real startup stack” (React/TS, Tauri/Electron, Node/Python, SQLite) used widely in 2026. [web:144][web:146][web:148][web:151]  
  - By running everything locally for v1, you avoid infra charges and keep under ~$30/month. [web:153][web:82]

- **Desktop-first vs. web-first:**  
  - Desktop gives deep local access and the “brain on my machine” feeling. [web:90][web:93]  
  - Web can be added later as a sync’d dashboard once you have more budget and users.

- **Memory MVP vs. advanced knowledge graph:**  
  - Simple SQLite + structured memory will work and is easier for devs to implement quickly. [web:153][web:84][web:87]  
  - You can layer in graph/Obsidian-style visualizations later as the project matures. [web:74][web:77]

---

## 7. What You Do as a Vibe-Coder

- Use this doc as:
  - A **brief for devs** (if/when you recruit them). [web:131][web:128]  
  - A **spec for AI coding tools** (Claude Code, Cursor, etc.) when asking them to generate code:
    - “Build the Tauri + React desktop shell as described.”
    - “Implement the local Node/Python agent service with SQLite tables: planets, messages, memories, logs.”
    - “Add a permission system like in the technical design.”

- Focus your prompts on:
  - “Follow my architecture document exactly.”
  - “Use Tauri + React + TypeScript for the desktop UI.”
  - “Use SQLite locally and do not require any cloud DB for MVP.”

