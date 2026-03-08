
🌌

SOLAR SYSTEM
AI CONTROL CENTER

Deep Research Report for a Non-Technical Founder

March 2026  ·  Covering Sections 1–7 + All Six Deliverables



Executive Summary
This report gives you a full picture of the landscape, tools, and decisions you need to ship a "Solar System AI Control Center" — a beautiful, local-first desktop app that manages your email, calendar, tasks, and memory through a team of intelligent agents — by April 2026 for yourself and a small circle of technical early testers.

The market is moving fast. OpenClaw (formerly Clawdbot/Moltbot) exploded to 160,000 GitHub stars in early 2026, validating enormous demand for personal AI agents that actually do things. But OpenClaw's security model, memory system, and UX were all afterthoughts. That's your opening: a product with OpenClaw's magic but with the polish, safety, and visual identity that geeks are hungry for.

Key conclusions up front:
•	Build on Tauri 2.0 (desktop shell) + Python FastAPI (agent service) + React/D3.js (UI). This is the fastest, safest, and most maintainable stack for a small team.
•	Use Mem0 or Zep/Graphiti for v1 memory. Both have SDKs. Upgrade to a full knowledge graph in v2.
•	Wire into Claude Sonnet via Anthropic API. Budget ~$30–80/month for typical personal use. Add OpenAI as a fallback.
•	Default-deny security: every sensitive action (send email, delete file) requires one-tap approval on desktop or phone. Log everything.
•	The solar-system UI metaphor is unique and defensible. Lean into it hard — planets = projects, satellites = active skills, star map = memory graph.
•	Realistic v1 scope: main agent with memory, email + calendar reading/drafting, 3–5 built-in skills, solar-system home screen, activity log. That's it.

1.  Current Landscape & Benchmarks
1.1  Existing Tools & Competitors
The personal AI agent space went from niche hobby to mainstream phenomenon in early 2026, largely thanks to OpenClaw's viral growth. Here is a grounded map of the landscape as of March 2026.

Tool	Core Concept	Install Friction	OS Support	Memory Model	Multi-Agent	Security Model	UX Strengths / Weaknesses
OpenClaw (160K ★)	Personal AI agent, messaging-first, 700+ community skills. CLI + web UI.	Medium — Node.js, npm install, config YAML. ~15 min for a developer.	macOS, Linux, Windows, Raspberry Pi	Flat markdown files in ~/.openclaw/memories/. Simple but hard to query.	Single agent. Sub-agents possible via skills but no native orchestration.	High risk. Any skill can do anything Node.js can. 512 CVEs found in Jan 2026 audit.	STRENGTH: Huge skill ecosystem, feels magical, chat via iMessage/Telegram/WhatsApp. WEAKNESS: No GUI dashboard, no visual memory, not for non-devs.
ZeroClaw (16K ★)	Rust-based OpenClaw alternative, WASM sandboxed plugins, 5MB RAM idle.	Low-Medium — single binary, YAML config. 10 min.	macOS, Linux, ARM, Raspberry Pi	SQLite-backed. Lightweight. No graph.	Single agent. Heartbeat system for proactive behavior.	STRONG. WASM sandbox: plugins physically cannot escape their permissions. 1,017 tests.	STRENGTH: Secure by design, tiny footprint. WEAKNESS: Smaller skill library than OpenClaw, less polished UX.
TinyClaw (2.3K ★)	Multi-agent variant: each agent gets its own workspace, history, and @agent_id routing.	Medium — Python pip install, YAML per agent.	macOS, Linux, Windows	Per-agent conversation history. Shared via file I/O.	YES — multiple isolated agents with fan-out. Tmux-based 24/7 operation.	Moderate. Relies on config-based controls. No WASM sandbox.	STRENGTH: Only open-source tool with native multi-agent orchestration. WEAKNESS: Very technical setup, no GUI at all.
OpenFang	True 'Agent OS' — agents run as kernel-level background processes, not chatbots.	Medium-High — Go binary + config. More abstract concept to grasp.	Linux, macOS	Agents build their own knowledge bases autonomously.	YES — native background agent processes, self-scheduling.	Good. Isolated containers per agent. Deny-by-default networking.	STRENGTH: True autonomous execution model. WEAKNESS: No GUI, extremely developer-facing, hard to onboard.
NanoBot (22K ★)	Minimal Python clone of OpenClaw. 4,000 lines. pip install.	Very Low — pip install, API key, go.	Any (Python)	Flat key-value. Multi-hop reasoning on roadmap.	No. Single agent only.	Weak. Config-based controls only.	STRENGTH: Easiest to start with. WEAKNESS: Minimal features, memory is immature.
Letta (MemGPT)	Memory-first agent framework. Stateful agent runtime. Explicit memory blocks.	Medium — Python SDK or hosted service.	Any (Python / hosted)	STRONG. Explicit core memory blocks, archival memory, OS-inspired hierarchy.	Multi-agent via Conversations API (shared memory across parallel agents).	Moderate. Self-hosted or cloud. No dedicated sandboxing.	STRENGTH: Best-in-class memory model, true stateful agents. WEAKNESS: No UI, developer tool only.
Claude Code	CLI coding agent. MCP tool protocol. Strong reasoning, computer use.	Low — npm install -g @anthropic/claude-code	macOS, Linux, Windows (WSL)	Session-based. CLAUDE.md for project context.	Orchestrator / sub-agent model via MCP.	Moderate. Runs with user permissions. Sandboxing optional (containers).	STRENGTH: Superb coding ability, MCP ecosystem. WEAKNESS: Dev-only tool, no persistent memory, no calendar/email built-in.
Lindy (Commercial)	No-code AI agent platform. Pre-built workflows for email, calendar, CRM.	Very Low — web sign-up, no install.	Web (any)	Cloud memory. Good but you don't own it.	YES — multi-agent workflows via drag-and-drop.	Good. Cloud-managed, SOC 2. But all your data lives on their servers.	STRENGTH: Beautiful UI, easy for non-devs, polished. WEAKNESS: Expensive at scale, no local option, no customization.

