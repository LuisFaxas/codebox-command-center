# Voice Notifications — Session Handoff

## What This Project Is

A voice notification system for Claude Code. When Claude finishes responding (Stop hook) or asks a question (AskUserQuestion hook), a spoken notification plays through the user's browser speakers using Microsoft Edge neural TTS voices.

The server runs centrally on CodeBox. Any machine (CodeBox itself, Lenovo, etc.) connects via a Claude Code hook + a browser tab.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ CodeBox (192.168.1.122 / 100.123.116.23 via Tailscale)  │
│                                                          │
│  server.js (PM2: claude-notify, port 3099)               │
│    ├── GET  /trigger?type=done&project=Name  ← hooks hit │
│    ├── GET  /check  ← browser polls every 1s             │
│    ├── GET  /notify-wav?type=&project=  ← serves WAV     │
│    ├── GET  /config  ← voice+template prefs              │
│    ├── POST /generate  ← audition all 7 voices           │
│    ├── POST /select  ← save voice choice per type        │
│    ├── GET  /samples  ← list audition WAVs               │
│    └── GET  /wav/:file  ← serve audition WAV             │
│                                                          │
│  data/                                                   │
│    ├── trigger.json    ← {type, project} written by hook │
│    ├── config.json     ← persisted voice+template prefs  │
│    ├── cache/          ← WAVs keyed type--project.wav    │
│    └── samples/        ← temp audition WAVs              │
└──────────────────────────────────────────────────────────┘

     ▲ HTTP GET /trigger              ▲ Browser polls /check
     │                                │
┌────┴──────────┐              ┌──────┴──────────┐
│ Claude Code   │              │ Browser tab     │
│ Stop hook     │              │ on any machine  │
│ (any machine) │              │ plays WAV audio │
└───────────────┘              └─────────────────┘
```

## How Hooks Connect

### On CodeBox (local — writes trigger file directly)

`~/.claude/settings.json` Stop hook runs:
```
bash /home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-done.sh
```
This writes `{"type":"done","project":""}` to `data/trigger.json`. Simple, no HTTP.

**Limitation:** The local hook does NOT resolve a project name — it always sends empty project. This means the notification just says "Done" without the project name. The remote hook (notify-trigger.js) is smarter and resolves the project name.

### On Lenovo (remote — HTTP trigger to CodeBox)

`%USERPROFILE%\.claude\settings.json` has two hooks:
- **Stop** → `node notify-trigger.js done`
- **PostToolUse** (matcher: AskUserQuestion) → `node notify-trigger.js question`

`notify-trigger.js` resolves a TTS-friendly project name via priority chain:
1. `.claude/project-display-name` file
2. CLAUDE.md `## Project` bold title
3. CLAUDE.md `**Project:**` pattern
4. `package.json` name/productName
5. Folder basename (cleaned: camelCase split, title cased, max 30 chars)

Results cached in `.name-cache.json` keyed by project dir, invalidated on source file mtime change.

Then hits `GET http://100.123.116.23:3099/trigger?type=done&project=EncodedName`.

### Browser Tab

User keeps `http://100.123.116.23:3099` (or `http://192.168.1.122:3099` on LAN) open in a browser. The page polls `/check` every 1 second. When trigger.json's mtime changes, it fetches `/notify-wav` which returns a cached WAV (or generates one on first request via edge-tts), and plays it through the browser's audio.

## TTS Engine

Uses `edge-tts` (Python package, v7.2.8+). Calls Microsoft's Edge neural TTS API to generate WAV files. Must be ≥7.2.8 — older versions get 403 errors.

Available voices (all `en-US` male neural):
- GuyNeural, EricNeural, ChristopherNeural, RogerNeural, SteffanNeural, AndrewNeural, BrianNeural

Default TTS params: `--rate="-5%" --pitch="-10Hz"` (slightly deeper/slower).

## Notification Types

Two configurable types, each with independent voice + template:

| Type | Hook Event | Default Template |
|------|-----------|-----------------|
| `done` | Stop | `Done with {project}` |
| `question` | PostToolUse (AskUserQuestion) | `I need your attention at {project}` |

`{project}` in templates gets replaced with the resolved project name at WAV generation time.

## File Structure

```
voice_notifications/
├── server.js                      ← HTTP server (single file, ~420 lines)
├── hooks/
│   ├── notify-done.sh             ← local hook for CodeBox
│   └── notify-trigger.js         ← remote hook for Lenovo/any machine
├── data/                          ← gitignored runtime data
│   ├── trigger.json               ← last trigger {type, project}
│   ├── config.json                ← voice+template prefs (created after first voice selection)
│   ├── cache/                     ← cached notification WAVs (type--project_name.wav)
│   └── samples/                   ← temporary audition WAVs
├── .gitignore
├── README.md
└── HANDOFF.md                     ← this file
```

## Current State (2026-03-26)

- Server running via PM2 on CodeBox (`pm2 status` → `claude-notify`)
- CodeBox Stop hook wired in `~/.claude/settings.json`
- Lenovo Stop + AskUserQuestion hooks wired in Lenovo's `%USERPROFILE%\.claude\settings.json`
- Lenovo has a copy of `notify-trigger.js` at `%USERPROFILE%\.claude\hooks\notify-trigger.js`
- `data/config.json` does NOT exist yet — user hasn't selected voices through the UI since consolidation
- Cached WAVs from before consolidation were migrated to `data/cache/`
- edge-tts installed system-wide on CodeBox (`pip install --break-system-packages edge-tts`)
- edge-tts installed on Lenovo (`pip install edge-tts`, v7.2.8)
- Piper TTS was also installed during prototyping (`/home/faxas/.claude/hooks/piper/`) but is NOT used — edge-tts replaced it

## Known Issues / Tech Debt

1. **CodeBox local hook doesn't send project name** — `notify-done.sh` writes `{"type":"done","project":""}`. Should be upgraded to use the same project resolution logic as `notify-trigger.js`, or just call `notify-trigger.js` with `VOICE_NOTIFY_URL=http://localhost:3099`.

2. **HTML is embedded in server.js** — the entire web UI is a template literal inside the server file. Should be extracted to a separate HTML file for maintainability.

3. **No error handling on edge-tts failure** — if edge-tts fails (network down, API change), the WAV isn't generated and the browser gets a 404. No retry or fallback.

4. **Polling is wasteful** — browser polls every 1s via HTTP. Could use Server-Sent Events (SSE) or WebSocket for push-based notifications.

5. **Old files in ~/.claude/hooks/** — the original prototype files still exist: `notify-server.js`, `notify-done.sh`, `piper-voices/`, `piper/`. These are dead code and should be cleaned up.

6. **No package.json** — project has no dependency management. edge-tts is a system pip install, server.js uses only Node built-ins.

7. **`url.parse` is deprecated** — server.js uses the legacy `url.parse()` API. Should migrate to `new URL()`.

## Environment Variables

| Variable | Default | Where Used |
|----------|---------|-----------|
| `PORT` | `3099` | server.js |
| `DATA_DIR` | `./data` (relative to server.js) | server.js |
| `VOICE_NOTIFY_URL` | `http://100.123.116.23:3099` | hooks/notify-trigger.js |
| `VOICE_NOTIFY_DATA` | hardcoded project path | hooks/notify-done.sh |
| `CLAUDE_PROJECT_DIR` | `process.cwd()` | hooks/notify-trigger.js |

## How to Operate

```bash
# Check server status
pm2 logs claude-notify --lines 20

# Restart server after code changes
pm2 restart claude-notify

# Test trigger manually
curl "http://localhost:3099/trigger?type=done&project=TestProject"

# Open UI to configure voices
# Browser: http://192.168.1.122:3099

# Clear all cached WAVs (forces regeneration)
rm -f data/cache/*.wav
```
