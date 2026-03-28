# Project Research Summary

**Project:** Voice Notifications v2.0 — Center Console
**Domain:** AI coding session command center, multi-session monitoring, Manager AI orchestration
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (stack and architecture high; Manager AI features are novel territory)

## Executive Summary

Voice Notifications v2.0 evolves a working, lean notification tool into a full-session command center for Claude Code. The existing architecture — plain Node.js, vanilla JS, SSE event bus, file-based persistence — is sound and should be preserved. Research confirms the correct approach is evolution, not rewrite: add server-side session state, split the monolithic frontend into ES modules, and layer the Manager AI on top of a stable foundation rather than alongside it. The only new npm dependencies justified by research are `ws` (WebSocket for bidirectional commands) and `@anthropic-ai/claude-agent-sdk` (Manager AI access), with all existing dependencies (`web-push`, `edge-tts`, `playwright`) remaining unchanged.

The core insight from cross-cutting research is that this is a monitoring dashboard, not an IDE. Two questions must be answerable at a glance: "Is any session waiting for me?" and "What is each session doing?" Every feature decision must be filtered through this lens. The pitfalls research identifies "dashboard of everything" (Grafana syndrome) as the most likely failure mode — more data is worse when it obscures the signal. The session state model must use TTL-based staleness rather than attempting to track explicit start/end lifecycle events, because Claude Code hooks do not provide reliable session boundaries.

The biggest risk in v2.0 is the Manager AI layer. Research shows it can deliver real value as a passive observer generating on-demand summaries, but cost explosion (per-event LLM calls) and feedback loops (AI responding to its own actions) are rewrite-level failures. The mitigation is sequencing: build and validate the session foundation before touching the Manager AI, keep the Manager AI observe-only in v2.0, and use batched or on-demand API calls rather than event-triggered ones. Input injection to running Claude Code sessions is explicitly not achievable without tmux and is not on the v2.0 roadmap.

## Key Findings

### Recommended Stack

The project stays dependency-lean. No UI framework, no database, no build step. Two new server-side packages are justified: `ws@^8.18` for WebSocket (user commands from dashboard to server) and `@anthropic-ai/claude-agent-sdk@0.2.86` (pinned) for the Manager AI. The browser side remains entirely dependency-free, using native ES Modules, Web Components, Proxy-based reactive state, and `EventSource` for SSE.

**Core technologies:**
- `ws@^8.18`: WebSocket server — adds bidirectional command channel (dismiss, mark seen, request summary) alongside existing SSE; most mature Node.js WS lib, zero native deps
- `@anthropic-ai/claude-agent-sdk@0.2.86` (pinned): Manager AI access — session listing, `query()`, hooks; pre-1.0 so must wrap in abstraction layer to isolate breaking changes
- ES Modules (native browser): frontend code split — replaces monolithic 1400-line file with 8-10 focused modules, no build step required
- Proxy-based reactive store (~50 lines, hand-rolled): replaces scattered `render*()` calls with automatic reactivity — no Zustand/Redux needed
- CSS Grid + container queries (native): screen-filling responsive layout — no Tailwind, no build step, no runtime overhead

**What stays out:**
React/Svelte/Vue, TypeScript, Express/Fastify, SQLite/Redis, Socket.IO, Vite, Tailwind, Docker — none justified for a single-user monitoring tool at this scale.

### Expected Features

**Must have (table stakes):**
- Rich session cards: session_id, project, machine, state badge (working/done/attention/stale/error), duration, last message preview
- Session lifecycle states: TTL-based staleness (working if event within 5 min, stale at 5 min, removed at 30 min) — not event-lifecycle-based
- Cross-machine aggregation: CodeBox + Lenovo + Mac sessions in one view
- Screen-filling CSS Grid layout for 16" screen (designed for 960px half-screen minimum)
- Notification preservation: v1.0 voice + push + toast must continue working without regression
- Sidebar config panel: voice/push settings moved out of main view into collapsible drawer

**Should have (differentiators):**
- Tool activity stream per session (PostToolUse hook: "Bash: npm test", "Edit: src/auth.ts")
- Question display with context and "Focus" button (tmux select-window for CodeBox sessions)
- Session grouping by project (multiple sessions on same project grouped visually)
- Compact vs expanded card toggle (overview grid vs single-session detail mode)
- Stale session detection with "Last seen: Xm ago" display (honest partial view)
- Server-side session state: survives page reload, syncs across multiple browser tabs