💡 Sources: OpenClaw Wikipedia page (accessed Mar 2026), MacStories OpenClaw review (Feb 2026), ScriptByAI ZeroClaw comparison (Mar 2026), Ry Walker landscape overview (Feb 2026).

Where every existing tool falls short for your vision:
•	No one has a beautiful, visual dashboard. Everything is a chatbot or a CLI.
•	Memory is either flat files (OpenClaw) or developer-facing libraries (Letta, Mem0). Nothing is designed to be visualized.
•	Security is an afterthought in the most popular tools. ZeroClaw and OpenFang are exceptions but have tiny userbases.
•	No tool combines: beautiful UI + email/calendar + persistent memory + multi-agent + approvals flow + local-first.
•	Setup friction is still too high for non-developers. The opportunity for 'download and go' is wide open.

1.2  How Modern AI Agent Systems Are Architected
The best-practice pattern for a personal AI agent in 2025–2026 has five layers. Think of it like a nervous system:

LAYER 1 — Core Daemon / Orchestrator
A long-running background process (the 'always on' brain). It holds the main agent's identity, listens for triggers (messages, calendar events, scheduled heartbeats), and decides what to do next. In your case this is a Python service running 24/7 on your Mac.

LAYER 2 — Planner
The LLM (Claude, GPT-4o, etc.) that receives context and decides which tools to call in what order. The state-of-the-art pattern is a graph-based workflow (LangGraph) or a role-based crew (CrewAI). For v1 a single Claude API call with tools works fine.

LAYER 3 — Tools / Skills
Discrete functions the agent can call: read email, write calendar event, search web, run a shell command. Each tool has a clear input/output schema and a risk level. The MCP (Model Context Protocol) standard from Anthropic is becoming the universal interface for tools.

LAYER 4 — Memory
Three tiers: (a) Working memory = the current conversation in the LLM context window. (b) Episodic/session memory = recent events stored in a lightweight DB like SQLite. (c) Long-term/semantic memory = a vector database or knowledge graph that persists across weeks and months.

LAYER 5 — UI / Gateway
How humans interact. Could be a chat interface (OpenClaw uses Telegram), a web dashboard, a desktop app, or all three. The gateway also handles inbound triggers (new email arrives, calendar reminder fires).

Best-practice patterns for 2025–2026:
•	Human-in-the-loop for risky actions (OWASP AI Agent Security Cheat Sheet, 2025).
•	Default-deny permissions: tools must be explicitly whitelisted (NVIDIA AI Red Team guidance, Feb 2026).
•	Structured action logs: every tool call is recorded with timestamp, input, output, and user approval status.
•	Heartbeat / proactive triggers: cron-style jobs that fire the agent without a human message (daily brief, missed meeting follow-up).
•	Context injection: relevant memories are pulled and injected into the agent's prompt just-in-time, keeping the context window lean.

1.3  Best Open-Source Frameworks for Multi-Agent Systems

Framework	Philosophy	Difficulty	Best For	Multi-Agent?	Recommendation
LangGraph	Graph-based state machine. Nodes + edges + explicit state transitions.	High — graph thinking required.	Complex workflows, compliance, debugging.	YES — subgraphs for parallel agent execution.	Best for v2+ when workflows get complex. Overkill for v1.
CrewAI	Role-based crews. Define agents with roles, goals, backstory.	Low-Medium — intuitive 'team' metaphor.	Multi-agent collaboration, prototyping.	YES — native. Role-based parallel execution.	BEST for v1 if you want multi-agent from day one. Fast to prototype.
AutoGen / AG2	Conversational agents that talk to each other to refine outputs.	Medium.	Iterative research, code generation, back-and-forth reasoning.	YES — agents negotiate with each other.	Consider for research/writing subagents in v2.
OpenAI Agents SDK	Streamlined agent runtime with guardrails, tracing built-in.	Low — but OpenAI-only.	OpenAI stack teams needing speed.	Moderate via handoffs.	Skip — locks you into OpenAI. Use if Claude is unavailable.
Pydantic AI	Lightweight, type-safe agent framework built on Pydantic validation.	Low-Medium — Pythonic and clean.	Production-quality single agents, strict output schemas.	Basic. Not its focus.	GREAT for individual tools/skills in your stack. Use alongside CrewAI.
Letta (MemGPT)	Memory-first stateful agents. OS-inspired memory hierarchy.	Medium.	Long-term memory, stateful personal agents.	YES — Conversations API for shared memory.	Use as your memory layer backend in v1. Excellent for personal use.

💡 Sources: DEV.to multi-agent guide (Feb 2026), Langflow framework comparison (Oct 2025), softmaxdata.com agentic frameworks guide (Mar 2026).

2.  UX & Solar-System Dashboard
2.1  Visual Inspiration & the Solar-System Metaphor
The solar-system UI metaphor is both beautiful and semantically rich. Here's how to map your product's concepts to it concretely:

Visual Element	Product Concept	Behavior / Animation	Growth Metaphor
Central Star (Sun)	The main AI agent (your 'Jarvis')	Pulses when active, glows when thinking, dims when idle.	Grows brighter as agent learns more about you.
Planets	Projects / major life domains (Work, Health, Finance, etc.)	Orbit the star. Click to enter. Size reflects active task count.	Bare rock → forest → city → metropolis as project matures.
Moons / Satellites	Subagents / specialized skills tied to a project	Orbit their parent planet. Spin when running a task.	New moon appears when a new subagent is spawned.
Asteroid Belt	Inbox / pending items (emails, tasks, decisions)	Rocks drift between planets. Clicking one opens the item.	Belt grows thicker when inbox is overloaded.
Star Field / Nebula	Memory graph background — all entities and relationships	Faint by default. 'Memory view' mode zooms in to reveal graph.	More stars appear as agent learns. Constellations emerge for clusters.
Orbital Rings	Recurring routines / automations (daily brief, weekly review)	Permanent visible rings around the star. Color = frequency.	Rings solidify as routines become reliable.
Comet / Shooting Star	Proactive notification or agent-initiated action	Streaks across the screen when agent does something without prompting.	N/A — event-driven.

