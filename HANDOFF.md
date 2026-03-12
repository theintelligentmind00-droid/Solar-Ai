# Solar AI OS — Full Project Handoff

## Project Context
**App:** Solar AI OS — "The AI that orbits around you."
**Stack:** Python FastAPI + aiosqlite + APScheduler + Anthropic SDK (backend) / React + TypeScript + Vite + Tauri v2 (frontend)
**DB:** SQLite at ~/.solar-ai/solar_ai.db
**Stage:** MVP — Advanced UI polish phase

## Current State
The app works end-to-end: onboarding, chat with Claude, Gmail/Calendar integration, task management, daily briefings, web search, file reading, shell commands. The solar system metaphor (planets = projects) is the core UX.

Recently added but needs visual polish:
- Three.js 3D planet zoom-in view (PlanetScene.tsx + generatePlanetTextures.ts)
- Procedural planet textures with simplex noise
- Camera fly-in animation
- Ambient soundscapes (SoundManager.ts)
- Comet notification queue
- Living civilizations on planets
- Day/night CSS cycle

## User Feedback (What Needs Fixing)
1. **"All planets look the same when zoomed in"** — 7 types exist but render too similarly
2. **"No animation going in/out of planet"** — zoom transition feels flat
3. **"Planet doesn't look good — needs to be smoother, more colorful, more detailed"**

## The 7 Planet Types (should look DRAMATICALLY different)
- **terra** — Earth-like: blue oceans, green/brown continents
- **forge** — Volcanic hellscape: dark basalt, glowing lava rivers
- **oasis** — Water world: vast turquoise oceans, small tropical islands
- **nexus** — Cyberpunk city planet: metallic, neon grid lines
- **citadel** — Desert fortress: sandy canyons, ancient structures
- **gaia** — Garden world: lush greens, flowering meadows
- **void** — Dark/mysterious: deep purples, ethereal energy

## Architecture Rules
- ALL LLM calls and DB writes go through Python backend (port 8000)
- React UI is display-only — no direct DB access
- API key stored in OS keychain (keyring), fallback ~/.solar-ai/.env
- Never commit .env or API keys
- TypeScript: no `any` types
- Python: all functions typed

## Dev Commands
```powershell
# Terminal 1 (backend)
cd C:\Users\liamf\solar-ai\agent-service; .venv\Scripts\activate; uvicorn main:app --reload

# Terminal 2 (frontend)  
cd C:\Users\liamf\solar-ai\ui; npm run dev

# Type check
cd ui && npx tsc --noEmit

# Python lint
cd agent-service && ruff check .

# Tests
cd agent-service && pytest
cd ui && npm test
```

## Key Dependencies (already installed, don't add new ones)
- three, @react-three/fiber, @react-three/drei
- simplex-noise ^4.0.3 (exports createNoise2D, createNoise3D, createNoise4D)
- tauri-plugin-notification
- @anthropic-ai/sdk
- aiosqlite, apscheduler, keyring

