# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**Text-to-Speech:**
- Microsoft Edge neural TTS (via edge-tts Python package)
  - What it's used for: Synthesis of spoken notifications using 7 male English neural voices
  - Integration: Local subprocess execution via `child_process.exec()`
  - Voices: `en-US-GuyNeural`, `en-US-EricNeural`, `en-US-ChristopherNeural`, `en-US-RogerNeural`, `en-US-SteffanNeural`, `en-US-AndrewNeural`, `en-US-BrianNeural`
  - CLI command: `edge-tts --voice "[voice]" --rate="-5%" --pitch="-10Hz" --text "[text]" --write-media "[output.wav]"`
  - Timeout: 15 seconds per generation

**Claude Code Hook System:**
- Integration point for Claude Code IDE on local and remote machines
  - How called: Via Claude Code's hook system (settings.json configuration)
  - Hook types: `Stop` (on completion), `PostToolUse` with `AskUserQuestion` matcher (on question)

## Data Storage

**Databases:**
- None - Project uses filesystem-based state

**File Storage:**
- Local filesystem only
  - Config: `data/config.json` - Voice and template per notification type
  - Trigger: `data/trigger.json` - Notification trigger signals
  - Samples: `data/samples/` - Generated WAV files for voice preview UI
  - Cache: `data/cache/` - Pre-generated notification audio cache

**Caching:**
- File-based mtime polling for notification detection
  - Mechanism: Browser polls `/check` endpoint, server checks `trigger.json` mtime against last polled time
  - Audio caching: WAV files cached per notification type + project name combination
  - Project name cache: `.name-cache.json` in hooks directory with mtime-based invalidation

## Authentication & Identity

**Auth Provider:**
- None - No authentication required

**Project Identity Resolution:**
- Multi-fallback approach in `hooks/notify-trigger.js`:
  1. `.claude/project-display-name` file override
  2. CLAUDE.md parsing for `## Project **[name]**` or `**Project:** [name]` patterns
  3. package.json `productName` or `name` field
  4. Folder basename with camelCase/underscore/hyphen normalization

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Console output from `server.js` startup message
- No structured logging - errors silently caught with try/catch blocks

## CI/CD & Deployment

**Hosting:**
- CodeBox (Ubuntu 24.04 VM at 192.168.1.122 / Tailscale 100.123.116.23)

**Process Management:**
- PM2: `pm2 start server.js --name claude-notify`

**Deployment Method:**
- Manual git clone and Node.js execution
- No CI/CD pipeline

## Webhooks & Callbacks

**Incoming Webhooks:**
- `/trigger?type=[done|question]&project=[name]` - HTTP GET endpoint to trigger notification
  - Called by: Claude Code hooks (local bash script or remote Node.js script)
  - Response: JSON `{ ok: true, type, project }`
  - Side effect: Writes `trigger.json` with type and project, pre-generates cached WAV

**Polling Endpoints:**
- `/check` - Browser polls every 1 second for notification state
  - Response: JSON `{ notify: boolean, wav: boolean, type: string, project: string }`
  - Used for: Client-side notification display and audio playback

**Audio Delivery:**
- `/notify-wav?type=[type]&project=[project]` - On-demand WAV generation and streaming
  - On-demand synthesis if not cached
  - Response: WAV file with `Content-Type: audio/wav`

- `/wav/[filename]` - Serve pre-generated voice sample files
  - Used for: Voice preview playback in settings UI
  - Response: WAV file from `data/samples/` directory

**Configuration Endpoints:**
- `/config` - GET returns current voice/template config per notification type
- `/select` - POST to save selected voice and template for a type
  - Body: `{ voice, template, type }`
  - Side effect: Clears cache for the notification type, persists to `data/config.json`

**Sample Generation:**
- `/generate` - POST to generate voice samples for preview
  - Body: `{ text }`
  - Side effect: Generates WAV files for all 7 voices in `data/samples/`

## API Protocols

**HTTP Server:**
- Node.js `http` module (not HTTPS by default)
- All responses: JSON or WAV binary
- CORS: No - same-origin browser tab only

**Project Name Cache Protocol:**
- Stored as JSON: `{ [projectDir]: { name: string, mtime: number }, ... }`
- Invalidation: Compares mtime of 3 source files (display-name, CLAUDE.md, package.json) against cached mtime

## Environment Configuration

**Required env vars:**
- None - All have sensible defaults

**Optional env vars:**
- `PORT` - Server port (default: 3099)
- `DATA_DIR` - Storage directory (default: `./data`)
- `VOICE_NOTIFY_URL` - Server URL for remote hooks (default: `http://100.123.116.23:3099`)
- `CLAUDE_PROJECT_DIR` - Project context (set by Claude Code runtime)
- `VOICE_NOTIFY_DATA` - Local hook data dir override

**Secrets location:**
- None - No credentials or secrets used

---

*Integration audit: 2026-03-26*
