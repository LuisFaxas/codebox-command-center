---
phase: 02-real-time-connection-server-restructure
plan: 01
subsystem: server
tags: [sse, es-modules, event-bus, node-http, edge-tts]

requires:
  - phase: 01-hook-reliability-notification-correctness
    provides: "Working hook system with debounce and project name resolution"
provides:
  - "ES module server architecture (config.js, tts.js, sse.js, server.js)"
  - "SSE event bus with replay buffer and keepalive"
  - "GET /events endpoint for real-time event streaming"
  - "emit('trigger', ...) replacing file-based signaling"
affects: [02-02-PLAN, browser-client, dashboard]

tech-stack:
  added: []
  patterns: ["ES module imports with import.meta.dirname", "SSE event bus with circular replay buffer", "Module extraction pattern (config/tts/sse)"]

key-files:
  created: [package.json, config.js, tts.js, sse.js, hooks/notify-trigger.cjs]
  modified: [server.js]

key-decisions:
  - "Kept trigger.json writes temporarily for backward compat with embedded HTML poll loop"
  - "SSE replay buffer size set to 100 events"
  - "15-second keepalive interval for Caddy proxy compatibility"
  - "Hook renamed to .cjs instead of creating separate package.json in hooks/"

patterns-established:
  - "ES module pattern: import.meta.dirname replaces __dirname"
  - "SSE event format: id + event type + JSON data + double newline"
  - "Module boundary: config.js owns state, tts.js owns generation, sse.js owns connections"

requirements-completed: [RT-01, RT-02, RT-03, RT-04]

duration: 12min
completed: 2026-03-28
---

# Phase 02 Plan 01: SSE Event Bus + Server Restructure Summary

**ES module server split into config/tts/sse modules with SSE event bus replacing file-based trigger signaling**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-28T04:02:34Z
- **Completed:** 2026-03-28T04:14:46Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Split 484-line monolithic server.js into focused ES modules (config.js, tts.js, sse.js)
- Implemented SSE event bus with 100-event circular replay buffer and Last-Event-ID reconnection
- Added GET /events endpoint serving text/event-stream with 15s keepalive
- POST /trigger now emits to SSE bus; trigger.json kept temporarily for backward compat
- Renamed hook to .cjs and updated all settings.json references

## Task Commits

Each task was committed atomically:

1. **Task 1: Create package.json, config.js, and tts.js modules** - `38dbafd` (feat)
2. **Task 2: Create sse.js event bus with replay buffer and keepalive** - `be5d91f` (feat)
3. **Task 3: Rewrite server.js as entry+routing, rename hook to .cjs, update settings.json** - `bec782d` (feat)

## Files Created/Modified
- `package.json` - ES module configuration with type:module
- `config.js` - Settings persistence: load/save/get/update/getVoices with DATA_DIR exports
- `tts.js` - TTS generation: generateSamples/generateCached/clearCache wrapping edge-tts
- `sse.js` - Event bus: emit/addClient/getClientCount with replay buffer and keepalive
- `server.js` - Entry point with routing, imports from all modules, new URL() parsing
- `hooks/notify-trigger.cjs` - Renamed from .js for CommonJS compat under type:module

## Decisions Made
- Kept trigger.json writes temporarily alongside SSE emit for backward compat with embedded HTML poll loop (Plan 02 removes both)
- Set replay buffer to 100 events (sufficient for reconnection gaps)
- Used 15-second keepalive interval matching Caddy's default proxy timeout
- Renamed hook to .cjs rather than adding a separate package.json in hooks/ (simpler, less files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept trigger.json writes for backward compatibility**
- **Found during:** Task 3 (server.js rewrite)
- **Issue:** Plan says "Do NOT write trigger.json" but the embedded HTML still uses /check which reads trigger.json via file mtime. Removing writes would break notifications until Plan 02 replaces the client.
- **Fix:** Added trigger.json writes alongside SSE emit in both POST and GET /trigger handlers, clearly marked as temporary
- **Files modified:** server.js
- **Verification:** Server starts, /check still works, /trigger emits to SSE bus AND writes trigger.json
- **Committed in:** bec782d (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for system continuity. The SSE bus is fully operational; trigger.json writes are additive backward compat that Plan 02 removes.

## Issues Encountered
- Git worktree required cherry-picking commits from main repo due to Write tool path resolution. Resolved by copying files to worktree and committing locally.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all modules are fully functional with real data sources wired.

## Next Phase Readiness
- SSE event bus operational, ready for Plan 02 to connect browser EventSource client
- GET /events endpoint available for browser connection
- /check endpoint kept temporarily; Plan 02 removes it when HTML is extracted with EventSource
- All existing endpoints (/config, /samples, /generate, /select, /notify-wav, /wav/*) verified working

## Self-Check: PASSED

All 6 created files exist. All 3 task commits verified. Hook .js file confirmed deleted. Settings.json confirmed updated.

---
*Phase: 02-real-time-connection-server-restructure*
*Completed: 2026-03-28*
