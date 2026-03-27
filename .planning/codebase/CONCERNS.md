# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Embedded HTML in server.js:**
- Issue: The entire web UI (~190 lines) is a template literal inside `server.js` (lines 114-304), making the server file monolithic (422 lines total) and hard to maintain
- Files: `server.js` (lines 114-304)
- Impact: UI changes require editing the server file, increasing risk of syntax errors; difficult to reason about server logic separately from presentation
- Fix approach: Extract HTML to `public/index.html`, serve statically with `fs.readFileSync()`, or use a simple templating approach for dynamic values (config, samples)

**Legacy `url.parse()` API:**
- Issue: Server uses deprecated `url.parse(req.url, true)` (line 307) which is no longer recommended
- Files: `server.js` (line 307)
- Impact: May be removed in future Node versions; API is less idiomatic than modern `new URL()`
- Fix approach: Replace `url.parse()` with `new URL(req.url, 'http://localhost')` and use `.pathname` / `.searchParams` instead

**No package.json or dependency tracking:**
- Issue: Project has no `package.json`, so edge-tts dependency is untracked and installed manually via `pip install --break-system-packages edge-tts`
- Files: Project root
- Impact: Hard to reproduce environment; unclear what versions are required; Python dependency in Node project is non-standard
- Fix approach: Create `package.json` with dev/optional dependencies, or document edge-tts installation requirement more clearly in README

**Polling-based notification delivery:**
- Issue: Browser polls `/check` endpoint every 1 second (line 298) with HTTP overhead
- Files: `server.js` (line 298), frontend JS (lines 280-298)
- Impact: Wasteful network traffic; unnecessary server load; 1s latency between trigger and notification play
- Fix approach: Implement Server-Sent Events (SSE) for server-push notifications or WebSocket for bidirectional communication

**Project name resolution duplicated:**
- Issue: Lenovo hook (`notify-trigger.js`) has sophisticated project name resolution, but CodeBox local hook (`notify-done.sh`) always sends empty project name
- Files: `hooks/notify-done.sh` (line 8), `hooks/notify-trigger.js` (lines 36-97)
- Impact: CodeBox notifications say "Done" without context; inconsistent behavior between machines
- Fix approach: Upgrade `notify-done.sh` to call `notify-trigger.js` with `VOICE_NOTIFY_URL=http://localhost:3099`, or port the resolution logic to a shared utility

## Known Bugs

**Cache key collision for projects with empty names:**
- Symptoms: When project name is empty or missing, cache key becomes `type--default.wav` (e.g., `done--default.wav`)
- Files: `server.js` (line 83, line 325, line 339)
- Trigger: Multiple notifications without project names all map to the same cache entry, so WAV is not regenerated
- Workaround: Clear cache manually (`rm data/cache/*.wav`) if needed, or ensure project name is always resolved

**Race condition in sample generation:**
- Symptoms: If `/generate` is called while a previous generation is still running, samples may be corrupted or incomplete
- Files: `server.js` (lines 53-76)
- Trigger: Call `/generate` twice in quick succession (e.g., user clicks button twice)
- Workaround: Button is disabled during generation, but network delays could allow multiple requests to queue

**Silent failures in edge-tts execution:**
- Symptoms: If edge-tts fails (network error, API change, timeout), no error is logged; browser gets 404 when requesting the WAV
- Files: `server.js` (lines 96-104, lines 337-352)
- Trigger: Edge-tts crashes, network is down, or Microsoft API changes
- Workaround: Check browser console for failed `/notify-wav` requests; manually verify edge-tts works with `echo "test" | edge-tts --write-media test.wav`

**Hardcoded server IP in remote hook:**
- Symptoms: If server IP changes or CodeBox is unreachable, remote hooks fail silently
- Files: `hooks/notify-trigger.js` (line 12)
- Trigger: IP address changes, or Tailscale/network connectivity drops
- Workaround: Set `VOICE_NOTIFY_URL` environment variable on Lenovo to point to correct server

## Security Considerations

**No authentication on notification endpoints:**
- Risk: Any machine on the network can hit `/trigger?type=done&project=Anything` and trigger notifications, or hit `/select` to change voice preferences
- Files: `server.js` (lines 399-412, lines 381-397)
- Current mitigation: System runs on private LAN/Tailscale network; server is not exposed to the internet
- Recommendations: If server is ever moved to public network, add authentication token validation (e.g., query param or Bearer token) to `/trigger`, `/select`, `/generate`

**No input validation on project name:**
- Risk: Project names are taken from query params and passed directly to shell commands via `safeName()` function
- Files: `server.js` (lines 78-80, lines 93-94, line 97)
- Current mitigation: `safeName()` replaces non-alphanumeric characters, limiting attack surface; edge-tts is called via `exec()` with proper quoting
- Recommendations: Be cautious if project names ever come from untrusted sources; consider using `execFile()` instead of `exec()` with array arguments to avoid shell injection entirely

**No validation on template content:**
- Risk: Template is stored in config.json and used directly in text-to-speech; XSS not possible (TTS, not HTML), but template could contain offensive content
- Files: `server.js` (lines 386-388)
- Current mitigation: Template is user-selected; no external sources
- Recommendations: None needed for current use case

## Performance Bottlenecks

**Blocking file I/O in request handlers:**
- Problem: All request handlers use synchronous `fs` calls (e.g., `fs.readFileSync`, `fs.writeFileSync`, `fs.readdirSync`), blocking the event loop
- Files: `server.js` (lines 314-324, lines 346-348, lines 358, lines 403-404, lines 42-50)
- Cause: Synchronous API is simpler but blocks other requests while I/O completes
- Improvement path: Use async `fs.promises` and `async/await` in request handlers; use `fs.createReadStream()` for serving large WAV files instead of `fs.readFileSync()`

