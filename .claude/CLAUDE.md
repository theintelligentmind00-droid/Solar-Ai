# CLAUDE.md — Claude Code Configuration for Solar AI OS

## Project Context
**App:** Solar AI OS
**Stack:** Python (FastAPI) + Tauri + React/TypeScript + SQLite + Claude API + Gmail API
**Stage:** MVP Development — Phase 0 → 1 (Blueprint A, local only)
**Current Step:** Step 5 — Scaffold agent service + SQLite + Claude API + basic Tauri UI

## Source Documents (Read Before Each Session)
- `AGENTS.md` — Master plan, active phase, roadmap, agent behavior rules
- `MEMORY.md` — Architectural decisions & session state
- `agent_docs/tech_stack.md` — Full stack details, code patterns, setup commands
- `agent_docs/product_requirements.md` — PRD, user stories, success criteria
- `agent_docs/testing.md` — Test strategy and commands
- `agent_docs/project_brief.md` — Conventions, quality gates, update cadence
- `REVIEW-CHECKLIST.md` — Pre-merge verification checklist

## Directives
1. **Master Plan First:** Always read `AGENTS.md` before starting any task. It contains the current phase, active tasks, and rules.
2. **Plan Before Coding:** Propose a brief step-by-step plan and wait for approval before changing more than one file.
3. **Incremental Build:** Implement one feature at a time. Run tests/linters after each change. Fix failures before moving on.
4. **Architecture:** All LLM calls and DB writes go through the Python agent service. The React UI is display-only — no direct DB access.
5. **Security:** Never bypass permission checks. Never commit `.env` or API keys.
6. **Memory:** After any milestone or architectural decision, update `MEMORY.md`.
7. **Pre-Commit:** Run linters and tests before any commit. Fix failures — never skip or bypass.
8. **Concise:** Be brief. Ask one specific clarifying question if critical info is missing.

## Commands
```bash
# Python agent service
cd agent-service && python main.py        # Start service
cd agent-service && pytest                # Run tests
cd agent-service && ruff check .          # Lint

# Tauri UI
cd ui && npm run tauri dev                # Start UI (hot-reload)
cd ui && npm test                         # Component tests
cd ui && npm run lint                     # ESLint
cd ui && npm run tauri build              # Build distributable
```

## What NOT To Do
- Do NOT delete files without explicit confirmation
- Do NOT modify SQLite schemas without a migration plan
- Do NOT add features not in the current phase (see AGENTS.md roadmap)
- Do NOT skip tests for "simple" changes
- Do NOT bypass failing tests or pre-commit hooks
- Do NOT use `any` types in TypeScript or untyped Python functions
- Do NOT store API keys or credentials in source files
- Do NOT make direct DB calls from the React/TypeScript UI layer
