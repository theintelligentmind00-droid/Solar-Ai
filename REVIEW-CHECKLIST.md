# Artifact Review Checklist 🔍

> **AGENTS:** Do not mark a feature or task as "Complete" until you verify these checks manually or via automated test runs. Provide terminal logs or test output as proof.
> **HUMANS:** Use this checklist before merging Agent-generated code.

## Code Quality & Safety
- [ ] No `any` types in TypeScript (or strictly justified with `unknown` + type guards).
- [ ] All Python functions have type hints.
- [ ] Protected files/directories (SQLite migrations, permission checks, Tauri config) were NOT modified without approval.
- [ ] No existing, unrelated tests were deleted or skipped.
- [ ] No API keys or secrets committed to source control.
- [ ] New components/functions are modular and don't violate the agent-service/UI boundary.

## Execution & Testing
- [ ] Python agent service starts without errors: `cd agent-service && python main.py`
- [ ] Tauri UI builds without fatal errors: `cd ui && npm run tauri dev`
- [ ] Python linter passes: `cd agent-service && ruff check .`
- [ ] TypeScript/ESLint passes: `cd ui && npm run lint`
- [ ] Python tests pass: `cd agent-service && pytest`
- [ ] React component tests pass: `cd ui && npm test`

## Security & Permissions
- [ ] Any new "risky action" (write email, modify files) goes through the permission check in agent service.
- [ ] UI shows a clear approval prompt before any risky action executes.
- [ ] New action is logged to the `logs` SQLite table.

## Artifact Handoff
- [ ] `MEMORY.md` updated with any new architectural decisions made during this task.
- [ ] `AGENTS.md` Phase/Task list updated if a step was completed.
- [ ] Any obsolete spec files or TODO comments have been cleaned up or archived.
