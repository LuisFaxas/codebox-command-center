# Phase 2: Real-Time Connection + Server Restructure - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 1-second polling loop with Server-Sent Events (SSE) for instant notification delivery, restructure server.js into focused ES modules, and configure Caddy for reliable SSE passthrough. No UI redesign, no new notification types, no multi-machine session tracking beyond heartbeats.

</domain>

<decisions>
## Implementation Decisions

### SSE Event Design
- **D-01:** Single `/events` SSE endpoint carries all event types, differentiated by the SSE `event:` field. One connection per browser tab, one reconnect to manage.
- **D-02:** Full event bus from day one — not just triggers. Four event types supported at launch:
  - `trigger` — notification fired (done/question) with project, session, machine, timestamp data
  - `session:alive` — periodic heartbeat from active Claude Code sessions
  - `config:updated` — voice/template settings changed, so other browser tabs can sync
  - `connection:health` — server-sent keepalive pings for Caddy timeout prevention and client reconnect detection
- **D-03:** Events carry sequential IDs. Clients use `Last-Event-ID` on reconnect to replay missed events from an in-memory circular buffer. This is the SSE spec's native solution for missed-event recovery.

### Server File Structure
- **D-04:** Full module split. server.js becomes entry + routing only. New modules:
  - `sse.js` — event bus, client management, replay buffer
  - `tts.js` — edge-tts wrapper (generateSamples, generateCached)
  - `config.js` — settings persistence (load, save, voice/template prefs)
  - `public/index.html` — extracted HTML UI (no longer embedded as template literal)
- **D-05:** Switch from CommonJS (require) to ES modules (import/export). Add `package.json` with `"type": "module"`. Clean break from legacy style.

### Trigger.json Fate
- **D-06:** Remove trigger.json entirely. SSE event bus with Last-Event-ID replay buffer replaces file-based signaling. No file I/O per trigger event.
- **D-07:** Remove the `/check` polling endpoint. SSE is the only notification delivery path. Clients that reconnect get missed events via replay.

### Caddy SSE Configuration
- **D-08:** Dual protection: server sends SSE `:keepalive` comments every 15 seconds, Caddy configured with `flush_interval -1` (immediate flush, no buffering) and extended `read_timeout`.
- **D-09:** Caddy config update is part of this phase's plan — executor handles it, not a manual step.

### Claude's Discretion
- Replay buffer size (reasonable default like 100 events is fine)
- How session:alive heartbeats are collected (hooks pinging periodically, or server tracking last-seen from trigger events)
- Internal module boundaries — exact function signatures and export shapes
- How to handle the ES module migration for the hook script (notify-trigger.js) — it's consumed by Claude Code hooks so must remain executable
- Whether to add a package.json `scripts` section for `start`/`dev` commands

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `.planning/codebase/ARCHITECTURE.md` — Current system architecture, data flow, and entry points
- `.planning/codebase/CONCERNS.md` — Known bugs, tech debt, and fragile areas (polling concern, embedded HTML concern directly relevant)
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, function design conventions

### Existing Server Code
- `server.js` — Current monolithic server (484 lines), HTML embedded lines 114-303, /check polling endpoint, /trigger handler
- `hooks/notify-trigger.js` — Hook script that POSTs to /trigger (must remain working after restructure)

### Phase 1 Decisions
- `.planning/phases/01-hook-reliability-project-identity/01-CONTEXT.md` — D-08 (HTTP POST contract), D-10/D-11 (debounce logic to preserve)

### Infrastructure
- Caddy config for voice-notifications site (location TBD — researcher should identify the Caddyfile path)

### Requirements
- `.planning/REQUIREMENTS.md` — RT-01 through RT-04, UI-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server.js` debounceMap + isDuplicate() — debounce logic to preserve in restructured server
- `server.js` generateSamples() + generateCached() — TTS functions to extract into tts.js
- `server.js` config load/save pattern — extract into config.js
- `hooks/notify-trigger.js` — POST /trigger contract must be preserved (hook sends JSON body)

### Established Patterns
- Node.js built-in `http` module for server (no framework)
- `child_process.exec()` for edge-tts subprocess invocation
- `fs.readFileSync` / `fs.writeFileSync` for config persistence
- Callback-based async for TTS generation

### Integration Points
- `/trigger` endpoint — hooks POST here; handler must stay compatible
- `/events` — new SSE endpoint (replaces /check polling)
- `public/index.html` — new static file (replaces embedded HTML)
- Caddy reverse proxy — needs SSE-compatible config
- PM2 process — restart after restructure

</code_context>

<specifics>
## Specific Ideas

- User wants "the absolute industry leading solution" for event delivery — Last-Event-ID replay buffer, not just basic SSE
- Full event bus built now so Phase 3 dashboard just consumes existing event types
- ES module migration is a deliberate modernization choice, not just convenience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-real-time-connection-server-restructure*
*Context gathered: 2026-03-27*