**Defer (v2+):**
- Session transcript viewer (JSONL parsing, local sessions only)
- Session recording and replay (requires full event persistence + timeline UI)
- Error pattern detection
- Token/cost tracking
- Input injection to running sessions (no Claude Code public input API exists)
- Active Manager AI instruction relay (same blocker as input injection)
- Terminal embedding in dashboard (separate product scope)

### Architecture Approach

The recommended architecture moves session state from the browser to the server, splits the frontend into ES modules served statically, and adds the Manager AI as an isolated on-demand module. Communication remains SSE (server to client) plus HTTP POST (client to server) — WebSocket is added only for the command channel (dismiss, mark seen, request AI summary). Persistence uses JSON files and JSONL append logs; no database is needed at this data volume (kilobytes per day even with 20 sessions).

**Major components:**
1. `sessions.js` (NEW) — server-side session store: Map keyed by sessionId, TTL timers for staleness, event history (last 20 per session), delta SSE broadcasts (not full state)
2. `persistence.js` (NEW) — JSON file snapshots for restart recovery + JSONL event logs with 7-day rolling retention; no SQLite
3. `manager.js` (NEW) — Manager AI: on-demand `claude -p --bare` calls with session snapshot context, 30s cooldown, observe-only scope in v2.0
4. `public/modules/` (NEW, ~10 files) — ES module split: app.js, state.js, sse.js, sessions.js, feed.js, toasts.js, config-panel.js, manager-panel.js, audio.js, utils.js
5. `hooks/notify-trigger.cjs` (MODIFIED) — richer payload: hookEvent, lastMessage, toolName fields added; new `/install-hook` endpoint serves one-liner cross-machine installer
6. Unchanged: `sse.js`, `config.js`, `tts.js`, `push.js`, `public/sw.js` — these modules are working and modular; do not touch during v2.0 unless a specific feature requires it

**Key architectural constraint:** Send delta events via SSE, not full session state. An SSE event carries only what changed (`{sessionId, field, value}`). Full state sync happens only on initial connection via the replay buffer or an explicit `/sessions` REST endpoint.

### Critical Pitfalls

1. **Session state designed around events, not sessions** — Claude Code has no reliable SessionStart/SessionEnd hooks. Use TTL-based staleness, not lifecycle state tracking. Display "Last seen: 2m ago" not "Status: Active." Never try to derive whether a session is running from hook events alone.

2. **Manager AI cost explosion** — per-event LLM calls with 5+ sessions can reach $120/day. Batch events; call on user demand or schedule (every 30-60s maximum). Hard token budget cap. Use cheapest model (Haiku, not Sonnet/Opus). Pattern-matched status strings may cover 80% of the value at zero cost — consider this before defaulting to LLM.

3. **Manager AI feedback loop** — if the AI can send instructions to sessions and those sessions fire hooks, the Manager AI sees its own actions as inputs and oscillates. v2.0 Manager AI must be observe-only. Source-tag all events. No automated actions without explicit human confirmation.

4. **Cross-machine clock skew** — Tailscale does not synchronize clocks; machines can drift 1-5 seconds apart. Use server-arrival time (SSE eventId, already monotonic in sse.js) for ordering. Store client timestamps as metadata only. Display relative times ("3s ago") to hide skew from users.

5. **SPA memory leak from long-running tab** — 8+ hour dashboard sessions with unbounded event history crash browser tabs. Cap session event history at 50 items. Use ring buffers for toasts (max 20 in DOM). Use event delegation (one handler per container) not per-element listeners. Audit with `performance.memory.usedJSHeapSize` periodically.

6. **Information overload kills utility** — the dashboard answers exactly two questions. Maximum five visible data points per session card in default view. Progressive disclosure for details. Apply the squint test: can you identify the waiting session from 3 feet away? If not, the design has failed.

## Implications for Roadmap

Based on combined research, the build order is dictated by a clear dependency chain: session state must exist before UI can display it, UI must be split before new panels can be added, and the Manager AI must build on a stable foundation.

### Phase 1: Server-Side Session Foundation

**Rationale:** Everything else depends on server-side session state. Browser-only sessions cannot survive reloads, serve multiple tabs, or feed the Manager AI. This is the mandatory first step — all subsequent phases assume it exists.
**Delivers:** `sessions.js` module, `/sessions` REST endpoint returning current session state, new SSE event types (`session:update` with delta payloads), static file serving for `public/modules/` directory
**Addresses:** Session lifecycle states, cross-machine aggregation readiness (server as single source of truth), multi-tab consistency
**Avoids:** Pitfall 1 (event-centric model — TTL-based staleness from day one), Pitfall 8 (SSE bottleneck — delta events only, full state via REST)

