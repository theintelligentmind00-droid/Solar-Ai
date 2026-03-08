# Testing Strategy — Solar AI OS

## Frameworks
- **Python Unit Tests:** pytest + pytest-asyncio
- **UI Component Tests:** Vitest + React Testing Library
- **E2E Tests (future):** Playwright (not required for MVP Phase 1)
- **Manual Checks:** Required before any task is marked complete

## Rules & Requirements
- **Coverage:** Aim for 80%+ on critical paths (chat endpoint, memory read/write, permission checks).
- **Before Marking Complete:** Always run both `pytest` and `npm test` and confirm they pass.
- **Failures:** NEVER skip tests or mock out assertions to make a pipeline pass without human approval. If an agent breaks a test, the agent must fix it.
- **New Utilities:** Every new Python helper/service function must have at least one unit test.
- **New React Components:** At minimum, a render test (does it mount without crashing?).

## Execution Commands

### Python Agent Service
```bash
cd agent-service

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a single test file
pytest tests/test_chat.py

# Run a single test
pytest tests/test_chat.py::test_chat_returns_reply

# Run with coverage report
pytest --cov=. --cov-report=term-missing
```

### Tauri UI
```bash
cd ui

# Run all component tests
npm test

# Run in watch mode during development
npm run test:watch

# Run a specific test file
npx vitest run src/components/SunChat.test.tsx
```

## What to Test

### Python Agent Service — Critical Paths
| Module | What to Test |
|--------|-------------|
| `routes/chat.py` | POST /chat returns a reply; invalid planet_id returns 404 |
| `memory/memory.py` | `load_context` returns last N messages in correct order |
| `memory/memory.py` | `save_message` persists to SQLite and is retrievable |
| `skills/permissions.py` | `check_permission` returns False when skill is disabled |
| `skills/permissions.py` | `check_permission` returns True after skill is enabled |
| `db/schema.py` | `init_db` creates all required tables without error |
| `routes/planets.py` | GET /planets returns list; POST /planets creates new record |

### React UI — Critical Paths
| Component | What to Test |
|-----------|-------------|
| `SunChat` | Renders input and send button; adds user message to list on send |
| `SolarSystemView` | Renders without crashing; shows planet list when data is provided |
| `PlanetDetail` | Renders planet name and opens SunChat with correct planetId |
| `PermissionPrompt` | Shows action description; fires onApprove/onDeny callbacks |

## Example Test Pattern (Python)
```python
# tests/test_permissions.py
import pytest
import aiosqlite
from skills.permissions import check_permission
from db.schema import init_db, DB_PATH

@pytest.fixture(autouse=True)
async def setup_db(tmp_path, monkeypatch):
    """Use a temp DB for each test."""
    monkeypatch.setattr("db.schema.DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr("skills.permissions.DB_PATH", str(tmp_path / "test.db"))
    await init_db()

@pytest.mark.asyncio
async def test_permission_denied_by_default():
    result = await check_permission("gmail")
    assert result is False

@pytest.mark.asyncio
async def test_permission_granted_after_enable():
    async with aiosqlite.connect(str(tmp_path / "test.db")) as db:
        await db.execute(
            "INSERT INTO integrations (id, name, enabled) VALUES (?, ?, ?)",
            ("1", "gmail", 1)
        )
        await db.commit()
    result = await check_permission("gmail")
    assert result is True
```

## Example Test Pattern (React)
```typescript
// src/components/SunChat.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { SunChat } from "./SunChat";
import { vi } from "vitest";

// Mock the API module
vi.mock("../api/agent", () => ({
  sendChat: vi.fn().mockResolvedValue({ reply: "Hello from Solar!" }),
}));

test("renders input and send button", () => {
  render(<SunChat planetId="planet-1" />);
  expect(screen.getByPlaceholderText("Message Solar...")).toBeInTheDocument();
  expect(screen.getByText("Send")).toBeInTheDocument();
});

test("displays user message after sending", async () => {
  render(<SunChat planetId="planet-1" />);
  const input = screen.getByPlaceholderText("Message Solar...");
  fireEvent.change(input, { target: { value: "Hello" } });
  fireEvent.click(screen.getByText("Send"));
  expect(await screen.findByText("Hello")).toBeInTheDocument();
});
```

## Pre-Commit Checklist
Before every commit, confirm:
1. `cd agent-service && ruff check .` — no lint errors
2. `cd agent-service && pytest` — all tests pass
3. `cd ui && npm run lint` — no ESLint errors
4. `cd ui && npm test` — all component tests pass
5. No `.env` or secret files staged

## Manual Verification Checklist (Per Feature)
- [ ] Start agent service and Tauri UI — no crashes on startup
- [ ] Send a chat message — response appears in UI within a few seconds
- [ ] Create a planet — appears in solar system view
- [ ] Attempt a "risky action" (e.g., read Gmail) — permission prompt appears
- [ ] Approve permission — action executes and appears in action log
- [ ] Restart app — chat history and planets persist
