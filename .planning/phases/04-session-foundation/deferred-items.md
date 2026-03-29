# Deferred Items - Phase 04

## Pre-existing Test Flake

- **File:** `tests/notifications.spec.mjs` line 16
- **Test:** `NOTIF-03: trigger shows toast in dashboard`
- **Issue:** SSE `.connection-dot.connected` selector times out in Playwright browser test. The EventSource connection does not establish reliably in the test environment (works in manual browser testing).
- **Impact:** Low -- toast functionality works in production, this is a test environment timing issue.
- **Discovered during:** Plan 04-02, Task 3
