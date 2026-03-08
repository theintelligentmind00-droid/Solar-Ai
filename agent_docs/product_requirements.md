# Product Requirements — Solar AI OS

*Source: PRD-Solar-AI-OS-MVP.md (source of truth)*

## Product Overview
- **App Name:** Solar AI OS (working title)
- **Tagline:** "A solar-system AI that orbits around you and actually does the work."
- **Launch Goal:** Replace the owner's OpenClaw setup and attract attention from AI/tech geeks and potential dev collaborators.
- **Target Launch:** Usable MVP by April (this year).

## Primary User: "Jeremy the Vibe-coder"
Jeremy is a tech-obsessed AI/agent geek — CS student, indie hacker, or content creator — who loves trying the newest models and tools. Comfortable with terminals and GitHub, but tired of stuff breaking.

**Current pain points:**
- OpenClaw-style tools forget context, break mid-run, hit rate limits, and need babysitting
- Terminal setup is annoying and fragile
- No visual "control center" — everything lives in a bare terminal
- Agents silently fail instead of reporting progress

**What they need:**
- A beautiful, desktop-native control center
- An AI that genuinely remembers tasks, projects, and preferences across sessions
- Proactive behavior: the AI messages them with progress, not the other way around
- Clear security: giving it access to email/files doesn't feel scary

## Primary User Story
> "Meet Jeremy, a vibecoder who's always playing with the latest AI tools. They use OpenClaw and similar agents today but hate that they constantly forget things, bug out, and require babysitting in a terminal. Jeremy wants a personal AI 'solar system' that orbits around them, remembers what's going on, and quietly gets work done in the background. Solar AI OS gives them a beautiful dashboard where their 'sun' AI and orbiting project planets are always visible. After a week, Jeremy has a living universe of bots and projects that finally feels reliable and alive."

## Core Usage Loop
1. **Trigger:** User has something to offload — a project, chore, content idea, planning task.
2. **Action:** They create or open a planet/project in the solar system, give the AI instructions, and see work being tracked.
3. **Reward:** The AI follows up proactively with results, summaries, or next steps; the planet visually evolves.
4. **Investment:** Over time their solar system fills with planets, memories, and skills — making it more useful and personalized.

---

## MVP Features (Must-Have — P0)

### 1. Solar-System Dashboard
**What:** A desktop dashboard showing the user's "sun" (main agent) with orbiting planets representing projects/bots. Futuristic, cozy space UI.

**User Story:** As an AI/tech geek, I want a visual solar-system control center so I can see my AI, projects, and activity at a glance instead of dealing with terminals.

**Success Criteria:**
- [ ] User can see the sun and create/edit/delete planets/projects
- [ ] Clicking a planet opens that project view (chat + basic info)
- [ ] UI is stable (no major layout bugs) and reasonably responsive on a mid-range laptop

**Priority:** P0 (Critical)

---

### 2. Main Sun Chat + Basic Memory
**What:** Chat interface with the main "sun" agent that remembers key instructions across sessions (at least for a handful of active projects and user preferences).

**User Story:** As a user, I want my AI to remember what I've told it about my projects and preferences so I don't start from scratch every session.

**Success Criteria:**
- [ ] Chat history persists across app restarts for active projects
- [ ] Agent can recall a small set of facts (ongoing tasks, recent instructions) in new responses
- [ ] User can see or manage what's "remembered" (basic memory list for v1)

**Priority:** P0 (Critical)

---

### 3. Strong Secure Foundation
**What:** A basic but solid security model: skills run with limited permissions, clear boundaries for what the app can do, transparent logs of actions.

**User Story:** As a user, I want to feel safe giving the AI access to my machine and accounts, knowing it won't do scary stuff behind my back.

**Success Criteria:**
- [ ] Permission prompts for high-risk actions (e.g., sending email, modifying files)
- [ ] Simple log view of what the agent did (e.g., "read X emails," "created Y calendar event")
- [ ] Clear on/off toggles for major integrations (email, calendar)

**Priority:** P0 (Critical)

*Note: Email/calendar integration can be very minimal for MVP (even read-only) as long as the permission foundation is ready.*

---

## Nice to Have (P1 — If Time Allows)
- **Basic email/calendar integration:** Read recent emails and add events/reminders in a controlled, permissioned way.
- **Simple proactive notifications:** Desktop notifications or internal "inbox" where the AI can post progress updates.
- **Very basic subagent concept:** Visual distinction for different planet types — not full advanced workflows.

---

## NOT in MVP (Version 2+)
- Advanced multi-agent workflows (complex pipelines, many subagents coordinating)
- Full deep computer control (script execution, broad filesystem automation, full browser automation)
- Full mobile app (native iOS/Android)
- Rich personality editor and many personas (v1 = one main persona with simple tweaks)

**Why we're waiting:** Keep MVP focused on a working desktop control center, basic memory, and security. Something that feels real and impressive by April — not a half-finished everything-tool.

---

## Success Metrics (First 30 Days)
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Owner replaces OpenClaw with Solar AI OS | Use it as main agent for 2+ weeks | Self-report + actual usage on own machine |
| Early engaged users | 3–5 people using it weekly and saying it feels "more reliable/alive than OpenClaw" | Manual feedback, simple usage logs |

---

## Design Vibe
**Words:** Futuristic, clean, homelike/cozy.

**Visual Principles:**
- Futuristic but not cold: space cockpit vibes with warm accents and clear typography
- Clean, minimal clutter: focus on the solar system and chat; no noisy controls everywhere
- Feels like your room in space: personalized elements (your sun, your planets) so it feels like a home base

**Key Screens:**
1. **Home / Solar-System View:** Central sun, orbiting planets, quick status indicators, "New planet/project" CTA
2. **Planet / Project Detail:** Chat with sun about that project, basic info panel (tasks, memories), status of work
3. **Settings & Permissions:** Clear toggles for email/calendar, memory scope, and simple action log

---

## Quality Standards (What This App Will NOT Accept)
- A broken or ugly dashboard — visual quality is a key selling point
- "Magic AI" claims without visible results — the AI must show logs, updates, or tangible outcomes
- Scary permissions — anything high-risk must be clearly explained and confirmed before execution

---

## Budget & Constraints
- **Hosting:** $0 (purely local desktop for MVP)
- **LLM API:** ~$50/month budget (Claude API usage for own testing + a small group of early users)
- **Timeline:** Usable MVP by April
- **Team:** Product/vision/UX by owner; developers and designers to be attracted via this MVP/demo

---

## Definition of Done for MVP
The MVP is ready to "launch" (to yourself + small circle) when:
- [ ] Solar-system dashboard is functional and reasonably polished
- [ ] Main sun chat works and remembers at least basic project/user info
- [ ] Core security/permission flows are in place (no silent risky actions)
- [ ] One complete journey works: create planet → give instructions → AI does something and reports back
- [ ] Owner actually prefers using this over OpenClaw for a week
