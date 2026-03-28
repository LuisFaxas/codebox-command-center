# Phase 4: Session Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 04-session-foundation
**Areas discussed:** Session data model, Session lifecycle, API design, Notification regression strategy

---

## Session Data Model

### Event History Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Last 20 events per session | Enough for useful timeline without unbounded growth | |
| All events, capped at 24 hours | Keep everything from today, wipe on rotation | |
| Minimal — last event only | Just current state, history comes in Phase 5 | |
| You decide | Claude picks the right balance | ✓ |

**User's choice:** Claude's discretion
**Notes:** None

### Question Text Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, store question text now | Capture data early even if display comes in Phase 6 | |
| Store if available, don't block on it | Try to capture, don't fail if unavailable | |
| Defer to Phase 6 | Phase 4 just tracks type/status | |

**User's choice:** Future-proof the model (free text response)
**Notes:** User described a vision of a single mission control where all sessions appear, questions are visible, and responses can be relayed back. Wants to capture question text now to enable Phase 6 interaction. Acknowledged that response relay is blocked on Claude Code API limitations but wants the data model ready. Suggested tmux send-keys as a potential workaround for CodeBox sessions.

---

## Session Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Persist to JSON, restore on start | Write periodically, load on restart, drop >30min | |
| Persist every event immediately | Write on every change, append-only JSONL | |
| You decide the strategy | Claude picks based on write frequency and data volume | ✓ |

**User's choice:** Claude's discretion
**Notes:** None

---

## API Design

| Option | Description | Selected |
|--------|-------------|----------|
| REST + SSE hybrid (Recommended) | GET /sessions snapshot + SSE deltas | ✓ |
| SSE only | All data through SSE, replay for history | |
| You decide | Claude picks based on infrastructure | |

**User's choice:** REST + SSE hybrid
**Notes:** Research-recommended pattern

---

## Notification Regression Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright test suite | Automated: trigger, verify toast, verify audio, verify SSE | ✓ |
| Manual test checklist | Document 5 checks, verify manually | |
| Both | Playwright for automatable, manual for audio | |

**User's choice:** Playwright test suite
**Notes:** None

---

## Claude's Discretion

- Session persistence strategy
- Event history depth per session
- SSE event format for session updates
- Internal cleanup mechanics

## Deferred Ideas

- Response relay from dashboard to running sessions (blocked on Claude Code API)
- Full chat interface per session (beyond v2.0)
- Cross-session dependency detection (Phase 7 Manager AI)
