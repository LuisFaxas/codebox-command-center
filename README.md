# Voice Notifications for Claude Code

Plays a spoken notification through your browser when Claude Code finishes responding or asks a question. Uses Microsoft Edge neural TTS voices.

## Architecture

```
Claude Code hook (any machine)
  → hits /trigger?type=done&project=MyProject on the server
  → server writes trigger file + pre-generates WAV via edge-tts

Browser tab (open on your machine)
  → polls /check every 1s
  → plays cached WAV through your speakers
```

The server runs on one machine (CodeBox). Any number of clients connect via browser tab + hook.

## Setup

### Server (CodeBox)

```bash
# Install edge-tts
pip install edge-tts

# Start the server
node server.js
# Or with PM2:
pm2 start server.js --name claude-notify
```

### Claude Code hooks

**Local machine (server runs here too):**

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bash /path/to/voice_notifications/hooks/notify-done.sh",
        "timeout": 5
      }]
    }]
  }
}
```

**Remote machine (connects over HTTP):**

Copy `hooks/notify-trigger.js` to the remote machine's `~/.claude/hooks/`.

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/notify-trigger.js done",
        "timeout": 5
      }]
    }],
    "PostToolUse": [{
      "matcher": "AskUserQuestion",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/notify-trigger.js question",
        "timeout": 5
      }]
    }]
  }
}
```

Set `VOICE_NOTIFY_URL` env var if the server isn't at the default `http://100.123.116.23:3099`.

### Browser

Open `http://<server-ip>:3099` in a browser, pick voices for DONE and QUESTION tabs, keep the tab open.

## Environment Variables

- `PORT` — server port (default: 3099)
- `DATA_DIR` — directory for config, cache, samples (default: `./data`)
- `VOICE_NOTIFY_URL` — server URL for remote hooks (default: `http://100.123.116.23:3099`)