### Phase 2: Frontend Module Split + Session Cards

**Rationale:** The monolithic 1400-line `public/index.html` must be split before any new UI work. Adding session cards, manager panel, and sidebar to a single file produces unmaintainable code and merge conflicts. The split enables each module to be developed, tested, and reviewed in isolation.
**Delivers:** ES module structure under `public/modules/`, session card grid with rich data (project, machine, state badge, duration, last message), screen-filling CSS Grid layout, sidebar config panel (voice/push settings removed from main view)
**Addresses:** Rich session cards, screen-filling layout, sidebar config (all table stakes features)
**Uses:** Native ES Modules (browser stable since 2018), CSS Grid + container queries, Proxy-based reactive store (~50 lines)
**Avoids:** Pitfall 5 (memory leaks — ring buffers and event delegation implemented from day one, not retrofitted), Pitfall 6 (information overload — 5-element card rule enforced from initial design), Pitfall 10 (CSS layout — design for 960px half-screen first)

### Phase 3: Rich Session Context + Cross-Machine Hooks

**Rationale:** With session infrastructure and UI in place, enriching the data flow is the next lever. PostToolUse hooks and richer hook payloads provide the differentiating features. Grouping this with cross-machine hook improvements means one coordinated change to `notify-trigger.cjs` and server hook handling.
**Delivers:** PostToolUse hook integration, tool activity stream per session, question display with context and "Focus" button (tmux select-window), session grouping by project, hook installer endpoint (`/install-hook` one-liner for remote machines)
**Addresses:** Tool activity stream, question display with focus routing, cross-machine setup friction (all differentiator features)
**Uses:** Enhanced `notify-trigger.cjs` (hookEvent, lastMessage, toolName fields; all backward-compatible with optional defaults)
**Avoids:** Pitfall 4 (clock skew — server timestamps used for ordering, client timestamps stored as metadata), Pitfall 9 (silent hook failures — local error logging in hook script, "last seen per machine" display), Pitfall 7 (notification regression — integration test gate: POST /trigger, verify SSE event, verify audio, must pass at every commit)

### Phase 4: Persistence + Event History

**Rationale:** Session history and restart recovery are high-value features that build directly on the session model from Phase 1. Sequencing after Phase 3 ensures the right enriched data (tool events, last messages) is being persisted — not just bare trigger events.
**Delivers:** `persistence.js` (JSONL event logs with 7-day rolling retention, session JSON snapshots for restart recovery), session timeline UI in expanded card view (last 10 events), server restart recovery (sessions restored from snapshot, older than 30 min discarded)
**Addresses:** "What did it do while I was away?" (session history — table stake)
**Avoids:** Pitfall 14 (premature database — JSON files only; no SQLite, no better-sqlite3, no node:sqlite experimental flag)

### Phase 5: Manager AI (Passive Observer)

**Rationale:** Manager AI is the highest-risk feature (API costs, latency, feedback loops, pre-1.0 SDK) and has the lowest dependency on prior phases — it observes session state without changing it. Building it last ensures it inherits a stable, correct session model and the team has operational knowledge of the system before adding an AI layer.
**Delivers:** `manager.js` module (on-demand `claude -p --bare` calls with session snapshot as context), manager panel in UI (`public/modules/manager-panel.js`), status summaries triggered by user button or anomaly detection (session stuck in attention state), 30s cooldown between calls, hard token budget cap
**Addresses:** "What is happening across all my sessions right now?" (Manager AI passive monitoring — differentiator)
**Avoids:** Pitfall 2 (cost explosion — on-demand and scheduled only, Haiku model, token budget), Pitfall 3 (feedback loop — observe-only scope, no automated actions, source tagging on all events), Anti-pattern (persistent AI session — stateless `claude -p` calls, not a long-running session)

### Phase Ordering Rationale

