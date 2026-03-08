# System Memory & Context 🧠

## 🏗️ Active Phase & Goal
**Phase 1 COMPLETE.** MVP working in browser at http://localhost:1420.
Tauri native window pending VS Build Tools install on Windows.

**Next Steps:**
1. Finish VS Build Tools install → test `npm run tauri dev` → native window
2. Test full chat loop end-to-end (type message → Claude API → response in UI)
3. Phase 2: animated planet orbits, memory recall in LLM context, proactive notifications

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
npm run tauri dev
# Or just open http://localhost:1420 in browser while Build Tools installs
```

## 📂 Architectural Decisions
- Python FastAPI for agent service (aiosqlite, anthropic SDK)
- Tauri + React/TypeScript for desktop UI (Vite on port 1420)
- SQLite local DB — zero infra cost, all data stays on machine
- Message ordering uses `rowid DESC` not `created_at` (fixes same-second insert order)
- FastAPI uses `lifespan` context manager (not deprecated `on_event`)
- Node/Cargo not in Windows cmd.exe PATH — use PowerShell with `$env:PATH +=`
- UI is display-only — all LLM calls and DB writes go through agent service API

## 🐛 Known Issues
- VS Build Tools not installed → Tauri won't compile. Use browser for now.
- Python 3.14 triggers deprecation warnings in pytest-asyncio/FastAPI — harmless, from third-party libs.

## 📜 Completed
- [x] Python agent service: FastAPI + 5 SQLite tables + seeds
- [x] /chat → Claude API → persisted messages
- [x] /planets CRUD, /logs read, permission check/set/log
- [x] 17 passing tests, ruff clean
- [x] React UI: SolarSystemView (SVG), SunChat, PlanetDetail, SettingsPanel
- [x] Dark space theme, sun glow animation, orbit rings, starfield
- [ ] Tauri native window (blocked: VS Build Tools)
- [ ] Phase 2: animated orbits, memory recall, notifications
