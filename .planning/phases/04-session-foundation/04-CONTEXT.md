# Phase 4: Session Foundation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Server tracks all Claude Code sessions as first-class entities with persistent state that survives restarts. Sessions have a rich data model designed to support future interaction features (Phase 6). Notifications (voice, push, toast) must continue working with no regression — verified by Playwright test suite.

This phase builds the backend session infrastructure. No UI changes (Phase 5), no new hook types (Phase 6), no Manager AI (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Session Data Model
- **D-01:** Sessions are first-class server-side entities, not client-side Maps. Each session has: sessionId, project, machine, cwd, status (working/done/attention/stale), lastActivity timestamp, startedAt timestamp, event history, and question text when available.
- **D-02:** Event history depth and storage strategy is Claude's Discretion — balance usefulness with storage/performance constraints.
- **D-03:** Store question text from hooks when available, even though question display UI comes in Phase 6. Design the model to support future interaction features (response relay, tmux focus).
- **D-04:** Future-proof the model for Phase 6 interaction: include fields for pending question text, question timestamp, and potential response metadata.

### Session Lifecycle
- **D-05:** TTL-based lifecycle (not event-lifecycle). Sessions with no activity for 5 minutes become stale. Sessions with no activity for 30 minutes are removed. Carried forward from Phase 3 / research decisions.
- **D-06:** Persistence strategy is Claude's Discretion — pick the right approach for write frequency, data volume, and PM2 restart survival.

### API Design
- **D-07:** REST + SSE hybrid pattern. GET /sessions returns full snapshot for initial page load. SSE delivers real-time delta events for updates. This is the research-recommended pattern.
- **D-08:** Existing SSE infrastructure (sse.js) stays — extend with session-specific events, don't replace.

### Notification Regression
- **D-09:** Playwright test suite for regression verification. Automated tests verify: trigger fires SSE event, toast appears in dashboard, audio endpoint returns valid response, push endpoint responds. Run after each plan in this phase.

### Claude's Discretion
- Session persistence strategy (JSON snapshots, JSONL append, hybrid)
- Event history depth per session
- Session data file location and format
- How stale/removed session cleanup works internally
- SSE event format for session updates (what fields in the delta)
- Whether to add a new sessions.js module or extend server.js

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research
- `.planning/research/ARCHITECTURE.md` — Session data model design, persistence strategy, build order
- `.planning/research/FEATURES.md` — Session depth analysis, hook data available, interaction feasibility
- `.planning/research/PITFALLS.md` — Session model is #1 risk, SPA memory leaks, TTL-based staleness
- `.planning/research/SUMMARY.md` — Synthesized recommendations

### Current Implementation
- `server.js` — Trigger endpoint already captures type/project/machine/sessionId/cwd
- `sse.js` — Event bus with emit/addClient/replay buffer
- `config.js` — JSON persistence pattern (reusable for session storage)
- `public/index.html` — Current client-side session Map() to be replaced by server-side

### Requirements
- `.planning/REQUIREMENTS.md` — SESS-01, SESS-02, SESS-05, SESS-06, NOTIF-01, NOTIF-02, NOTIF-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.js` — JSON file persistence pattern with load/save/get. Reusable for sessions.js.
- `sse.js` — Event bus with emit(), addClient(), replay buffer. Extend with session-specific events.
- Server trigger handler (server.js:121-155) — Already parses sessionId, project, machine, cwd from POST body.

### Established Patterns
- ES module imports (server.js uses `import { } from './module.js'`)
- JSON file persistence in `data/` directory (config.json, vapid.json)
- Callback-style async for edge-tts, but modern patterns elsewhere
- PM2 for process management — restarts happen, persistence must handle it

### Integration Points
- Trigger handler in server.js — where session create/update logic goes
- SSE emit in sse.js — where session update events get broadcast
- GET route table in server.js — where /sessions endpoint goes
- `data/` directory — where session persistence files go

</code_context>

<specifics>
## Specific Ideas

**User's core vision (captured during discussion):**
The ultimate goal is a single mission control dashboard where ALL Claude Code sessions appear, the user can see what each is doing, see when any needs attention, and eventually respond to questions from one location instead of juggling 7+ terminal windows. This Phase 4 is the data foundation for that vision.

**Key insight:** The user frequently runs 7+ concurrent sessions across CodeBox, Lenovo, and Mac. The session model must handle this volume without performance issues. Speed of status updates matters — when Claude asks a question, the user needs to see it within seconds.

</specifics>

<deferred>
## Deferred Ideas

- **Response relay from dashboard** — User wants to type responses to Claude's questions from the dashboard and have them relay to the running session. Blocked on Claude Code having no input injection API. Possible tmux workaround for CodeBox sessions. → Phase 6 / future research.
- **Chat interface per session** — Full message relay where dashboard acts as a proxy to each terminal session. → Beyond v2.0 scope, requires Claude Code API changes.
- **Cross-session dependency detection** — AI identifies when sessions are working on related code. → Phase 7 Manager AI scope.

</deferred>

---

*Phase: 04-session-foundation*
*Context gathered: 2026-03-28*
