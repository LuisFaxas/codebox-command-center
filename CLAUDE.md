<!-- GSD:project-start source:PROJECT.md -->
## Project

**Voice Notifications**

A polished, all-in-one web app for Claude Code voice and visual notifications with a live coding dashboard. Runs centrally on CodeBox and serves any connected machine (CodeBox, Lenovo, Mac) via a browser tab. When Claude finishes a response or asks a question, the user hears a spoken notification, sees a browser push notification, and gets a visual toast — all identifying which project triggered it. The dashboard shows real-time status of all active Claude Code sessions across machines.

**Core Value:** Reliable, immediate awareness of Claude Code activity across all machines and projects — the user never misses a "done" or "question" event, even when running 5+ concurrent sessions.

### Constraints

- **Server**: Node.js on CodeBox, no external dependencies beyond edge-tts (Python) — keep it lean
- **Clients**: Browser-only, must work on Chrome/Edge on any OS
- **Network**: Tailscale for remote access, LAN for local — server must be reachable both ways
- **TTS**: edge-tts (Microsoft Edge neural voices) — no paid API keys
- **Stack**: pnpm for package management if dependencies added
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (Node.js) - Server and CLI hooks
- Bash - Local notification hook script
## Runtime
- Node.js (v24 per workspace standard via nvm)
- None (no package.json) - Project uses system dependencies only
- Not applicable
## Frameworks
- Node.js built-in `http` module - HTTP server for browser UI and API endpoints
- Vanilla JavaScript (embedded in HTML) - Browser-based voice picker and notification listener
- edge-tts (Python) - Microsoft Edge neural text-to-speech, invoked via CLI
## Key Dependencies
- edge-tts - Text-to-speech synthesis using Microsoft neural voices. Required on server system. Installed via `pip install edge-tts`.
- No npm packages - All logic uses Node.js built-ins (`http`, `fs`, `path`, `url`, `child_process`)
## Configuration
- `PORT` - Server port (default: 3099)
- `DATA_DIR` - Directory for config, cache, samples (default: `./data` relative to `server.js`)
- `VOICE_NOTIFY_URL` - Server URL for remote hooks (default: `http://100.123.116.23:3099`)
- `CLAUDE_PROJECT_DIR` - Project directory path for local hook context (set by Claude Code)
- `VOICE_NOTIFY_DATA` - Optional override for local hook data directory
- `data/config.json` - Persisted voice and template settings per notification type (created at runtime)
- `data/trigger.json` - Notification trigger file, modified via mtime for polling (created at runtime)
- `data/samples/` - Generated WAV files for voice preview (created at runtime)
- `data/cache/` - Cached notification audio files (created at runtime)
- `hooks/.name-cache.json` - Project name resolution cache (created at runtime)
## Build/Dev
- No build step required - Direct Node.js execution
# or
## Platform Requirements
- Node.js v24
- Python 3.x with edge-tts installed (`pip install edge-tts`)
- Bash shell (for local hook)
- Linux server (CodeBox - Ubuntu 24.04)
- Python 3.x with edge-tts
- Port 3099 available (or custom via PORT env var)
- 100+ MB disk space in `DATA_DIR` for audio cache
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Kebab-case for script filenames: `notify-trigger.js`, `notify-done.sh`
- No file extensions used for configuration data, only `.json`, `.sh`, `.js` for code
- Descriptive names that indicate purpose: `notify-trigger.js` (trigger notifications), `notify-done.sh` (local hook for completion)
- camelCase for all function names
- Descriptive names that indicate action: `generateSamples()`, `generateCached()`, `resolveProjectName()`, `cleanFolderName()`
- Verb-first naming convention: `getSamples()`, `saveConfig()`, `selectVoice()`, `playVoice()`, `loadConfig()`
- camelCase for variable names: `lastTrigger`, `nameCache`, `currentTab`, `serverConfig`
- UPPER_SNAKE_CASE for constants: `PORT`, `DATA_DIR`, `TRIGGER_FILE`, `SAMPLES_DIR`, `CACHE_DIR`, `CONFIG_FILE`, `VOICES`, `SERVER_URL`, `CACHE_FILE`
- Short names for loop/temporary variables: `i`, `f`, `e` for error objects, `cb` for callbacks
- No TypeScript used; plain JavaScript only
- Plain objects used for configuration: `config = { done: {...}, question: {...} }`
- Object property names use camelCase: `voice`, `template`, `project`, `type`, `shortName`, `fullVoice`
## Code Style
- No linting tool configured (no `.eslintrc`, `.prettierrc` detected)
- Consistent 2-space indentation throughout codebase
- No trailing semicolons enforced (both with and without present in code)
- Inline styles used extensively in HTML (embedded in `server.js`): `style="property:value;property:value"`
- Not applicable — no linting configuration present
## Import Organization
- Standard library imports grouped first:
- Only destructured imports when needed: `const { exec } = require('child_process')`
- All requires at top of file, before any code execution
- No aliases used; relative and absolute paths only
- Environment variables for paths: `DATA_DIR`, `SAMPLES_DIR`, `CACHE_DIR`
- `path.join()` used consistently for cross-platform compatibility
## Error Handling
- Try-catch blocks for file operations: `try { ... } catch(e) { }`
- Silent error swallowing common for non-critical operations (silently catch and return empty array/default value):
- Callback-based error passing for async operations:
- Boolean flags to indicate success/failure: `notify`, `wav`, `ok` properties in JSON responses
- Error messages passed as `error` property in JSON responses: `{ ok: false, error: e.message }`
## Logging
- Single `console.log()` on server startup:
- No other logging present; errors are silently caught and handled
- No debug logs or structured logging
## Comments
- Comments used sparingly, primarily for:
- Not used; no TypeScript present
## Function Design
- Functions kept relatively compact (5-25 lines typical)
- Longest functions are in request handlers and initialization (~20-30 lines)
- Prefer positional parameters over objects for simple functions
- Callback pattern: final parameter is callback function: `generateSamples(text, cb)`, `generateCached(type, project, cb)`
- Query parameters extracted from URL and passed individually: `const type = parsed.query.type || 'done'`
- Synchronous functions return values directly: `return fs.readdirSync(...)`
- Async operations use callbacks (Node.js pre-Promise style): `cb(null, result)` or `cb(err)`
- Callback functions follow Node.js convention: `(err, result) => {}`
## Module Design
- No module exports; all files are either executable scripts or server entry point
- `server.js` is main entry point, creates HTTP server but doesn't export
- `notify-trigger.js` is executable script with `#!/usr/bin/env node` shebang
- `notify-done.sh` is bash script
- Not applicable; no index files or barrel exports used
## Request/Response Patterns
- Query parameters for GET requests: `/trigger?type=done&project=MyProject`
- JSON body for POST requests using manual parsing: `req.on('data', c => body += c)`
- Consistent JSON response format: `{ ok: true, ... }` or `{ ok: false, error: ... }`
- Content-Type headers set explicitly for all responses: `application/json`, `audio/wav`, `text/html`
- Async/await used for fetch API calls in browser JavaScript
- Minimal error handling (errors swallowed with try-catch in poll loop)
- Query string params used for cache-busting: `?t=' + Date.now()`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Centralized HTTP server (server.js) running on CodeBox
- Distributed hook triggers via HTTP GET from remote machines or local bash script
- Polling-based browser client (1s interval) watching server state
- Asynchronous TTS generation via Python edge-tts subprocess
- File-based trigger signaling (trigger.json modification time)
## Layers
- Purpose: Handles all incoming requests, manages state, orchestrates TTS generation
- Location: `server.js`
- Contains: Route handlers for /trigger, /check, /notify-wav, /config, /select, /generate, /samples, /wav/, and HTML UI
- Depends on: Node.js built-ins (http, fs, path, child_process, url), Python edge-tts CLI
- Used by: Browser clients, remote/local hooks
- Purpose: Connect Claude Code lifecycle events to the notification system
- Location: `hooks/` directory
- Contains: notify-trigger.js (remote HTTP hook), notify-done.sh (local file-based hook)
- Depends on: CLAUDE_PROJECT_DIR env var, file system, HTTP client
- Used by: Claude Code settings.json (Stop and PostToolUse events)
- Purpose: Voice selection and audition interface, notification playback
- Location: Embedded in server.js (lines 114-303) as HTML/JavaScript template literal
- Contains: Voice selector buttons, template editor, audio playback controls, polling loop
- Depends on: Fetch API, Web Audio API
- Used by: Human operators for voice configuration
- Purpose: Store configuration, cache generated WAVs, signal trigger events
- Location: `data/` directory (runtime, gitignored)
- Contains: trigger.json (transient state), config.json (voice+template prefs), cache/ (persistent WAVs), samples/ (temporary audition WAVs)
- Depends on: File system write access
- Used by: Server for state management and playback
- Purpose: Convert text to speech using Microsoft Edge neural voices
- Location: External Python subprocess (edge-tts CLI)
- Contains: Voice selection, rate/pitch adjustment, WAV generation
- Depends on: edge-tts Python package (v7.2.8+), network access to Microsoft API
- Used by: Server's exec() calls in generateSamples() and generateCached()
## Data Flow
- **Trigger state:** Transient, signaled via file mtime (trigger.json)
- **Configuration:** Persisted to disk (config.json), read at server startup and on /select
- **Cached WAVs:** Persistent in cache/ directory, keyed as `[type]--[sanitized_project].wav`
- **Sample WAVs:** Ephemeral in samples/ directory, regenerated on each audition session
- **Poll loop state:** Client-side only (currentTab, serverConfig), not persisted
## Key Abstractions
- Purpose: Signal a notification event without network latency
- Examples: trigger.json file modification time is the signal
- Pattern: Server polls file mtime, browser polls server's /check endpoint (indirect file watch)
- Purpose: Store and apply user preferences without UI state per client
- Examples: `config.json` contains `{"done": {...}, "question": {...}}`
- Pattern: Preferences applied at WAV generation time via config[type]
- Purpose: Extract human-readable project names from various source files
- Examples: notify-trigger.js implements priority chain and caching
- Pattern: Fallback chain with mtime-based cache validation
- Purpose: Map (type, project) pairs to filesystem locations without collisions
- Examples: `getCachePath(type, project)` produces `type--[safeName(project)].wav`
- Pattern: Sanitize project name (alphanumeric + underscore/hyphen, max 80 chars), prefix with type
## Entry Points
- Location: `server.js:420`
- Triggers: `node server.js` or PM2 start
- Responsibilities: Create data directories, load config.json, bind HTTP listener on PORT, log ready message
- Location: `server.js:399-412`
- Triggers: HTTP GET /trigger?type=X&project=Y from hooks
- Responsibilities: Write trigger.json with type/project, update file mtime, start background WAV generation
- Location: `server.js:309-327`
- Triggers: Browser polls every 1 second
- Responsibilities: Detect trigger.json mtime change, return {notify, wav, type, project}
- Location: `server.js:414-416` (default route)
- Triggers: GET / from browser
- Responsibilities: Serve embedded HTML UI with client-side JavaScript
- Location: `hooks/notify-done.sh`
- Triggers: Claude Code Stop event on CodeBox
- Responsibilities: Write trigger.json with empty project name to data directory
- Location: `hooks/notify-trigger.js`
- Triggers: Claude Code Stop/PostToolUse events on remote machines
- Responsibilities: Resolve project name, hit server's /trigger endpoint via HTTP
## Error Handling
- **TTS Generation Failure:** If edge-tts subprocess errors, callback receives err but /notify-wav returns 404; user can retry by triggering again or manually select voice (will regenerate)
- **File I/O:** Try/catch blocks wrap JSON.parse and fs operations; missing files return empty objects or default values
- **HTTP Parsing:** Malformed POST body → 400 response with JSON error message
- **Cache Miss:** If cached WAV doesn't exist when requested, generateCached() spawns new edge-tts process; browser may briefly get 404 then succeed on retry
- **Project Name Resolution:** Falls back to folder basename if all source files missing
## Cross-Cutting Concerns
- Console.log only at server startup
- No structured logging; errors silently caught in try/catch blocks
- Browser console logs only on JavaScript errors
- Project names sanitized via safeName() (alphanumeric + underscore/hyphen, max 80 chars)
- Template text validated by edge-tts (invalid quotes escaped with `'\\''`)
- Voice names validated against hardcoded VOICES array in server.js
- None — server is local-network only or Tailscale-based, assumes trusted network
- No CORS headers; browser must be on same network as server
- Multiple edge-tts processes run in parallel (generateSamples spawns 7 at once)
- Race condition possible if two hooks trigger same (type, project) simultaneously; second one waits for first's generateCached to complete
- File mtime-based signaling is atomic at OS level (ext4 fsync)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
