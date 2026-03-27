# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
voice_notifications/
├── server.js                   # HTTP server + embedded UI (420 lines)
├── hooks/                      # Claude Code integration hooks
│   ├── notify-done.sh          # Local hook for CodeBox (triggers via file write)
│   └── notify-trigger.js       # Remote hook for other machines (HTTP trigger)
├── data/                       # Runtime data (gitignored)
│   ├── trigger.json            # Current notification state {type, project}
│   ├── config.json             # Voice + template preferences
│   ├── cache/                  # Persistent notification WAV files
│   │   └── [type]--[project].wav
│   └── samples/                # Temporary audition WAV files
├── .gitignore                  # Ignores data/
├── README.md                   # User setup instructions
└── HANDOFF.md                  # Detailed session notes (tech debt, current state)
```

## Directory Purposes

**Root:**
- Purpose: Project entry point and documentation
- Contains: Server executable, hook scripts, user guides
- Key files: `server.js` (main), `README.md`, `HANDOFF.md`

**hooks/**
- Purpose: Integration with Claude Code hook system
- Contains: Two executable scripts for different trigger scenarios
- Key files: `notify-trigger.js` (production remote hook), `notify-done.sh` (local hook with known limitation)

**data/**
- Purpose: Runtime state and artifacts (gitignored)
- Contains: Transient trigger signals, persistent configuration, cached and temporary audio files
- Key files: `config.json` (user voice preferences), `trigger.json` (current event), `cache/` (keeps past notification audio)

**data/cache/**
- Purpose: Persistent WAV cache for repeated notifications
- Contains: Generated speech files keyed by notification type and project name
- Pattern: `[type]--[sanitized_project_name].wav` (e.g., `done--Faxas_Server.wav`)

**data/samples/**
- Purpose: Temporary storage for voice audition samples during configuration
- Contains: All 7 available voices rendered with same text (cleared before each generation)
- Pattern: `[short_name]--[full_voice_id].wav` (e.g., `guy--en-US-GuyNeural.wav`)

## Key File Locations

**Entry Points:**
- `server.js`: Main HTTP server; runs standalone or via PM2
- `hooks/notify-done.sh`: Triggered by Claude Code Stop hook on CodeBox (writes to trigger.json directly)
- `hooks/notify-trigger.js`: Triggered by Claude Code Stop/PostToolUse hooks on remote machines (HTTP GET to /trigger)

**Configuration:**
- `data/config.json`: Persisted voice + template preferences for done/question types (created on first voice selection)
- Environment variables: PORT (default 3099), DATA_DIR (default ./data), VOICE_NOTIFY_URL (default http://100.123.116.23:3099), CLAUDE_PROJECT_DIR (used by notify-trigger.js)

**Core Logic:**
- `server.js:27-44`: Config management (load/save)
- `server.js:47-112`: Cache and sample generation functions
- `server.js:306-417`: Route handlers for all endpoints
- `server.js:160-302`: Embedded browser UI JavaScript and polling loop

**Data Flow:**
- `server.js:399-412`: /trigger endpoint (hook entry point)
- `server.js:309-327`: /check endpoint (browser polling)
- `server.js:337-352`: /notify-wav endpoint (serves notification audio)
- `server.js:53-76`: generateSamples() spawns parallel edge-tts processes
- `server.js:86-104`: generateCached() on-demand WAV generation with caching

**Testing:**
- Manual: `curl "http://localhost:3099/trigger?type=done&project=TestProject"` to simulate hook
- Manual: Open http://localhost:3099 in browser to configure voices and observe polling

## Naming Conventions

**Files:**
- `server.js` — main executable, PascalCase + lowercase
- `notify-*.js` or `notify-*.sh` — hook scripts, kebab-case after notify-
- Config: `config.json`, `trigger.json`, `.name-cache.json` (dot-prefixed only for local hook cache)
- Audio: `[type]--[project].wav` (double dash separator for clarity)

**Variables:**
- Uppercase + underscores for constants: `PORT`, `DATA_DIR`, `TRIGGER_FILE`, `SAMPLES_DIR`, `CACHE_DIR`
- camelCase for functions: `generateSamples()`, `getCachePath()`, `safeName()`, `resolveProjectName()`
- camelCase for config objects: `config`, `serverConfig`, `nameCache`

**Routes:**
- Lowercase, forward-slash separated: `/trigger`, `/check`, `/config`, `/notify-wav`, `/select`, `/generate`, `/samples`
- Query params: `type` and `project` for state passing

## Where to Add New Code

**New Feature (e.g., new notification type):**
- Primary code: `server.js` — add route handler and update VOICES/config structure
- Hooks: `hooks/notify-trigger.js` — add new condition in postprocessing if needed
- Tests: No test framework; use manual curl testing

**New Endpoint:**
- Implementation: Add handler block in `server.js:306-417` following pattern of existing routes
- Naming: Use `/lowercase-kebab` pattern
- Response: Return JSON with `{ok: true}` or error structure

**New Voice Option:**
- Implementation: Add voice ID to VOICES array in `server.js:14-22`
- Format: 'en-US-[Name]Neural' (Microsoft naming convention)
- No other changes needed (generateSamples loops over VOICES array)

**Utilities:**
- Shared helpers: Add functions near top of `server.js` before route handlers (current location: 27-112)
- Pattern: Pure functions preferred; those needing I/O use callback pattern (see generateCached signature)

**New Hook for Another Machine:**
- Copy `hooks/notify-trigger.js` to target machine's Claude hooks directory
- Set `VOICE_NOTIFY_URL` env var if server isn't at default IP
- Register hook in target machine's `~/.claude/settings.json` Stop and PostToolUse events

## Special Directories

**data/ (Runtime directory, gitignored):**
- Purpose: Hold runtime artifacts and state
- Generated: Yes, automatically created by server if missing
- Committed: No, entire directory in .gitignore

**data/cache/ (Persistent WAV storage):**
- Purpose: Avoid regenerating notification audio for repeated project/type pairs
- Generated: Yes, by generateCached() on first notification
- Committed: No, contains generated audio files

**data/samples/ (Temporary audition storage):**
- Purpose: Support voice selection UI by showing all 7 voices with same text
- Generated: Yes, cleared and regenerated each time user clicks GENERATE
- Committed: No, ephemeral

**.planning/codebase/ (Planning directory):**
- Purpose: Store GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes, by GSD mapper
- Committed: Yes, these are reference docs

## Configuration Files

**server.js constants (lines 7-22):**
```javascript
const PORT = process.env.PORT || 3099;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const VOICES = ['en-US-GuyNeural', ...];
```

Change these for deployment to different port/directory.

**data/config.json (example structure):**
```json
{
  "done": {
    "voice": "en-US-GuyNeural",
    "template": "Done with {project}"
  },
  "question": {
    "voice": "en-US-EricNeural",
    "template": "I need your attention at {project}"
  }
}
```

**Environment Variables:**
- `PORT` — HTTP listen port (default 3099)
- `DATA_DIR` — directory for config/cache/samples (default ./data relative to server.js)
- `VOICE_NOTIFY_URL` — URL for remote hooks to target (default http://100.123.116.23:3099)
- `CLAUDE_PROJECT_DIR` — working directory to resolve project name from (default process.cwd() in notify-trigger.js)
- `VOICE_NOTIFY_DATA` — explicit trigger file path for notify-done.sh (default /path/to/voice_notifications/data)

---

*Structure analysis: 2026-03-26*
