---
status: awaiting_human_verify
trigger: "Three notification regressions after phase 3 dashboard work: double voices, Lenovo hooks broken, unreliable triggering"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: Three independent bugs — (1) SSE reconnect replays trigger events causing double playback, (2) CodeBox-absolute hook paths don't exist on Lenovo, (3) duplicate hook entries in settings.json fire multiple notifications for same event
test: Read all relevant source files, trace each bug's mechanism
expecting: Confirm each root cause and implement targeted fixes
next_action: Fix Bug 1 (client-side dedup), then Bug 3 (settings.json cleanup + server dedup), then document Bug 2

## Symptoms

expected: |
  1. Single voice notification per trigger event
  2. Notifications fire from Lenovo (remote) Claude Code sessions
  3. Reliable 1:1 mapping between Claude Code events and notifications

actual: |
  1. Double voices — audio plays twice per trigger event
  2. Lenovo sessions never trigger notifications
  3. Multiple notifications for single events, or dropped notifications

errors: No error messages — failures are silent

reproduction: |
  1. Double voice: Open dashboard in browser, fire a trigger. Audio plays twice.
  2. Lenovo: Run any Claude Code session on Lenovo — no notification fires
  3. Unreliable: Multiple question hooks fire for same AskUserQuestion event

started: After phase 3 work (dashboard rewrite). Phase 1-2 notifications worked correctly.

## Eliminated

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: sse.js — SSE event replay on reconnect
  found: addClient() replays buffered events when lastEventId is provided (lines 29-36). EventSource browser API automatically sends Last-Event-ID header on reconnect. During brief overlap window (old connection not yet closed, new one opened), both can receive the same event.
  implication: Client needs to track last processed event ID to deduplicate replayed triggers

- timestamp: 2026-03-28T00:02:00Z
  checked: public/index.html — trigger event handler (line 994)
  found: No deduplication. Every 'trigger' SSE event unconditionally calls playVoice() and showToast(). The SSE event has an id field (e.lastEventId) but it's never checked.
  implication: Confirmed — client plays audio for every SSE event including replays

- timestamp: 2026-03-28T00:03:00Z
  checked: ~/.claude/settings.json — hook configuration
  found: THREE separate hooks can fire for "question" events: (1) PreToolUse AskUserQuestion, (2) Notification idle_prompt, (3) Notification elicitation_dialog. When Claude asks a question, multiple hooks fire simultaneously, each hitting /trigger.
  implication: Server debounce uses key `type:project:sessionId` with 3s window. If all three fire within 3s with same sessionId, debounce should catch duplicates 2 and 3. BUT — PreToolUse provides different stdin JSON than Notification hooks, so sessionId may differ. Need to verify.

- timestamp: 2026-03-28T00:04:00Z
  checked: server.js isDuplicate() function (line 15-22)
  found: Debounce key is `${type}:${project}:${sessionId}`. All three hooks pass the same type ("question") and resolve the same project name. The sessionId comes from hookInput.session_id in notify-trigger.cjs. Claude Code should provide the same session_id to all hooks in the same session. So debounce SHOULD catch duplicates — but only if they arrive within 3000ms AND have the same sessionId.
  implication: Server-side debounce may already work for same-session duplicates. The real problem might be the overlap between SSE reconnect replay (Bug 1) amplifying the effect.

- timestamp: 2026-03-28T00:05:00Z
  checked: hooks/notify-trigger.cjs — SERVER_URL configuration
  found: Line 14 defaults to http://100.123.116.23:3099 (CodeBox Tailscale IP). This is correct for Lenovo reaching CodeBox over Tailscale. The REAL issue is that settings.json references /home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs — this path only exists on CodeBox.
  implication: Bug 2 is purely a deployment/config issue. The hook script itself is fine, it just needs to exist on Lenovo.

## Resolution

root_cause: |
  Bug 1: SSE client in public/index.html has no event deduplication. On reconnect, EventSource replays buffered events (sse.js lines 29-36), and the client plays audio for each one — causing double (or more) voice playback.
  Bug 2: ~/.claude/settings.json hook commands reference absolute CodeBox path to notify-trigger.cjs. This path doesn't exist on Lenovo, so hooks silently fail.
  Bug 3: Three separate hooks (PreToolUse AskUserQuestion, Notification idle_prompt, Notification elicitation_dialog) can fire for the same "question" event. Server debounce catches most duplicates, but combined with Bug 1's replay, users experience 2-6x notifications.

fix: |
  Bug 1: Added client-side event dedup in public/index.html — tracks lastProcessedEventId, skips SSE events with IDs already seen. Prevents replay-on-reconnect from causing double playback.
  Bug 2: Created hooks/REMOTE-SETUP.md documenting how to deploy hooks to Lenovo/Mac. This is a config issue, not a code bug.
  Bug 3: (a) Removed redundant PreToolUse AskUserQuestion hook from ~/.claude/settings.json — Notification hooks (idle_prompt, elicitation_dialog) are sufficient. (b) Changed server debounce key from type:project:sessionId to type:sessionId — prevents duplicates even when project name resolution differs between hooks.

verification: |
  - Server restart successful (pm2 restart claude-notify)
  - Server-side dedup confirmed: first POST /trigger returns deduplicated:false, second within 3s returns deduplicated:true
  - Dedup works across different project names for same sessionId
  - Awaiting human verification of double-voice fix in browser

files_changed:
  - public/index.html (client-side event deduplication)
  - server.js (improved debounce key)
  - ~/.claude/settings.json (removed duplicate PreToolUse AskUserQuestion hook)
  - hooks/REMOTE-SETUP.md (new — remote machine setup docs)
