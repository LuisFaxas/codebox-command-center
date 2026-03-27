# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Server-client polling model with file-based state synchronization

**Key Characteristics:**
- Centralized HTTP server (server.js) running on CodeBox
- Distributed hook triggers via HTTP GET from remote machines or local bash script
- Polling-based browser client (1s interval) watching server state
- Asynchronous TTS generation via Python edge-tts subprocess
- File-based trigger signaling (trigger.json modification time)

## Layers

**HTTP Server Layer:**
- Purpose: Handles all incoming requests, manages state, orchestrates TTS generation
- Location: `server.js`
- Contains: Route handlers for /trigger, /check, /notify-wav, /config, /select, /generate, /samples, /wav/, and HTML UI
- Depends on: Node.js built-ins (http, fs, path, child_process, url), Python edge-tts CLI
- Used by: Browser clients, remote/local hooks

**Trigger Hooks Layer:**
- Purpose: Connect Claude Code lifecycle events to the notification system
- Location: `hooks/` directory
- Contains: notify-trigger.js (remote HTTP hook), notify-done.sh (local file-based hook)
- Depends on: CLAUDE_PROJECT_DIR env var, file system, HTTP client
- Used by: Claude Code settings.json (Stop and PostToolUse events)

**Browser UI Layer:**
- Purpose: Voice selection and audition interface, notification playback
- Location: Embedded in server.js (lines 114-303) as HTML/JavaScript template literal
- Contains: Voice selector buttons, template editor, audio playback controls, polling loop
- Depends on: Fetch API, Web Audio API
- Used by: Human operators for voice configuration

**Data Persistence Layer:**
- Purpose: Store configuration, cache generated WAVs, signal trigger events
- Location: `data/` directory (runtime, gitignored)
- Contains: trigger.json (transient state), config.json (voice+template prefs), cache/ (persistent WAVs), samples/ (temporary audition WAVs)
- Depends on: File system write access
- Used by: Server for state management and playback

**TTS Engine Layer:**
- Purpose: Convert text to speech using Microsoft Edge neural voices
- Location: External Python subprocess (edge-tts CLI)
- Contains: Voice selection, rate/pitch adjustment, WAV generation
- Depends on: edge-tts Python package (v7.2.8+), network access to Microsoft API
- Used by: Server's exec() calls in generateSamples() and generateCached()

## Data Flow

**Notification Trigger Flow:**

1. Claude Code Stop event fires (or AskUserQuestion detected)
2. Hook script runs:
   - **Local (CodeBox):** notify-done.sh writes `{"type":"done","project":""}` to trigger.json
   - **Remote (Lenovo):** notify-trigger.js resolves project name, hits `/trigger?type=done&project=Name`
3. Server receives /trigger request, writes trigger.json with current mtime
4. Server calls generateCached() to pre-generate WAV (background, non-blocking)
5. Browser's poll loop detects trigger.json mtime change via /check response
6. Browser plays audio via Web Audio API using /notify-wav endpoint
7. Server fetches cached WAV from disk or waits for edge-tts generation

**Voice Configuration Flow:**

1. User opens http://[server]:3099 in browser
2. User clicks tab (done/question) and enters preview text
3. User clicks GENERATE → POST /generate with text
4. Server calls generateSamples() to create all 7 voice samples (parallel edge-tts calls)
5. Samples stored in samples/ directory
6. Browser loads sample list via /samples GET, displays voice buttons
7. User clicks Play → browser fetches /wav/[filename] and plays
8. User clicks USE THIS → POST /select with voice, template, type
9. Server updates config.json, clears old cache entries, returns success
10. Server's next notification uses new voice+template preference

**Project Name Resolution (Remote Hook):**

1. notify-trigger.js reads CLAUDE_PROJECT_DIR (env) or current working directory
2. Checks .name-cache.json for cached result with mtime validation
3. If cache miss, tries in order:
   - Read .claude/project-display-name file
   - Parse CLAUDE.md for `## Project` bold title or `**Project:**` pattern
   - Read package.json productName or name field
   - Clean folder basename (camelCase split, title case, max 30 chars)
4. Caches result in .name-cache.json
5. Sends project name to server's /trigger endpoint

