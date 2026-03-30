# Setting Up Voice Notifications on Remote Machines

The notification hooks in `~/.claude/settings.json` reference absolute paths to
`notify-trigger.cjs` on CodeBox. On other machines (Lenovo, Mac), those paths
don't exist, so hooks silently fail.

## Option A: Copy Hook Script (recommended)

1. Copy the hook script to the remote machine:

```bash
# From CodeBox:
scp /home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs \
  lenovo:~/.claude/hooks/notify-trigger.cjs
```

2. Edit `~/.claude/settings.json` on the remote machine. Add these hook entries
   (adjust the path to wherever you placed the script):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/notify-trigger.cjs\" done",
            "timeout": 5
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/notify-trigger.cjs\" question",
            "timeout": 5
          }
        ]
      },
      {
        "matcher": "elicitation_dialog",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/notify-trigger.cjs\" question",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

3. The script reads `VOICE_NOTIFY_URL` env var (defaults to `http://100.123.116.23:3099`,
   which is CodeBox's Tailscale IP). If your setup differs, set the env var.

## Option B: Inline curl (no script needed)

If you don't want to copy files, use inline curl commands in settings.json:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://100.123.116.23:3099/trigger -H 'Content-Type: application/json' -d '{\"type\":\"done\",\"project\":\"'\"$(basename $(pwd))\"'\",\"machine\":\"'\"$(hostname)\"'\"}' > /dev/null 2>&1 || true",
            "timeout": 5
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://100.123.116.23:3099/trigger -H 'Content-Type: application/json' -d '{\"type\":\"question\",\"project\":\"'\"$(basename $(pwd))\"'\",\"machine\":\"'\"$(hostname)\"'\"}' > /dev/null 2>&1 || true",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Note: Option B gives less accurate project names (just folder basename) and no
session deduplication (no sessionId). Option A is preferred.

## Verifying

After setup, trigger a test from the remote machine:

```bash
echo '{}' | node ~/.claude/hooks/notify-trigger.cjs done
```

Check the dashboard at http://100.123.116.23:3099/ — you should see the notification appear.
