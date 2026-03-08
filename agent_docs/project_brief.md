# Project Brief (Persistent)

## Product Vision
**Solar AI OS** — A desktop-native personal AI "solar system" that orbits around the user, remembers what's going on, and quietly gets real work done in the background. Replaces fragile terminal-based agents (like OpenClaw) with a beautiful, reliable, memory-aware control center.

**Tagline:** "A solar-system AI that orbits around you and actually does the work."

## Target Audience
**"Jeremy the Vibe-coder"** — A tech-obsessed AI/agent enthusiast (CS student, indie hacker, content creator) who:
- Is comfortable with terminals and GitHub, but tired of stuff breaking
- Uses OpenClaw-style agents today but hates their fragility and lack of memory
- Wants a beautiful desktop control center instead of a bare terminal
- Will share screenshots/clips on TikTok/Reddit if it feels alive and reliable

## Core Architecture Rule
**The UI is display-only. All LLM calls, DB writes, and skill invocations happen in the Python agent service.**

Never make direct database access or LLM calls from the React/TypeScript frontend. All state flows through the agent service API (`http://localhost:8000`).

## Coding Conventions

### Python (agent-service/)
- Type hints on all function parameters and return values — no exceptions
- Use `ruff` for linting and formatting (configured in `pyproject.toml`)
- No bare `except:` clauses — always catch specific exceptions
- Async functions with `aiosqlite` for all DB operations
- Load secrets via `python-dotenv` — never hardcode API keys
- File names: `snake_case.py`
- Class names: `PascalCase`

### TypeScript/React (ui/)
- Strict TypeScript — `"strict": true` in `tsconfig.json`. No `any` types.
- PascalCase for React component files and function names (`SolarSystemView.tsx`)
- camelCase for hooks (`useChat.ts`), utilities (`formatDate.ts`), and variables
- Co-locate test files: `SolarSystemView.tsx` next to `SolarSystemView.test.tsx`
- Use `interface` for object shapes, `type` for unions/aliases
- Tailwind CSS for styling — no inline styles unless absolutely necessary

### Git & Commits
- Commit after each working milestone (not after every file save)
- Commit message format: `feat: add <thing>` / `fix: correct <thing>` / `chore: update deps`
- Never commit `.env` or any file containing API keys

## Key Commands
```bash
# Python agent service
cd agent-service
python main.py              # Start service (port 8000)
pytest                      # Run all tests
ruff check .                # Lint
ruff format .               # Format

# Tauri UI
cd ui
npm run tauri dev           # Start dev with hot-reload
npm run tauri build         # Build distributable
npm test                    # Run component tests
npm run lint                # ESLint check
```

## Quality Gates
Before any task is marked "complete":
1. No lint errors (`ruff check .` + `npm run lint` pass)
2. All existing tests still pass (`pytest` + `npm test`)
3. New code has at least basic test coverage
4. Action logged to SQLite `logs` table if it's a skill call
5. `MEMORY.md` updated if an architectural decision was made

## Ship Principles
- **Ship the simplest solution that solves the user story.** No over-engineering.
- If a pre-built library handles it cleanly, use it — don't rewrite from scratch.
- MVP does NOT need advanced features. See `agent_docs/product_requirements.md` for the "NOT in MVP" list.
- Visual quality of the solar-system dashboard is a key selling point — don't ship an ugly UI.
- Security gates (permission prompts, action logs) are non-negotiable for MVP.

## Update Cadence
Update this file when:
- A new coding convention is agreed upon
- The project structure changes significantly
- New team members or AI tools are added to the workflow
