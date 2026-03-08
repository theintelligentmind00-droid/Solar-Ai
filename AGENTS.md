# AGENTS.md — Master Plan for Solar AI OS

## Project Overview & Stack
**App:** Solar AI OS
**Overview:** A desktop-native personal AI control center with a "solar system" UI metaphor — a central "sun" agent with orbiting "planet" projects. Replaces fragile terminal-based agents (like OpenClaw) with a beautiful, memory-aware, secure personal AI OS that runs locally on the user's machine and proactively does work in the background.
**Stack:** Tauri + React/TypeScript (desktop UI) | Python (local agent service) | SQLite (data + memory) | Claude API (LLM) | Gmail API (email integration)
**Critical Constraints:**
- All data stays local by default (no cloud DB for MVP)
- Least-privilege permissions: every risky action (send email, modify files) requires explicit user approval
- Desktop-first (Tauri); no mobile or web MVP
- Budget: ~$50/month max (LLM API costs only; $0 infra)
- Target: usable MVP by April

## Setup & Commands
Execute these commands for standard development workflows. Do not invent new package manager commands.
- **Setup (Python service):** `cd agent-service && pip install -r requirements.txt`
- **Setup (UI):** `cd ui && npm install`
- **Development (agent service):** `cd agent-service && python main.py`
- **Development (Tauri UI):** `cd ui && npm run tauri dev`
- **Testing (Python):** `cd agent-service && pytest`
- **Testing (UI):** `cd ui && npm test`
- **Linting (Python):** `cd agent-service && ruff check .`
- **Linting (UI):** `cd ui && npm run lint`
- **Build (desktop app):** `cd ui && npm run tauri build`

## Project Structure
```
solar-ai/
├── AGENTS.md                   ← You are here (master plan)
├── MEMORY.md                   ← Session state & architectural decisions
├── REVIEW-CHECKLIST.md         ← Pre-merge verification checklist
├── agent_docs/                 ← Detailed implementation docs
│   ├── tech_stack.md           ← Stack details, setup, code patterns
│   ├── project_brief.md        ← Persistent conventions & rules
│   ├── product_requirements.md ← Full PRD & user stories
│   └── testing.md              ← Test strategy & commands
├── agent-service/              ← Python agent backend (FastAPI/Flask)
│   ├── main.py
│   ├── db/                     ← SQLite models & migrations
│   ├── memory/                 ← Memory read/write logic
│   ├── skills/                 ← Gmail, calendar, file skill adapters
│   └── requirements.txt
├── ui/                         ← Tauri + React/TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── SolarSystemView.tsx
│   │   │   ├── SunChat.tsx
│   │   │   └── PlanetDetail.tsx
│   │   ├── pages/
│   │   └── App.tsx
│   ├── src-tauri/              ← Tauri Rust shell
│   └── package.json
└── docs/                       ← Source PRD, tech design, research docs
```

## Protected Areas
Do NOT modify these areas without explicit human approval:
- **SQLite schema migrations:** Existing migration files — never drop or rename columns without a migration.
- **Permission/security model:** `agent-service/skills/` permission checks — do not remove or bypass approval gates.
- **Tauri config:** `src-tauri/tauri.conf.json` — changing allowed APIs or CSP requires review.
- **`.env` / secrets files:** Never commit API keys or credentials.

## Coding Conventions
See `agent_docs/project_brief.md` for full details.
- **Python:** Type hints required. Use `ruff` for lint/format. No bare `except`.
- **TypeScript/React:** Strict TypeScript — no `any`. PascalCase components, camelCase hooks/utils.
- **Architecture:** Agent service handles all LLM calls and DB writes. UI is display-only — no direct DB access.
- **Testing:** All new Python utilities need pytest unit tests. New React components need at least a render test.

## Agent Behaviors
These rules apply to all AI coding assistants (Claude Code, Cursor, Copilot, Gemini):

1. **Plan Before Execution:** ALWAYS propose a brief step-by-step plan before changing more than one file. Wait for approval.
2. **Refactor Over Rewrite:** Prefer incremental edits to existing functions over complete rewrites.
3. **Context Compaction:** Write key decisions to `MEMORY.md` instead of filling context history during long sessions.
4. **Iterative Verification:** Run tests/linters after each logical change. Fix failures before moving on. See `REVIEW-CHECKLIST.md`.
5. **Security First:** Never add code that bypasses the permission system. Never store credentials in source files.
6. **Minimal Footprint:** Do not add dependencies not already in `requirements.txt` or `package.json` without explicit approval.

## How I Should Think
1. **Understand Intent First:** Before answering, identify what the user actually needs vs. what they literally said.
2. **Ask If Unsure:** If critical information is missing, ask ONE specific question before proceeding.
3. **Plan Before Coding:** Propose a plan, ask for approval, then implement.
4. **Verify After Changes:** Run tests/linters after each feature. Fix failures before continuing.
5. **Explain Trade-offs:** When recommending an approach, mention the main alternative and why you chose what you chose.

## What NOT To Do
- Do NOT delete files without explicit confirmation
- Do NOT modify SQLite schemas without a migration plan
- Do NOT add features not in the current phase
- Do NOT skip tests for "simple" changes
- Do NOT bypass failing tests or pre-commit hooks
- Do NOT use deprecated libraries or patterns
- Do NOT store API keys or secrets in code or version control
- Do NOT make direct DB calls from the UI layer (always go through agent service API)
- Do NOT add `any` types in TypeScript or untyped Python functions

## 🏗️ Active Phase & Roadmap

### Phase 0 → 1 (Current): Blueprint A — Local Foundation
**Goal:** Working local stack — Python agent service + Claude API + Gmail + SQLite memory + basic Tauri window

#### Step 5 Tasks (Current):
- [ ] Scaffold Python agent service (`FastAPI` or `Flask`) with SQLite setup
- [ ] Implement core SQLite tables: `planets`, `messages`, `memories`, `integrations`, `logs`
- [ ] Wire up `POST /chat` endpoint → Claude API → save response to DB
- [ ] Basic Tauri + React scaffold with `<SolarSystemView>` component
- [ ] Connect UI to agent service over localhost HTTP
- [ ] Minimal Gmail integration (read-only, permissioned)
- [ ] Permission prompt UI for risky actions
- [ ] Action log view in settings

#### Phase 2 (Next):
- Animated solar-system canvas (D3 or React-Three-Fiber)
- Persistent memory recall (load relevant memories into LLM context)
- Desktop notifications / internal inbox for proactive AI updates
- Visual planet status (glow, orbit animation)

#### Phase 3 (Future):
- Subagent concept (visually distinct planet types)
- Advanced memory (semantic search / lightweight vector store)
- Optional cloud sync layer

## Reference Docs
- Full PRD: `agent_docs/product_requirements.md`
- Tech stack & patterns: `agent_docs/tech_stack.md`
- Testing strategy: `agent_docs/testing.md`
- Project conventions: `agent_docs/project_brief.md`
- Source research: `part5-deep-research-report.md`
