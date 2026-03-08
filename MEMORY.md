# System Memory & Context 🧠

## 🏗️ Active Phase & Goal
**Phase 2 in progress.** UI polish + memory recall both complete.
Next: test native Tauri window (VS Build Tools should be done), then Phase 3.

## 🚀 How to Run
**Terminal 1 — Agent service:**
```powershell
cd C:\Users\liamf\solar-ai\agent-service
.venv\Scripts\uvicorn main:app --reload
```
**Terminal 2 — UI:**
```powershell
cd C:\Users\liamf\solar-ai\ui
$env:PATH += ";C:\Program Files\nodejs;C:\Users\liamf\.cargo\bin"
npm run tauri dev        # native window (needs VS Build Tools)
# OR: npm run dev        # browser only at http://localhost:1420
```

## 📂 Architectural Decisions
- Python FastAPI for agent service (aiosqlite, anthropic SDK)
- Tauri + React/TypeScript for desktop UI (Vite on port 1420)
- SQLite local DB — zero infra cost, all data stays on machine
- Message ordering uses `rowid DESC` not `created_at` (fixes same-second insert order)
- FastAPI uses `lifespan` context manager (not deprecated `on_event`)
- Node/Cargo not in Windows cmd.exe PATH — use PowerShell with `$env:PATH +=`
- UI is display-only — all LLM calls and DB writes go through agent service API
- Planet orbits: requestAnimationFrame + anglesRef (not CSS/SVG animateTransform)
- Memory injection: load_memories() formats bullet points injected into system prompt
- Memory extraction: triggered when user message starts with "remember:" or contains "remember that"

## 🐛 Known Issues
- Python 3.14 triggers deprecation warnings in pytest-asyncio/FastAPI — harmless, from third-party libs.

## 📜 Completed
- [x] Python agent service: FastAPI + 5 SQLite tables + seeds
- [x] /chat → Claude API → persisted messages
- [x] /planets CRUD, /logs, /memories endpoints
- [x] Permission check/set/log
- [x] 17 passing tests, ruff clean
- [x] React UI: SolarSystemView (animated orbits), SunChat, PlanetDetail, SettingsPanel
- [x] Dark space theme, SVG glow filters, starfield, message fade-in
- [x] Memory recall — injected into Claude system prompt
- [x] Auto memory extraction on "remember:" / "remember that"
- [ ] Tauri native window (VS Build Tools likely done now — test it)
- [ ] Phase 3: proactive notifications, subagent planets, memory UI in settings
