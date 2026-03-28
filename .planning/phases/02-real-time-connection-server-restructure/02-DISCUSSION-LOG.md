# Phase 2: Real-Time Connection + Server Restructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-real-time-connection-server-restructure
**Areas discussed:** SSE event design, Server file structure, Trigger.json fate, Caddy SSE config

---

## SSE Event Design

| Option | Description | Selected |
|--------|-------------|----------|
| Triggers only (Recommended) | SSE sends notification events only. Phase 3 adds more event types later. | |
| Triggers + session heartbeats | Also broadcast periodic session-alive pings for dashboard. | |
| Full event bus | Carry triggers, session status, config changes, and connection health. | ✓ |

**User's choice:** Full event bus
**Notes:** User wants complete event system built now so Phase 3 just consumes it.

| Option | Description | Selected |
|--------|-------------|----------|
| Single /events endpoint (Recommended) | One SSE connection carries all event types differentiated by event: field. | ✓ |
| Separate endpoints | e.g. /events/triggers, /events/sessions. Clients subscribe to what they need. | |

**User's choice:** Single /events endpoint

**Event types selected (multiSelect):** trigger, session:alive, config:updated, connection:health — all four selected.

---

## Server File Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Full module split (Recommended) | Split into server.js, sse.js, tts.js, config.js, public/index.html. | ✓ |
| Extract HTML only | Move HTML to public/index.html, keep all server logic in one file. | |
| Extract HTML + SSE module | HTML to static file, SSE logic to its own module, keep rest in server.js. | |

**User's choice:** Full module split

| Option | Description | Selected |
|--------|-------------|----------|
| Stay with CommonJS (Recommended) | Matches existing codebase pattern. No package.json changes needed. | |
| Switch to ES modules | Modern standard, top-level await, better tree-shaking. Requires package.json. | ✓ |

**User's choice:** Switch to ES modules
**Notes:** User chose the modern approach over matching existing patterns.

---

## Trigger.json Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely (Recommended) | SSE replaces file-based signaling. In-memory event bus with replay buffer. | |
| Keep as crash recovery | Write trigger.json as backup, replay on server restart. | |
| Keep for non-SSE clients | Maintain /check polling alongside SSE for backward compat. | |

**User's choice:** "Research and use the absolute industry leading solution"
**Notes:** User wanted best-in-class approach. Resolved to: remove trigger.json, use in-memory event bus with Last-Event-ID replay buffer per SSE spec (same pattern as GitHub, Slack, PagerDuty production systems).

---

## Caddy SSE Config

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side keepalive + Caddy flush (Recommended) | Server sends :keepalive every 15s, Caddy configured with flush_interval=-1 and extended read_timeout. | ✓ |
| Caddy config only | Set flush_interval and timeouts in Caddy, rely on event traffic. | |
| Server keepalive only | Frequent keepalive pings, default Caddy config. | |

**User's choice:** Server-side keepalive + Caddy flush

| Option | Description | Selected |
|--------|-------------|----------|
| Include in plan (Recommended) | Plan includes task to update Caddy config. Executor handles it. | ✓ |
| Manual / separate | Plan documents settings needed, user configures manually. | |

**User's choice:** Include in plan

---

## Claude's Discretion

- Replay buffer size
- Session:alive heartbeat collection mechanism
- Internal module boundaries and function signatures
- ES module migration strategy for hook script
- Package.json scripts section