- Sessions before UI: the UI cannot render correct multi-tab-consistent data without server-side state; the browser Map was a working prototype, not a foundation
- UI split before new panels: the monolith cannot absorb the manager panel, sidebar drawer, and detail expansion — split first or pay the debt continuously
- Rich hooks after session UI: the display layer must exist to show the richer data; enriching hooks before the UI is ready means the data arrives with nowhere to go
- Persistence after hooks: enriched event data (tool names, last messages) should be what gets persisted; bare trigger events are less valuable
- Manager AI last: highest risk, lowest dependency, inherits stable session model; a feature flag addition rather than a structural dependency; if it fails or costs too much, the rest of the system is unaffected

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 5 (Manager AI):** Agent SDK is pre-1.0 (v0.2.86), API may change between planning and execution. Needs targeted research-phase to verify current `listSessions()`, `query()` with `--resume`, and hooks interface before implementation begins. Cost modeling also needs validation against real session event volumes before committing to any architecture.
- **Phase 3 (PostToolUse hook volume):** PostToolUse events fire on every tool call — potentially 50-200/hour per active session. Before implementing, measure actual event rate in a real coding session to validate debouncing strategy. If volume is high, the server needs rate limiting before events reach the session history store.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Server-side sessions):** Straightforward server state management. Session store is a Map with TTL timers — no novel territory. All patterns well-documented.
- **Phase 2 (Frontend module split):** ES Modules, CSS Grid, and Proxy stores are stable browser APIs since 2016-2018. No research needed.
- **Phase 4 (Persistence):** JSONL append logs with rolling retention is a solved problem in Node.js built-ins. No novel territory.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Two new deps justified by clear, specific need. Vanilla-first validated against existing codebase. WebSocket via `ws` is a standard, mature pattern. |
| Features | MEDIUM | Table stakes are well-defined and feasible. Differentiators (tool activity stream, question focus) depend on PostToolUse hook reliability — officially documented but not yet measured at volume in this codebase. |
| Architecture | HIGH | Build order derived from concrete dependency analysis of existing codebase. SSE+POST bidirectional pattern validated against MCP precedent. ES module split is standard and stable. Delta SSE events are the right abstraction. |
| Pitfalls | HIGH | Memory leaks, clock skew, and dashboard overload are well-documented failure modes with specific mitigations. Manager AI pitfalls are domain-specific but well-reasoned from first principles and analogous system failures. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Agent SDK API stability:** SDK is v0.2.86 (pre-1.0). The `listSessions()` and `query()` API shape must be re-verified at Phase 5 planning time. Wrap SDK calls in an abstraction layer from day one to isolate breaking changes from the rest of the codebase.
- **PostToolUse event volume:** Unknown how many PostToolUse events fire per session per hour in real usage on this specific project. If greater than 100/hour, the server needs debouncing before storing to session history. Measure before committing to Phase 3 implementation approach.
- **tmux availability for "Focus" button:** The "Focus" button (Phase 3) only works if Claude Code sessions run in tmux on CodeBox. Needs verification of actual session management practice before implementing. Fallback: show project path as copyable text for manual terminal navigation.
- **Manager AI cost baseline:** Actual cost per summary call depends on session state payload size and model choice. Establish a concrete monthly budget before Phase 5 and work backward to maximum call frequency before any implementation begins.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — all 21+ lifecycle events, input schemas, common fields including PostToolUse, SessionStart, Stop, Notification
- [Claude Code Headless/Programmatic Docs](https://code.claude.com/docs/en/headless) — session resume, `--output-format`, `--continue`, `--bare` flags
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) — Manager AI orchestration patterns and precedent
- [@anthropic-ai/claude-agent-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — v0.2.86, published March 2026, weekly releases
- [ws on npm](https://www.npmjs.com/package/ws) — WebSocket library, 25M+ weekly downloads, zero native deps
- [Node.js SQLite API](https://nodejs.org/api/sqlite.html) — confirmed still experimental in Node v25 (justifies JSON files over SQLite)

### Secondary (MEDIUM confidence)
- [Mission Control by Builderz](https://mc.builderz.dev) — open-source agent orchestration dashboard, WebSocket/SSE patterns, cost tracking reference
- [Overstory multi-agent orchestration](https://github.com/jayminwest/overstory) — tiered watchdog system (mechanical daemon + AI triage + monitor agent) as Manager AI precedent
- [MCP SSE Architecture](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/) — SSE + POST bidirectional pattern validation
- [Memory Leaks in SPA — SciUp](https://sciup.org/memory-leaks-in-spaprevention-detection-and-remediation-methods-14131720) — ring buffer and cleanup patterns, production evidence
- [Clock Skew in Distributed Systems — Arpit Bhayani](https://arpitbhayani.me/blogs/clock-sync-nightmare/) — server-assigned ordering validation
- [NOC Dashboard Design — AlertOps](https://alertops.com/noc-dashboard-examples/) — NOC and mission control layout patterns (grid of equals, focus + context, status wall)

### Tertiary (LOW confidence, needs validation)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) — API surface for Manager AI; pre-1.0, must be re-verified at Phase 5 planning
- [Feature Request: Programmatic Input in Interactive Mode](https://github.com/anthropics/claude-code/issues/15553) — confirms input injection limitation (community issue confirms lack of public API)
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) — Proxy-based reactive store pattern reference

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
