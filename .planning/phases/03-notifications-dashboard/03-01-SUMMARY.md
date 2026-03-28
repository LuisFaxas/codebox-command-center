---
phase: 03-notifications-dashboard
plan: 01
subsystem: api
tags: [web-push, vapid, service-worker, tts, edge-tts, push-notifications]

requires:
  - phase: 02-server-refactor
    provides: SSE event bus, modular server, config.js, tts.js
provides:
  - push.js module with VAPID key persistence and subscription management
  - Service worker for push notification reception
  - Config schema with rate/pitch per notification type
  - Server routes for /subscribe, /vapid-public-key, /sw.js
  - TTS generation using per-type rate/pitch from config
affects: [03-02, 03-03, 03-04]

tech-stack:
  added: [web-push@3.6.7]
  patterns: [fire-and-forget push after SSE emit, config schema migration via spread defaults]

key-files:
  created: [push.js, public/sw.js]
  modified: [config.js, tts.js, server.js, package.json]

key-decisions:
  - "VAPID keys persisted to data/vapid.json, generated on first startup"
  - "Push delivery is fire-and-forget after SSE emit to avoid blocking trigger response"
  - "Config migration uses spread defaults to auto-add rate/pitch to existing configs"

patterns-established:
  - "Fire-and-forget push: pushToAll().catch(() => {}) after emit()"
  - "Config migration: { ...defaults[type], ...config[type] } on load"
  - "Service worker served from /sw.js route with Service-Worker-Allowed header"

requirements-completed: [PUSH-03, PUSH-04, VOICE-03, VOICE-05, TMPL-04]

duration: 2min
completed: 2026-03-28
---

# Phase 3 Plan 1: Server-Side Push Infrastructure Summary

**Web-push module with VAPID persistence, service worker for push reception, and per-type rate/pitch in TTS generation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T17:43:31Z
- **Completed:** 2026-03-28T17:45:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Web-push installed and push.js module created with VAPID key generation, persistence, subscription management, and push delivery
- Config.js extended with rate and pitch fields per notification type with automatic migration for existing configs
- TTS generation (both samples and cached) now uses per-type rate/pitch from config instead of hardcoded values
- Service worker created for background push notification reception with notification click handling
- Server wired with /vapid-public-key, /subscribe, and /sw.js routes plus fire-and-forget push in trigger handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Install web-push, create push.js module, extend config.js with rate/pitch** - `d6b52cc` (feat)
2. **Task 2: Update tts.js for rate/pitch, create sw.js, wire server.js with push routes** - `5d86514` (feat)

## Files Created/Modified
- `push.js` - Push notification module with VAPID key persistence and subscription management
- `public/sw.js` - Service worker for push notification reception and notification click handling
- `config.js` - Extended defaults with rate/pitch, migration support, update() accepts rate/pitch params
- `tts.js` - generateSamples/generateCached use config rate/pitch instead of hardcoded values
- `server.js` - Push import, loadPush(), /sw.js /vapid-public-key /subscribe routes, pushToAll in trigger
- `package.json` - Added web-push@3.6.7 dependency

## Decisions Made
- VAPID keys persisted to data/vapid.json, generated on first startup only
- Push delivery is fire-and-forget (.catch(() => {})) to avoid blocking trigger response path
- Config migration via spread defaults ensures old config files gain rate/pitch fields on load
- Service worker served with Service-Worker-Allowed: / header for root scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All server-side push infrastructure ready for dashboard UI to wire up notification channels
- Push subscription flow can be triggered from client once dashboard UI is built (plan 03-02)
- Rate/pitch config fields available for voice configuration panel in dashboard

---
*Phase: 03-notifications-dashboard*
*Completed: 2026-03-28*
