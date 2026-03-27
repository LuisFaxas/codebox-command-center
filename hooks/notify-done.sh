#!/bin/bash
# Local hook for CodeBox — triggers notification when Claude Code finishes
# Writes trigger JSON to the server's data directory
DATA_DIR="${VOICE_NOTIFY_DATA:-/home/faxas/workspaces/projects/personal/voice_notifications/data}"
TRIGGER_FILE="$DATA_DIR/trigger.json"

mkdir -p "$DATA_DIR"
echo '{"type":"done","project":""}' > "$TRIGGER_FILE"
exit 0