**State Management:**

- **Trigger state:** Transient, signaled via file mtime (trigger.json)
- **Configuration:** Persisted to disk (config.json), read at server startup and on /select
- **Cached WAVs:** Persistent in cache/ directory, keyed as `[type]--[sanitized_project].wav`
- **Sample WAVs:** Ephemeral in samples/ directory, regenerated on each audition session
- **Poll loop state:** Client-side only (currentTab, serverConfig), not persisted

## Key Abstractions

**Trigger Mechanism:**
- Purpose: Signal a notification event without network latency
- Examples: trigger.json file modification time is the signal
- Pattern: Server polls file mtime, browser polls server's /check endpoint (indirect file watch)

**Voice Configuration:**
- Purpose: Store and apply user preferences without UI state per client
- Examples: `config.json` contains `{"done": {...}, "question": {...}}`
- Pattern: Preferences applied at WAV generation time via config[type]

**Project Name Resolution:**
- Purpose: Extract human-readable project names from various source files
- Examples: notify-trigger.js implements priority chain and caching
- Pattern: Fallback chain with mtime-based cache validation

**Cache Key Generation:**
- Purpose: Map (type, project) pairs to filesystem locations without collisions
- Examples: `getCachePath(type, project)` produces `type--[safeName(project)].wav`
- Pattern: Sanitize project name (alphanumeric + underscore/hyphen, max 80 chars), prefix with type

## Entry Points

**Server Startup:**
- Location: `server.js:420`
- Triggers: `node server.js` or PM2 start
- Responsibilities: Create data directories, load config.json, bind HTTP listener on PORT, log ready message

**Trigger Endpoint:**
- Location: `server.js:399-412`
- Triggers: HTTP GET /trigger?type=X&project=Y from hooks
- Responsibilities: Write trigger.json with type/project, update file mtime, start background WAV generation

**Check Endpoint:**
- Location: `server.js:309-327`
- Triggers: Browser polls every 1 second
- Responsibilities: Detect trigger.json mtime change, return {notify, wav, type, project}

**HTML/UI Root:**
- Location: `server.js:414-416` (default route)
- Triggers: GET / from browser
- Responsibilities: Serve embedded HTML UI with client-side JavaScript

**Local Hook:**
- Location: `hooks/notify-done.sh`
- Triggers: Claude Code Stop event on CodeBox
- Responsibilities: Write trigger.json with empty project name to data directory

**Remote Hook:**
- Location: `hooks/notify-trigger.js`
- Triggers: Claude Code Stop/PostToolUse events on remote machines
- Responsibilities: Resolve project name, hit server's /trigger endpoint via HTTP

## Error Handling

**Strategy:** Graceful degradation with fallback defaults

**Patterns:**

- **TTS Generation Failure:** If edge-tts subprocess errors, callback receives err but /notify-wav returns 404; user can retry by triggering again or manually select voice (will regenerate)
- **File I/O:** Try/catch blocks wrap JSON.parse and fs operations; missing files return empty objects or default values
- **HTTP Parsing:** Malformed POST body → 400 response with JSON error message
- **Cache Miss:** If cached WAV doesn't exist when requested, generateCached() spawns new edge-tts process; browser may briefly get 404 then succeed on retry
- **Project Name Resolution:** Falls back to folder basename if all source files missing

## Cross-Cutting Concerns

**Logging:**
- Console.log only at server startup
- No structured logging; errors silently caught in try/catch blocks
- Browser console logs only on JavaScript errors

**Validation:**
- Project names sanitized via safeName() (alphanumeric + underscore/hyphen, max 80 chars)
- Template text validated by edge-tts (invalid quotes escaped with `'\\''`)
- Voice names validated against hardcoded VOICES array in server.js

**Authentication:**
- None — server is local-network only or Tailscale-based, assumes trusted network
- No CORS headers; browser must be on same network as server

**Concurrency:**
- Multiple edge-tts processes run in parallel (generateSamples spawns 7 at once)
- Race condition possible if two hooks trigger same (type, project) simultaneously; second one waits for first's generateCached to complete
- File mtime-based signaling is atomic at OS level (ext4 fsync)

---

*Architecture analysis: 2026-03-26*
