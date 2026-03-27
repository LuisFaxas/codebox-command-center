# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- JavaScript (Node.js) - Server and CLI hooks

**Secondary:**
- Bash - Local notification hook script

## Runtime

**Environment:**
- Node.js (v24 per workspace standard via nvm)

**Package Manager:**
- None (no package.json) - Project uses system dependencies only

**Lockfile:**
- Not applicable

## Frameworks

**Server:**
- Node.js built-in `http` module - HTTP server for browser UI and API endpoints

**Client:**
- Vanilla JavaScript (embedded in HTML) - Browser-based voice picker and notification listener

**TTS Engine:**
- edge-tts (Python) - Microsoft Edge neural text-to-speech, invoked via CLI

## Key Dependencies

**Critical:**
- edge-tts - Text-to-speech synthesis using Microsoft neural voices. Required on server system. Installed via `pip install edge-tts`.

**Infrastructure:**
- No npm packages - All logic uses Node.js built-ins (`http`, `fs`, `path`, `url`, `child_process`)

## Configuration

**Environment:**
- `PORT` - Server port (default: 3099)
- `DATA_DIR` - Directory for config, cache, samples (default: `./data` relative to `server.js`)
- `VOICE_NOTIFY_URL` - Server URL for remote hooks (default: `http://100.123.116.23:3099`)
- `CLAUDE_PROJECT_DIR` - Project directory path for local hook context (set by Claude Code)
- `VOICE_NOTIFY_DATA` - Optional override for local hook data directory

**Runtime Artifacts:**
- `data/config.json` - Persisted voice and template settings per notification type (created at runtime)
- `data/trigger.json` - Notification trigger file, modified via mtime for polling (created at runtime)
- `data/samples/` - Generated WAV files for voice preview (created at runtime)
- `data/cache/` - Cached notification audio files (created at runtime)
- `hooks/.name-cache.json` - Project name resolution cache (created at runtime)

## Build/Dev

**Development:**
- No build step required - Direct Node.js execution

**Start Command:**
```bash
node /path/to/server.js
# or
pm2 start server.js --name claude-notify
```

## Platform Requirements

**Development:**
- Node.js v24
- Python 3.x with edge-tts installed (`pip install edge-tts`)
- Bash shell (for local hook)

**Production:**
- Linux server (CodeBox - Ubuntu 24.04)
- Python 3.x with edge-tts
- Port 3099 available (or custom via PORT env var)
- 100+ MB disk space in `DATA_DIR` for audio cache

---

*Stack analysis: 2026-03-26*