Visual inspiration to study and show your designers:
•	Obsidian's graph view — force-directed node graph for interconnected notes. Perfect reference for your memory graph view. (obsidian.md)
•	SpaceEngine / Universe Sandbox — interactive solar-system UIs with deep-space aesthetics. Dark backgrounds, glowing objects, lens flare.
•	Notion's 'galaxy' concept (various fanmade themes on Reddit r/Notion) — dark mode workspaces with starfield backgrounds.
•	Civilization / city-builder metaphors — 'your project started as a campfire, now it's a city' gives users a sense of progress.
•	D3.js force graph examples (d3-force) — the best JavaScript library for an interactive knowledge graph.
•	Three.js for 3D solar system if you want full 3D (high wow factor but adds complexity). Achievable in a React component.

2.2  Best Practices for the Control Center & Knowledge Graph
Desktop control center dashboard:
•	Information hierarchy: The most important thing a user needs to know in 5 seconds should be visible on load. For you, that's probably: agent status (active/idle), today's agenda, and pending approval items.
•	Progressive disclosure: Don't show everything at once. The solar system home screen is ambient and beautiful. Clicking a planet drills into detail. Clicking a memory node zooms the graph.
•	Real-time activity feed: A persistent side panel or slide-over showing what the agent is doing right now (like Claude Code's streaming output). Users love seeing the AI 'think'.
•	Dark mode first: Space aesthetics demand it. Deep navy/black (#0A0E1A) background, soft glowing elements. Use glassmorphism for panels (frosted glass overlays).

Visual knowledge graph (memory map):
•	Use D3.js force-directed graph or vis.js Network. Both work well in React.
•	Nodes should be color-coded by type: people (blue), projects (gold), events (green), documents (gray), decisions (red).
•	Edges should show relationship type (works with, related to, mentioned in) via line style or hover tooltip.
•	Allow time-scrubbing: show only memories from 'last 30 days' with a timeline slider.
•	Make it searchable: clicking a node highlights all connected nodes. Typing a name zooms to that node.

Cross-platform chat interface (desktop + web + mobile):
•	The chat panel should be available in all views — a persistent slide-in from the right side of the screen.
•	For mobile/messenger access in v1, wire into Telegram (easiest: just use OpenClaw's gateway approach as a reference). You can message your agent from your phone without a native app.
•	Keep the same conversation thread across all surfaces — never lose context when switching from desktop to phone.

2.3  Top 5 UI/UX Patterns to Prioritize in V1
These five components give you 80% of the product's 'magic' with the least engineering effort:

1.  Solar System Home Screen
The canvas. A dark-mode space background with animated planets orbiting a central star. Each planet is clickable. The right panel shows today's agenda and agent status. This is your product's identity — invest design time here.

2.  Agent Activity Feed
A live, scrollable log of everything the agent has done or is doing. Entries look like: '[10:32 AM] Drafted reply to Sarah's email about Q2 budget — Pending your approval'. Each entry has a status badge (done / pending approval / failed) and a one-click approve/reject button for sensitive items.

3.  Planet / Project Detail View
Clicking a planet opens a full-screen view of that project. Think Notion's database view but themed: a list of recent agent actions, linked files, a mini memory graph for just this project, and the project's subagent (moon) status.

4.  Approval / Permissions Modal
When the agent wants to do something high-risk (send an email, delete a file), it pauses and triggers a modal. The modal shows exactly what will happen, why, and gives you Approve / Edit / Deny. This is the 'trust interface' — make it beautiful and clear, not scary.

5.  Memory Graph View
Accessible via the star-field button. A full-screen interactive knowledge graph showing all people, places, topics, and projects the agent knows about. Filter by time, type, or project. This view is a 'show-off' feature that will make early users say 'wow' in demos.

3.  Memory, Knowledge Graph & Proactive Behavior
3.1  Leading Memory Approaches & Tools
The agent memory field advanced dramatically in 2025–2026. Three distinct approaches have emerged:

Approach A: Flat + Vector Store (Mem0, LangMem)
Store memories as text chunks, embed them with a vector model, retrieve the most semantically similar ones at query time. Fast to implement, good for 'remember this fact' use cases. Mem0 raised $24M and processes 186M API calls per quarter. It has an SDK and a managed cloud option. Best for getting started quickly.

Approach B: Temporal Knowledge Graph (Zep / Graphiti)
Zep's Graphiti engine builds a three-tier knowledge graph (episode → semantic entity → community). Every fact has a validity period ('Alice was CEO from Jan–Mar 2026'). This enables time-aware queries: 'what did I know about Project X three months ago?'. Zep outperforms MemGPT on the Deep Memory Retrieval benchmark (94.8% vs 93.4%) and achieves 18.5% accuracy improvement on LongMemEval while reducing latency by 90%. Excellent for your use case because your life changes over time.

Approach C: OS-Inspired Stateful Runtime (Letta/MemGPT)
Agents explicitly manage their own memory using tools (write_memory, edit_memory, search_archival). Core memory blocks are always in the context window (identity, goals, preferences). Archival memory is retrieved on demand. The agent 'knows it has a memory' and can reason about it. Most powerful but most complex.

💡 Expert consensus (LobeHub memory-systems skill, Feb 2026): Start with Mem0 or Zep for fast delivery. Add Letta or Cognee for full agent self-management in v2. Production systems increasingly combine all three.

3.2  Practical V1 Memory Architecture (Local-First)
For a desktop-first app with privacy as a priority, here is the recommended v1 memory stack:

SQLite as the primary store. Everything lives locally on the user's machine at ~/Library/Application Support/SolarSystem/ (macOS) or equivalent. SQLite is battle-tested, zero-config, and fast enough for personal-scale data (millions of records).

Schema (simplified):
•	memories table: id, content (text), source (email/chat/calendar), project_id, created_at, last_accessed_at, importance_score (float)
•	entities table: id, name, type (person/place/topic/project), description, first_seen, last_seen
•	relationships table: id, entity_from_id, entity_to_id, relationship_type, evidence_text, valid_from, valid_to
•	events table: id, summary, project_id, agent_action, user_approved, timestamp, tool_used, result

Local vector embeddings: Use SQLite-vec (a SQLite extension for vector search) or store embeddings in a local Chroma database. Run embeddings locally using nomic-embed-text (free, fast, no API calls needed). For v1 you can also use the Anthropic API's embedding endpoint if you don't mind API costs.

Optional cloud sync (privacy-preserving): Encrypt memories client-side before uploading. Use a key only the user holds. Sync to iCloud / Dropbox / user's own S3 bucket. Never store unencrypted personal data on your servers.

💡 For v1, a simple SQLite + local vector search (SQLite-vec or DuckDB with vss extension) is enough. Don't over-engineer. OpenClaw's flat-file approach has proven that even crude memory systems feel magical when paired with a good agent.

3.3  Proactive Behavior — How to Do It Right
Proactive behavior is what makes an AI agent feel alive rather than just reactive. Successful patterns from real tools:

Heartbeats (OpenClaw's killer feature):
Schedule cron-style triggers: every morning at 7 AM, the agent reviews your calendar and emails from the past 24 hours, prepares a briefing, and sends it to you unprompted. In OpenClaw this is called a 'heartbeat'. Implement as a simple Python scheduler (APScheduler or cron).

Event-driven triggers:
New email arrives → agent classifies urgency and drafts a reply (pending approval). Calendar event starts in 15 minutes → agent sends you a brief with relevant context. Task deadline approaches → agent reminds you and suggests reprioritization.

Avoiding spamminess:
•	Implement a 'notification budget': the agent cannot send more than N proactive messages per day (start with 3–5).
•	Use importance scoring: only trigger proactive actions for events above a threshold.
•	Let users set 'quiet hours' where no proactive messages fire.
•	Always show what triggered the proactive action so users understand the agent's reasoning.
•	Include a 'snooze' button and a 'never notify me about this type of thing' option.

3.4  'Good Enough' V1 Memory System
The simplest memory system that feels magical:
•	Flat SQLite table with 5 columns: id, content, tags (comma-separated), created_at, project.
•	After every conversation, agent auto-generates 2–5 memory bullets and saves them.
•	Before every response, agent queries the SQLite table for the 10 most relevant memories using keyword search (no embeddings needed for v1).
•	Agent also has a 'Core Memory' block (always in context): user's name, preferences, top 5 projects, communication style.
•	Daily diary: every evening, agent writes a 1-paragraph summary of the day to a diary file.
This is roughly what OpenClaw does, and users describe it as 'magical'. Build this first. Add vector search, graph structures, and temporal queries only when users tell you memory is not accurate enough.

4.  Security, Safety & Permissions
4.1 & 4.2  Security Best Practices for Personal AI Agents (2025–2026)
The OpenClaw January 2026 audit found 512 vulnerabilities in a single codebase. A Cisco security team found that third-party OpenClaw skills performed data exfiltration without user awareness. Security researchers call unrestricted agent access the 'lethal trifecta' of risk. Don't build this way.

The non-negotiable controls (OWASP AI Agent Security Cheat Sheet + NVIDIA AI Red Team, 2025–2026):

Sandboxing:
•	Run all agent tool execution inside a sandboxed environment. For v1 on desktop, a Docker container with a read-only root filesystem and network allowlist is sufficient. Don't let the agent write outside its designated workspace directory.
•	For plugins/skills added by users: use a WASM sandbox (like ZeroClaw does) so that a malicious plugin physically cannot access the filesystem or network beyond its declared permissions. This is the gold standard.
•	Block file writes outside ~/SolarSystem/workspace/ by default.

Least-privilege permissions:
•	Grant the agent ONLY the minimum tools needed. An email-reading tool should not also be able to send email — those are separate, separately-authorized tools.
•	Classify every tool by risk level (using the OWASP framework): LOW (read file, web search), MEDIUM (write file, create calendar event), HIGH (send email, make API calls with payment info), CRITICAL (delete file, access credentials, send to unknown recipient).
•	Auto-approve LOW actions. Require user confirmation for MEDIUM+. Require explicit two-tap confirmation for CRITICAL.

Network isolation:
•	The local agent daemon should only make outbound calls to a whitelist: Anthropic API, Google/Microsoft OAuth endpoints, your own sync server. Everything else is blocked.
•	Critical rule from NVIDIA: block network access to arbitrary sites. This prevents data exfiltration even if the agent is compromised via prompt injection in a malicious email.

Prompt injection defense:
•	The biggest real-world attack vector (the Cursor/Jira attack, the Claude Code DNS exfiltration exploit — both happened in 2025). A malicious email or web page can contain instructions telling the agent to do things the user never authorized.
•	Defense: never blindly inject external content (email bodies, web pages) directly into the agent's system prompt. Always label it as 'untrusted content from external source'.
•	Implement Meta's 'Agents Rule of Two': an agent should not simultaneously (A) have access to untrustworthy data, (B) have sensitive system access, and (C) be able to take irreversible actions. For email: since emails are untrusted (A), limit what the agent can do with them to LOW-risk actions by default.

4.3  Practical V1 Security Model
Here is a concrete, implementable security model for your v1:

Default-deny approach:
Every tool is disabled by default. You (or the user) explicitly enables each tool category: 'Allow: read email. Allow: read calendar. Allow: draft replies (require approval before sending). Deny: access system files outside workspace.'

The Approval Flow UI (critical design element):
When the agent wants to do something MEDIUM or higher, it pauses and sends an approval request. On desktop: a modal pops up. On mobile (via Telegram): a message with two buttons. The approval request must show:
•	What: 'Send email to john@example.com'
•	Why: 'You asked me to follow up on the Q2 budget discussion from Tuesday'
•	Content preview: the full email draft, shown in a scrollable box
•	Risk level badge: color-coded (yellow = medium, red = high)
•	Buttons: Approve | Edit Before Sending | Deny

Action log (the 'receipt trail'):
Every agent action — approved or not — is written to an append-only log file AND shown in the Activity Feed in the UI. Entries include: timestamp, tool used, input, output, user decision, reason for action. Users should be able to scroll back a month and see exactly what the agent did and why.

What NOT to do (common pitfalls to avoid from day one):
•	Never store API keys or OAuth tokens in plaintext. Use macOS Keychain / Windows Credential Manager / libsecret on Linux. The agent accesses credentials via the OS secure store, never via a config file.
•	Never let plugins/skills run with your full user permissions. Always sandbox them.
•	Never auto-approve email sending, even for people the user emails often. Emails are irreversible.
•	Never log sensitive content (email bodies, passwords, financial data) to disk in plaintext. Encrypt or redact before logging.
•	Implement a daily spending cap on API calls. An agent loop bug can spend $100+ overnight. Cap at $5/day by default, configurable.

5.  Skills / Plugins & Personality System
5.1  How Current Platforms Model Tools & Skills
The Model Context Protocol (MCP), developed by Anthropic and now widely adopted, has become the standard interface for agent tools in 2025–2026. A tool is defined as a JSON schema with a name, description, and input/output types. The agent calls tools by name with typed parameters. This is the right abstraction for your skill system.

OpenClaw's approach: skills are Node.js modules in a skills/ folder. Each module exports a name, description, and execute() function. The agent's system prompt lists available skills. Any npm package can be a dependency — which is both the power and the security problem.

Better approach (ZeroClaw/WASM model): each skill is a compiled WASM module that declares its permissions in a manifest file (which APIs it needs, which file paths it can access). The runtime enforces these permissions at the hardware level. This is the model to aspire to in v2.

5.2  Proposed Skills System Design
Here is a concrete skills system design your engineers can implement:

Skill definition (a YAML file bundled with each skill):
•	name: string (e.g., 'gmail-reader')
•	description: string (natural language, used in agent prompt)
•	version: semver
•	permissions: list (e.g., ['read:email', 'write:calendar'])
•	tools: list of MCP-compatible tool schemas
•	triggers: optional list of event types that activate this skill (e.g., 'on:new_email')
•	config_schema: optional JSON schema for user-configurable settings

Developer experience (adding a new skill):
•	Create a folder in ~/SolarSystem/skills/my-skill/
•	Drop in skill.yaml + implementation file (Python or JavaScript)
•	The agent daemon hot-reloads skills on startup
•	Skills marketplace (v2): a curated directory of community skills, similar to OpenClaw's but with security vetting

User experience (enabling a skill):
•	Skills settings screen lists all installed skills with on/off toggles
•	Each skill shows its required permissions clearly ('Needs: Read Gmail, Write Calendar')
•	Users can configure skill settings (e.g., 'Gmail skill: check every 15 minutes')
•	Skill status visible in the solar system UI (as moons around the relevant planet)

Agent reasoning about skills:
The agent's system prompt automatically includes descriptions of all enabled skills. Claude is excellent at deciding which tool to use when given clear descriptions. For v1, this is enough. For v2, add an explicit tool-selection layer that pre-filters tools by relevance before sending to the LLM.

5.3 & 5.4  Personality Customization
Main agent persona:
The agent's personality lives in a core memory block called persona that is always injected at the top of every prompt. It contains:
•	Name (e.g., 'Navi', 'Jarvis', 'Atlas')
•	Communication style (e.g., 'direct, warm, uses light humor, never uses corporate jargon')
•	Values (e.g., 'proactive, honest about uncertainty, asks before assuming')
•	Knowledge about the user (updated over time from memory)
•	Working style preferences (e.g., 'morning brief at 7 AM, weekly review on Sundays')

Subagent personas (for v1, keep it simple — 3 roles max):
•	Executive Assistant subagent: handles email, calendar, meeting prep. Persona: efficient, detail-oriented, slightly formal.
•	Research subagent: web search, document summarization, fact-checking. Persona: curious, thorough, always cites sources.
•	Builder subagent (optional in v1): runs code, creates files. Persona: precise, asks for confirmation before irreversible actions.

Key design principle: each subagent must clearly identify itself in outputs. 'Your Executive Assistant has drafted the following email.' Never let subagents pretend to be the main agent. This prevents user confusion and makes the approval flow clearer.

6.  Platform, Architecture & Implementation Options
6.1  Desktop App Framework Decision
For a personal AI desktop app in 2026, Tauri 2.0 is the right choice over Electron. Here's why in plain terms:

Factor	Electron	Tauri 2.0 ← Recommended
RAM at idle	150–300 MB (bundles full Chrome)	20–50 MB (uses system WebView)
App installer size	80–150 MB	3–10 MB
Startup time	1–2 seconds	0.3–0.5 seconds
Security model	Flexible but risky if misconfigured. Node.js full system access.	Capability-based. Everything denied by default. Explicit Rust permissions.
Backend language	Node.js — JS/TS developers comfortable here.	Rust core + Python sidecar for agent logic. Frontend is React/TS (same as Electron).
Mobile support	No (Electron is desktop-only)	YES — Tauri 2.0 supports iOS and Android from the same codebase (beta but usable).
Ecosystem maturity	Large. VS Code, Slack, Figma all use Electron.	Growing fast. Tauri adoption up 35% YoY. Plugin ecosystem covers most needs.
Best for	Teams with Node.js expertise who need the broadest plugin ecosystem immediately.	Teams building AI-native apps that need low resource usage and strong security. This is you.

💡 Sources: Tauri vs. Electron comparisons from DoltHub (Nov 2025), RaftLabs (Sep 2025), dasroot.net (Mar 2026), ainexislab.com (Jan 2026).

6.2  Local LLM vs Commercial API

Approach	Pros	Cons	Monthly Cost	Recommendation
Claude API (Anthropic)	Best reasoning quality. No hardware needed. Always up to date.	Per-token cost. Data leaves device (encrypted in transit).	~$30–$80 for typical personal use	PRIMARY for v1. Use Claude Sonnet 4.6 for most tasks.
OpenAI API	Reliable. GPT-4o is fast and capable.	Same privacy trade-off as Claude.	~$30–$80	FALLBACK. Wire in as backup if Claude is unavailable.
Local models (Ollama + Llama/Qwen)	100% private. No API costs. Runs offline.	Needs powerful hardware (16GB+ RAM). Slower. Lower quality than Claude.	$0 API, but you need an M-series Mac or RTX GPU.	V2 OPTION. Add as 'privacy mode' for sensitive tasks.

Cost reality check: The MacStories reviewer burned through 180 million tokens in a month running OpenClaw on Claude Opus 4.5. At Sonnet pricing, 180M tokens would cost roughly $1,080. That's unusually high for a developer pushing the limits. Normal personal use is 5–15M tokens/month = $30–$100. Implement a daily spend cap (configurable, default $5/day) from day one.

6.3  Three Architecture Blueprints
Blueprint A: Minimal (Build This First)
Best for: April v1, one developer, maximum speed.

Components:
•	Tauri 2.0 shell: handles window management, system tray, OS notifications, file system permissions. Provides the desktop chrome.
•	React + TypeScript frontend: the UI layer. Three.js or CSS animations for the solar system home screen. D3.js for the memory graph. shadcn/ui components for the rest.
•	Python FastAPI service (sidecar process): the agent brain. Runs locally on port 7777 (localhost only). Handles: LLM calls, tool execution, memory read/write, scheduling (APScheduler).
•	SQLite: single database file. Stores memories, events, agent state, action logs.
•	Anthropic Claude API: the LLM. Called from the Python service.
•	Gmail API + Google Calendar API: OAuth2 tokens stored in OS keychain. Skills call these APIs.
•	Telegram bot (optional): for mobile access without a native app.

Data flow: User clicks something → Tauri IPC → Python FastAPI → LLM call (with memory context injected) → Tool calls if needed (with approval gate) → Result stored in SQLite → UI updates via WebSocket from Python.

⚠️  This blueprint has everything on localhost. No server to maintain. No cloud costs beyond API calls. Highly private.

Blueprint B: Desktop + Optional Cloud Sync (V1.5)
Same as Blueprint A, plus: A small FastAPI server deployed on a $10/month VPS (Hetzner or Fly.io). Used only for: (1) web dashboard access when not at desktop, (2) encrypted memory sync, (3) Telegram/WhatsApp gateway. The agent brain still runs locally — the server is just a relay and sync endpoint. Memory is encrypted client-side before sync (use libsodium or a simple AES-256 implementation).

Blueprint C: Full Multi-Agent Platform (V2)
The fully realized vision. The Python service evolves into a CrewAI or LangGraph orchestrator with named subagents. A skills marketplace server provides vetted plugins with WASM sandboxing. A React Native or Tauri mobile app. A PostgreSQL database with pgvector for semantic search. Zep/Graphiti for the knowledge graph layer. A user-owned sync server (or Cloudflare R2 for cheap object storage). This is your 6–12 month roadmap.

💡 For a non-technical founder with a small team: Build Blueprint A for April. Ship Blueprint B in May-June. Design Blueprint C but don't build it until you have real users telling you what they need.

Recommended v1 Stack at a Glance

Layer	Technology	Why	Alternatives if needed
Desktop shell	Tauri 2.0	Lightweight, secure, iOS/Android path	Electron (larger, more JS ecosystem, no mobile)
Frontend UI	React + TypeScript + Tailwind CSS + shadcn/ui	Best component ecosystem, excellent AI tooling	Svelte (faster, smaller) / Vue (gentler learning curve)
Solar system graphics	Three.js (3D) or CSS/SVG animations	Three.js for wow factor; CSS for lower complexity	D3.js for pure 2D data-driven animations
Memory graph	D3.js force-directed graph	Best interactive graph library for React	vis.js Network, Cytoscape.js
Agent service	Python 3.12 + FastAPI + APScheduler	Python has the best AI library ecosystem	Node.js + Express (if JS-only team); Go (if performance is critical)
Agent framework	CrewAI (v1) → LangGraph (v2)	CrewAI's role-based model maps to subagent metaphor perfectly	Raw LLM tool-calling (simplest for v0); AutoGen (for iterative tasks)
LLM	Claude Sonnet 4.6 (primary) + GPT-4o (fallback)	Best reasoning, tool use, and MCP support	Ollama + Qwen 2.5 for fully offline mode
Memory store	SQLite + SQLite-vec (v1) → Zep/Graphiti (v2)	Zero-config local storage; upgrade path to knowledge graph	Mem0 (managed, faster to implement); DuckDB+vss (better analytics)
Credentials	OS Keychain (macOS/Windows/Linux)	No plaintext secrets ever	1Password SDK (if users want vault integration)
Email/Calendar	Gmail API + Google Calendar API (OAuth2)	Google covers 70%+ of your target users' needs	Microsoft Graph API for Outlook/365 users
Mobile access (v1)	Telegram bot gateway	Fastest path to mobile without building a native app	WhatsApp Business API; iMessage via AppleScript (Mac only)
Cloud hosting (optional)	Fly.io or Hetzner VPS ($6–10/month)	For web dashboard + gateway relay only	Cloudflare Workers (serverless, $5/month); Railway

7.  V1 Scope, Roadmap & Risk
7.1  Tight V1 Feature Set (April 2026 Target)
The rule for v1: build the smallest thing that makes a technical user say 'I can't live without this.' Here is what that is:

MUST HAVE for April:
•	Solar-system home screen: animated star/planets, dark mode, status of main agent. One screen, beautiful, functional.
•	Main agent with personality: configurable name, communication style, always in context.
•	Gmail integration: read inbox, classify by urgency, draft replies (pending approval). Read-only by default with drafting enabled.
•	Google Calendar integration: read today's events, add to agent context for briefings, allow creation of events (with approval).
•	Morning briefing heartbeat: every day at a configurable time, agent summarizes emails + calendar + sends to user.
•	V1 memory: SQLite + keyword search, auto-generated memory bullets after each session, Core Memory block.
•	Activity log / action feed: every action shown with timestamp, approval status, and undo option where possible.
•	Approval flow: mobile push notification (via Telegram) + desktop modal for high-risk actions.
•	3 built-in skills: Email Reader, Calendar Manager, Web Search.
•	Setup wizard: 'connect Gmail → connect Calendar → name your agent → done.' Under 5 minutes.

NICE TO HAVE (defer to v1.5):
•	Memory graph visualization (the D3 star map)
•	Multi-agent subagents
•	Additional skills (Notion, Todoist, Slack, etc.)
•	Task management integration
•	Web dashboard
•	Cloud sync
•	Voice input/output
•	Skills marketplace

7.2  Phased Roadmap

Phase	Timeline	Audience	Key Deliverables	Success Metric
Phase 0: Foundation	Now → March	You + 1 engineer	Tauri shell + Python service + SQLite + Claude API connected. No UI. Agent responds to messages, reads email. Setup takes 30 min.	Agent successfully reads your email and drafts a reply without errors.
Phase 1: V1 Magic (April)	March → April	You + 5–10 technical friends	Solar system UI. Morning briefings. Memory v1. Approval flow. Setup wizard. Gmail + Calendar skills. Activity log.	10 people use it daily for 1 week. 8/10 say they'd pay for it.
Phase 2: Early Access	May → July	50–200 AI/tech enthusiasts	Memory graph view. 2 subagents (EA + Research). 5+ additional skills. Web dashboard. Telegram + iMessage gateway. Bug fixes from Phase 1.	200 DAUs. Avg session > 10 min/day. Net Promoter Score > 50.
Phase 3: Commercial Beta	Aug → Dec 2026	1,000–5,000 power users	Skills marketplace. Cloud sync (encrypted). Mobile app (Tauri mobile or React Native). Multi-agent workflows. Local LLM option. Pro subscription tier.	$5K MRR. 1,000 paying users. < 5% monthly churn.

7.3  Risks & Mitigation

Category	Risk	Why It Matters	Mitigation
Technical	LLM reliability	Claude API can have outages. If the agent is used 24/7, even 99.5% uptime = 44 hours of downtime per year.	Build a fallback to GPT-4o. Cache last-known-good briefings. Show clear 'agent offline' status in UI.
Technical	Memory quality degrades	Simple SQLite keyword search misses relevant memories. Agent gives outdated or wrong context. Users lose trust.	Add basic TF-IDF scoring in v1. Upgrade to vector search early in v1.5. Let users manually tag and curate memories.
Technical	Setup friction too high	If a non-technical person can't set it up in 10 minutes, you'll lose them. OAuth flows, API keys, and config files are all failure points.	Invest heavily in the setup wizard. Use PKCE OAuth2 (no client secret needed). Test the setup flow weekly with someone non-technical.
Security	Prompt injection via email	A malicious email tricks the agent into sending private data to an attacker. This has already happened with Claude Code and Cursor in 2025.	Never inject raw email bodies into the agent system prompt. Label all email content as 'UNTRUSTED'. Default: agent can only read/summarize email, not act on instructions found inside it.
Security	Skill supply chain attack	A malicious community skill exfiltrates data or sends emails without user knowledge. Happened with OpenClaw (Cisco finding, 2026).	In v1: ship only built-in skills, no community marketplace. In v2: vetting process + WASM sandboxing before any third-party skill is listed.
UX	Approval fatigue	If users get 20 approval requests per day, they'll start approving everything without reading. This defeats the entire safety model.	Implement a notification budget (max 5 proactive actions per day). Auto-approve recurring low-risk actions after 3 successful runs. Provide a 'always allow this for this contact' option.
UX	Agent makes a bad mistake publicly	Agent sends an email that embarrasses the user. One bad experience can kill the product's reputation at the early-access stage.	No auto-send emails in v1 — always require one-click approval for sending. Log all drafts. Add a 1-minute undo window after sending.
Cost	API cost spiral	An agent running 24/7 with many heartbeats and a large memory context can burn through $100+/month surprisingly fast.	Daily spending cap ($5/day default, configurable). Show real-time token usage in the UI. Use Sonnet (not Opus) by default. Cache briefings — don't regenerate if nothing has changed.
Cost	Infrastructure scaling costs	If the product is local-first, infra costs are near zero until you add cloud sync. Then costs scale with users.	Use Cloudflare R2 for sync storage ($0.015/GB/month, basically free for personal use). Build cloud sync as an optional Pro feature, not core.
Engagement	Novelty wears off	OpenClaw users report initial excitement fading after 2–4 weeks when the agent stops surprising them.	The solar-system growth metaphor is your retention engine — visible progress over time keeps users engaged. Add weekly 'system report' showing planet growth, memories added, tasks completed.

Deliverable 5: Solar-System Dashboard & UX Guide
Home Screen — The Solar System Canvas
Background: Deep space gradient — radial from #0A0E1A (near-black) to #0E1B3A (deep navy). Subtle star field generated with CSS/canvas (2,000 tiny dots, varying opacity, slight twinkle animation).

Central star: Your agent's identity orb. 80px diameter. Color shifts from cool white (#E8EFFF) when idle to warm gold (#FFD700) when active. Gentle 'breathing' pulse animation. Click to open the main chat panel.

Planets: 3–8 planets at different orbital radii. Each is a colored sphere with a texture (use simple SVG gradients). Orbit as smooth CSS animations with slight eccentricity (not perfect circles — slightly elliptical orbits look more realistic). Planet size = proportional to how active the project has been in the last 30 days.

Right sidebar (always visible, 300px): Today's schedule (from Google Calendar). Pending approval items. Agent status badge (Thinking / Active / Idle / Offline). Quick chat input at the bottom.

Keyboard shortcuts: Space = pause/resume all animations. M = open memory graph. C = open chat. Numbers 1–8 = jump to planet.

Planet / Project Detail View
Opens on planet click. Full-screen slide-in animation with the planet expanding to fill the canvas. Dark mode UI with the planet's color as an accent.

Layout — four zones:
•	Top bar: Planet name, creation date, status badge, settings gear
•	Left column (40%): Recent agent actions for this project. Timeline style: date/time on the left, action description on the right. Color-coded by action type (email = blue, calendar = green, file = gray). Click any action to see full details.
•	Center (60%): Project files, notes, and linked documents. Think Notion's page layout. Editable.
•	Bottom bar: Subagent (moon) status — which subagents are assigned, what they're working on.

Memory Graph View
Access via: clicking the star field background, or a 'Memory' button in the nav.

Visual design: Force-directed graph. Each node is a circle. Size = how often this entity has been referenced. Color by type: people (cyan), projects (gold), topics (violet), documents (gray), events (green).

Interactions:
•	Hover a node: show a tooltip with entity name, type, last mentioned date, and top 3 related entities.
•	Click a node: zoom to it, highlight all connected nodes, show a side panel with all memories referencing this entity.
•	Time slider (bottom): Scrub through time to see how the graph grew. Nodes that were added in the last 7 days glow brighter.
•	Search bar (top): Type a name or topic. The graph animates to center on matching nodes.

Camp → City growth metaphor for individual nodes:
Each entity node has a 'maturity level' based on how many memories reference it and how recent they are. Level 1 (1–5 memories) = small dot. Level 2 (6–20) = node with a tent icon inside. Level 3 (21–50) = town icon. Level 4 (50+) = city skyline silhouette. This gamification makes users want to 'develop' their graph by using the agent more.

Deliverable 3: Memory & Security Design Brief (Summary)
V1 Memory Architecture
•	Store: SQLite at ~/Library/Application Support/SolarSystem/memory.db
•	Tables: memories (id, content, tags, project_id, importance, created_at), entities (id, name, type, description), relationships (entity_from, entity_to, type, valid_from, valid_to), events (agent action log)
•	Retrieval: keyword FTS (SQLite full-text search) in v1. Upgrade to SQLite-vec for semantic search in v1.5.
•	Injection: before each LLM call, fetch top-10 relevant memories and prepend to context. Always include Core Memory block.
•	Auto-generation: after each session, ask Claude to generate 2–5 memory bullets and save them.
•	Privacy: all data local by default. Sync is opt-in, client-side encrypted.
•	Growth path: drop in Mem0 SDK or Zep OSS for v2 knowledge graph without changing the UI.

V1 Security / Permission Model
•	Default-deny: all tools disabled until user enables them in settings.
•	Risk tiers: LOW (read) = auto-approve. MEDIUM (create/edit) = log + surface in activity feed. HIGH (send/delete) = require explicit one-tap approval. CRITICAL (financial, credentials) = two-step confirmation.
•	Approval flow: push notification (Telegram) + desktop modal. Show WHAT, WHY, and PREVIEW. Buttons: Approve / Edit / Deny.
•	Action log: append-only SQLite table. Every action logged. Shown in activity feed. Exportable.
•	Prompt injection defense: external content (emails, web pages) labeled as UNTRUSTED. Agent cannot execute instructions found in external content without re-authorization from user.
•	API key storage: OS Keychain only. Never plaintext files.
•	Spending cap: $5/day default. Configurable. Hard stop — agent goes offline, sends notification.
•	Network whitelist: only Anthropic API, Google APIs, user's configured endpoints. All other outbound blocked.

Deliverable 4: Skills & Personality Design Brief (Summary)
Skills System
•	Format: skill.yaml + implementation file in ~/SolarSystem/skills/<name>/
•	Manifest fields: name, description, version, permissions[], tools[], triggers[], config_schema
•	V1 built-in skills: EmailReader, CalendarManager, WebSearch
•	User controls: settings screen with on/off toggle per skill. Permissions displayed in plain English. Configuration form auto-generated from config_schema.
•	Agent awareness: all enabled skill descriptions injected into system prompt. Claude decides which tool to use contextually.
•	Security: v1 skills run in Python subprocess with restricted imports. V2: WASM sandbox.

Personality Model
•	Main agent persona: stored in Core Memory block. Always in context. Contains: name, communication style, values, user preferences, working style.
•	3 built-in subagent roles: Executive Assistant (email/calendar), Research Agent (web/docs), Builder Agent (code/files — optional v1).
•	Each subagent identifies itself in output: 'Your Executive Assistant has drafted...'
•	Persona editor in settings: plain text fields, no code. 'My name is ___. I communicate in a ___ style. I value ___.'
•	Safety: personality cannot override security model. Persona is aesthetic, not permissions.

Final Recommendations for a Non-Technical Founder
Here is the clearest possible summary of what to do and in what order:

1.  Hire an engineer who has built with Tauri or Electron AND has Python/FastAPI experience. This combination is your bottleneck. One good full-stack engineer (plus a designer) can ship v1 in 6–8 weeks.

2.  Use Blueprint A (everything local) for April. Resist the urge to build cloud infrastructure early. Local-first is your differentiator and it's cheaper and safer.

3.  Start with Gmail + Calendar only. Don't add Notion, Slack, Todoist, or any other integrations until you've validated that the core email/calendar loop is reliable and delightful.

4.  Invest 40% of your design budget in the solar-system home screen and the approval modal. These two screens ARE the product in the first 5 minutes of a user's experience. Everything else can be rough.

5.  Use CrewAI for the multi-agent layer from day one, even if v1 only has one active agent. It's easy to start simple with CrewAI and add subagents later without architectural rework.

6.  Ship to 10 people before April, not 100. The OpenClaw magic was experienced by one person (Peter Steinberger) building something for himself. Build for yourself first. The product will be better for it.

7.  Security is not optional. Read the OWASP AI Agent Security Cheat Sheet with your engineers before writing a single line of code. Implement default-deny and the approval flow in week 1, not as an afterthought.



End of Report  •  Solar System AI Control Center  •  March 2026

All sources referenced are accessible via web search as of March 7, 2026.
