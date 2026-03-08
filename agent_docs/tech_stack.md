# Tech Stack & Tools

## Stack Summary
- **Desktop Shell:** Tauri 2.x + React 18 + TypeScript (strict mode)
- **Agent Service (Backend):** Python 3.11+ with FastAPI
- **Database:** SQLite (via `sqlite3` stdlib or `aiosqlite` for async)
- **LLM:** Claude API (`anthropic` Python SDK) — start with `claude-sonnet-4-6`
- **Styling:** Tailwind CSS + shadcn/ui components
- **Email Integration:** Gmail API (Google OAuth2 + `google-auth` + `googleapiclient`)
- **Testing (Python):** pytest + pytest-asyncio
- **Testing (UI):** Vitest + React Testing Library
- **Linting (Python):** ruff
- **Linting (UI):** ESLint + Prettier

## Python Agent Service Setup

```bash
# In agent-service/
pip install fastapi uvicorn anthropic aiosqlite google-auth google-auth-oauthlib google-api-python-client python-dotenv ruff pytest pytest-asyncio
```

### Key File Layout
```
agent-service/
├── main.py              # FastAPI app entry point
├── db/
│   ├── schema.py        # SQLite table definitions & migrations
│   └── models.py        # Python dataclasses for DB rows
├── memory/
│   └── memory.py        # Read/write memories, load context
├── skills/
│   ├── permissions.py   # Check & request permissions
│   └── gmail.py         # Gmail read/send adapter
├── routes/
│   ├── chat.py          # POST /chat endpoint
│   ├── planets.py       # CRUD /planets endpoint
│   └── logs.py          # GET /logs endpoint
├── .env                 # ANTHROPIC_API_KEY, GOOGLE_CLIENT_* (never commit)
└── requirements.txt
```

### FastAPI Entry Point Pattern
```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import chat, planets, logs
from db.schema import init_db

app = FastAPI(title="Solar AI OS Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost", "http://localhost:1420"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(planets.router)
app.include_router(logs.router)

@app.on_event("startup")
async def startup():
    await init_db()  # Create tables if they don't exist
```

### SQLite Schema
```python
# db/schema.py
import aiosqlite

DB_PATH = "solar_ai.db"

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS planets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    orbit_radius REAL DEFAULT 200,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    planet_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (planet_id) REFERENCES planets(id)
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    planet_id TEXT,  -- NULL = global/sun memory
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,   -- 'gmail', 'calendar', 'files'
    enabled INTEGER DEFAULT 0,
    scopes TEXT,          -- JSON list of granted scopes
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    skill TEXT NOT NULL,
    summary TEXT NOT NULL,
    success INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(CREATE_TABLES)
        await db.commit()
```

### Chat Endpoint Pattern
```python
# routes/chat.py
from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
from db.schema import DB_PATH
from memory.memory import load_context, save_message
import aiosqlite, uuid

router = APIRouter()
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

class ChatRequest(BaseModel):
    planet_id: str
    message: str

@router.post("/chat")
async def chat(req: ChatRequest):
    # 1. Load recent messages + memories for context
    context = await load_context(req.planet_id, limit=20)

    # 2. Call Claude API
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="You are Solar, a helpful personal AI assistant. Be concise and proactive.",
        messages=context + [{"role": "user", "content": req.message}]
    )
    reply = response.content[0].text

    # 3. Save both messages to DB
    await save_message(req.planet_id, "user", req.message)
    await save_message(req.planet_id, "assistant", reply)

    return {"reply": reply}
```

### Permission Check Pattern
```python
# skills/permissions.py
from db.schema import DB_PATH
import aiosqlite

async def check_permission(skill: str) -> bool:
    """Returns True if skill is enabled, False otherwise."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT enabled FROM integrations WHERE name = ?", (skill,)
        ) as cursor:
            row = await cursor.fetchone()
            return bool(row and row[0])

async def permission_required(skill: str, action_summary: str) -> dict:
    """Return a permission request object for the UI if not granted."""
    if not await check_permission(skill):
        return {
            "permission_required": True,
            "skill": skill,
            "action": action_summary,
            "message": f"Allow AI to {action_summary}? Grant in Settings > Permissions."
        }
    return {"permission_required": False}
```

## Tauri + React UI Setup

```bash
# Prerequisites: Rust, Node 18+
npm create tauri-app@latest ui -- --template react-ts
cd ui && npm install tailwindcss @tailwindcss/vite lucide-react
```

### Calling the Agent Service from React
```typescript
// src/api/agent.ts
const BASE_URL = "http://localhost:8000";

export async function sendChat(planetId: string, message: string) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planet_id: planetId, message }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json() as Promise<{ reply: string }>;
}

export async function getPlanets() {
  const res = await fetch(`${BASE_URL}/planets`);
  if (!res.ok) throw new Error(`Failed to load planets: ${res.status}`);
  return res.json();
}
```

### React Component Pattern (TypeScript, strict)
```typescript
// src/components/SunChat.tsx
import { useState } from "react";
import { sendChat } from "../api/agent";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SunChatProps {
  planetId: string;
}

export function SunChat({ planetId }: SunChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await sendChat(planetId, input);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className="inline-block px-3 py-2 rounded-lg bg-gray-700 text-white max-w-xs">
              {m.content}
            </span>
          </div>
        ))}
        {loading && <div className="text-gray-400 text-sm">Solar is thinking...</div>}
      </div>
      <div className="flex gap-2 p-4 border-t border-gray-700">
        <input
          className="flex-1 bg-gray-800 text-white rounded px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message Solar..."
        />
        <button onClick={handleSend} className="bg-yellow-500 text-black px-4 py-2 rounded">
          Send
        </button>
      </div>
    </div>
  );
}
```

## Error Handling Pattern (Python)
```python
# Use specific exceptions, not bare except
from fastapi import HTTPException

async def get_planet(planet_id: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, name, status FROM planets WHERE id = ?", (planet_id,)
        ) as cursor:
            row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Planet {planet_id} not found")
    return {"id": row[0], "name": row[1], "status": row[2]}
```

## Naming Conventions
- **Python:** `snake_case` for files, functions, variables. `PascalCase` for classes. Type hints required.
- **TypeScript/React:** `PascalCase` for components and files (`SolarSystemView.tsx`). `camelCase` for hooks and utils. No `any` type.
- **SQLite:** `snake_case` table and column names.
- **API routes:** REST conventions — `GET /planets`, `POST /chat`, `PUT /planets/{id}`, `DELETE /planets/{id}`.
- **Environment vars:** `UPPER_SNAKE_CASE` in `.env`. Always load via `python-dotenv` or `import os`.
