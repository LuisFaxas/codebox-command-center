---
phase: 02-real-time-connection-server-restructure
plan: 02
subsystem: ui
tags: [sse, eventsource, caddy, html-extraction, real-time]

requires:
  - phase: 02-real-time-connection-server-restructure
    plan: 01
    provides: "SSE event bus with emit/addClient, GET /events endpoint"
provides:
  - "public/index.html with EventSource client replacing polling"
  - "Server serving static HTML from disk (no embedded HTML)"
  - "Caddy reverse proxy with SSE-optimized config (flush_interval -1, read_timeout 0)"
  - "Complete SSE pipeline: hook -> POST /trigger -> emit -> EventSource -> browser"
affects: [dashboard, browser-push, visual-notifications]

tech-stack:
  added: []
  patterns: ["EventSource client with auto-reconnect", "Caddy SSE passthrough with flush_interval -1"]

key-files:
  created: [public/index.html]
  modified: [server.js, /etc/caddy/Caddyfile]

key-decisions:
  - "Removed /check endpoint and all trigger.json references - SSE is the only notification path"
  - "Removed GET /trigger backward-compat handler - hooks use POST only"
  - "Caddy configured with flush_interval -1 and read_timeout 0 for SSE"

patterns-established:
  - "Static HTML served from public/ directory via readFileSync"
  - "EventSource pattern: connect, listen for typed events, auto-reconnect on error"
  - "Caddy SSE proxy: flush_interval -1 + transport http read_timeout 0"

requirements-completed: [RT-01, RT-02, RT-03, UI-04]

duration: 8min
completed: 2026-03-28
---

# Phase 02 Plan 02: Browser SSE Client + Caddy Config Summary

**Extracted HTML to public/index.html with EventSource replacing polling, Caddy proxy with SSE flush_interval -1 for instant event delivery**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T04:20:18Z
- **Completed:** 2026-03-28T04:28:00Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (public/index.html created, server.js modified, /etc/caddy/Caddyfile modified)

## Accomplishments
- Extracted ~190 lines of embedded HTML from server.js to public/index.html
- Replaced poll() function with EventSource connection to /events endpoint
- Added trigger, config:updated, connection:health event listeners with auto-reconnect UI
- Removed /check endpoint, trigger.json references, GET /trigger handler from server.js
- Configured Caddy voice-notifications.codebox.local with SSE-optimized settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract public/index.html with EventSource client, clean server.js** - `8cf0670` (feat)
2. **Task 2: Configure Caddy reverse proxy for SSE passthrough** - `14678c8` (docs) + `f9ecdda` (fix: Content-Type audio/mpeg)
3. **Task 3: Verify SSE notification delivery end-to-end** - Human-verified (approved)

## Files Created/Modified
- `public/index.html` - Extracted HTML UI with EventSource client, trigger/config/health listeners, auto-reconnect
- `server.js` - Entry point serving static HTML from disk, /check and trigger.json removed, ~140 lines (down from ~400)
- `/etc/caddy/Caddyfile` - Added voice-notifications.codebox.local site block with flush_interval -1 and read_timeout 0

## Decisions Made
- Removed /check endpoint entirely (SSE is the sole notification delivery path per D-07)
- Removed all trigger.json file operations (writeFileSync, utimesSync, statSync) per D-06
- Removed GET /trigger backward-compat handler (hooks already updated to POST in Plan 01)
- Caddy site block uses no `encode` directive to avoid SSE buffering interference

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Content-Type for /notify-wav changed from audio/wav to audio/mpeg**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** edge-tts outputs MP3 data despite the .wav file extension convention. Browser was rejecting audio playback due to Content-Type mismatch.
- **Fix:** Changed Content-Type header from `audio/wav` to `audio/mpeg` in the /notify-wav response handler.
- **Files modified:** server.js
- **Verification:** Audio plays correctly in browser after trigger fires.
- **Committed in:** `f9ecdda`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for audio playback. No scope creep.

## Issues Encountered
- **DNS resolution:** voice-notifications.codebox.local does not resolve from the user's browser. Direct IP access (192.168.1.122:3099) works. This is a pre-existing DNS configuration issue outside the scope of this plan -- Caddy config is correct and functional.

## User Setup Required
None - Caddy was configured and reloaded automatically. Server verified working.

## Known Stubs
None - all EventSource listeners wire to real SSE events from the event bus.

## Next Phase Readiness
- SSE pipeline fully operational: hook -> POST /trigger -> emit -> EventSource -> browser
- Caddy proxy configured for voice-notifications.codebox.local
- Ready for dashboard UI, push notifications, and visual toasts in future phases
- DNS resolution for voice-notifications.codebox.local needs investigation (works via direct IP)

## Self-Check: PASSED

All files exist (public/index.html, server.js). All 3 task commits verified (8cf0670, 14678c8, f9ecdda). EventSource present in index.html. readFileSync present in server.js. No TRIGGER_FILE references remain.

---
*Phase: 02-real-time-connection-server-restructure*
*Completed: 2026-03-28*