**Full sample generation on every `/generate`:**
- Problem: Every time user clicks "GENERATE", all 7 voices are regenerated sequentially, taking ~10 seconds total with 15s timeout per voice
- Files: `server.js` (lines 64-75)
- Cause: Voices are generated with `exec()` callbacks, not parallelized; no caching of sample WAVs across generations
- Improvement path: Use `Promise.all()` to generate voices in parallel; consider caching samples by text hash so repeat text doesn't regenerate

**Unbounded request body in POST handlers:**
- Problem: POST handlers accumulate request data in memory without size limit (lines 367, 383): `req.on('data', c => body += c)`
- Files: `server.js` (lines 365-379, lines 381-397)
- Cause: Could theoretically OOM if a client sends a multi-MB POST body
- Improvement path: Add `Content-Length` header validation or use `body-parser`-like middleware to limit POST size

## Fragile Areas

**Sample file naming and parsing:**
- Files: `server.js` (lines 49, 220-223)
- Why fragile: Sample filenames are generated as `{shortName}--{voice}.wav` and parsed by splitting on `--`. If a voice name or short name changes, parsing breaks
- Safe modification: Treat filename format as an API contract; add tests for `getSamples()` and voice name parsing; consider using JSON metadata file instead
- Test coverage: No tests for sample name parsing logic

**WAV cache keying strategy:**
- Files: `server.js` (lines 82-84, lines 86-104)
- Why fragile: Cache key is deterministic but could collide (see "Cache key collision" bug above); project name must never be empty or special characters in `safeName()` must exactly match what the UI generates
- Safe modification: Audit how project names are resolved in both hooks; ensure both paths use identical sanitization; add integration tests
- Test coverage: No automated tests for cache key generation

**Signal handling in exec() calls:**
- Files: `server.js` (lines 67-75, lines 96-104)
- Why fragile: WAV generation via `exec()` has a 15s timeout, but if edge-tts process is killed (server restart, system reboot), callbacks may not fire and browser requests hang
- Safe modification: Add timeout tracking; ensure all requests resolve even if generation fails; use `execFile()` with array args instead of `exec()` with shell
- Test coverage: No tests for timeout behavior or process failure modes

## Scaling Limits

**Single-threaded server architecture:**
- Current capacity: Handles blocking file I/O for one request at a time; if a `/notify-wav` takes 5 seconds to generate, other requests are blocked
- Limit: ~1-2 concurrent notifications before latency becomes noticeable; polling overhead grows with number of browser tabs
- Scaling path: Move to async/await; use cluster module to spawn multiple workers; consider streaming responses instead of buffering WAV files in memory

**Cache directory unbounded growth:**
- Current capacity: No limit on cache/ or samples/ directories
- Limit: Disk fills up after thousands of notifications with unique project names
- Scaling path: Implement cache eviction policy (LRU, TTL); add `/cache/clear` endpoint or cron job; monitor disk usage

**Edge-tts API rate limits:**
- Current capacity: Microsoft Edge TTS API is free but rate-limited; no tracking of request count
- Limit: Unknown; likely triggered after high volume of generation requests
- Scaling path: Implement request queueing with backoff; cache aggressively; add metrics/monitoring for API errors

## Fragile Dependencies

**edge-tts version pinning:**
- Risk: Installed as `pip install edge-tts` without version constraint; known breaking changes between versions (e.g., v7.2.8 required)
- Impact: If system-wide `pip install edge-tts` gets a breaking version, all notifications fail
- Migration plan: Pin version in documentation (`pip install edge-tts==7.2.8`); add version check in server.js on startup; consider vendoring edge-tts or switching to a stable, versioned TTS library

**Microsoft Edge TTS API stability:**
- Risk: edge-tts is a reverse-engineered client for Microsoft's unofficial Edge TTS API; API could change or be blocked at any time
- Impact: All notifications fail if Microsoft changes the API
- Migration plan: Maintain fallback option (e.g., Google Cloud TTS, AWS Polly, or local piper TTS which is already partially set up); test against upstream edge-tts regularly

## Missing Critical Features

**No retry mechanism on TTS generation failure:**
- Problem: If edge-tts fails (timeout, network, API error), the notification is lost with no retry
- Blocks: Reliable notifications in flaky network conditions (e.g., Tailscale drops, internet hiccup)
- Fix: Add exponential backoff retry loop in `generateCached()`; store failed requests in a queue

**No graceful shutdown:**
- Problem: If server is killed (pm2 stop), in-flight requests are dropped
- Blocks: Can't drain pending notifications cleanly
- Fix: Catch SIGTERM/SIGINT, stop accepting new requests, wait for in-flight requests to complete, then exit

## Test Coverage Gaps

**No automated tests:**
- What's not tested: HTTP endpoints, configuration persistence, sample generation, project name resolution, cache logic
- Files: `server.js`, `hooks/notify-trigger.js`
- Risk: Regressions in core functionality (cache key generation, WAV serving, config save/load) go unnoticed
- Priority: High — suggest adding test suite with:
  - Unit tests for `safeName()`, `getCachePath()`, project name resolution
  - Integration tests for `/trigger`, `/select`, `/check` endpoints
  - End-to-end test for full notification flow (trigger → generate → play)

**No browser automation tests:**
- What's not tested: UI interaction (voice selection, template editing, playback), frontend-backend communication
- Files: `server.js` (HTML/JS section)
- Risk: UI bugs (e.g., voice not persisting after selection) only caught manually
- Priority: Medium — use Playwright or Puppeteer to test UI flow

---

*Concerns audit: 2026-03-26*
