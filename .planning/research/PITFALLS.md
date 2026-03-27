# Pitfalls Research

**Domain:** Real-time notification server + developer coding dashboard (Claude Code hooks, SSE, Web Push, edge-tts)
**Researched:** 2026-03-26
**Confidence:** HIGH — most findings verified against official GitHub issues and confirmed bug reports

---

## Critical Pitfalls

### Pitfall 1: AskUserQuestion Fires No Hook — Wrong Event Used

**What goes wrong:**
The project attempts to detect when Claude asks a question via PostToolUse or a custom matcher. No event fires. Question notifications never work. Issue #15872 on anthropics/claude-code was closed as "Not Planned" because the correct hook event already exists — it is just not `PostToolUse`.

**Why it happens:**
`AskUserQuestion` is not a tool in the PostToolUse sense. It is a permission/interaction request. Developers assume all Claude actions are covered by PreToolUse/PostToolUse, but AskUserQuestion routes through the `PermissionRequest` event instead.

**How to avoid:**
Use `PermissionRequest` with `tool: "AskUserQuestion"` as the hook event:
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "tool": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": "node /path/to/notify-trigger.js question &" }]
      }
    ]
  }
}
```
Do NOT use PreToolUse for this — both PreToolUse and PermissionRequest fire simultaneously for AskUserQuestion, causing double-triggering.

**Warning signs:**
- Question notifications never fire despite hook configuration
- Grep for `AskUserQuestion` in hook settings — if it appears under `PreToolUse`, it is wrong
- Stop hook works but question hook does not

**Phase to address:** Hook reliability fix phase (earliest phase)

---

### Pitfall 2: Hooks Non-Functional in Subdirectories

**What goes wrong:**
Claude Code is launched from a project directory (e.g., `~/workspaces/projects/personal/my-app`). All hook types silently fail to fire. No errors are emitted. The notification system appears to work from home directory but fails in all real usage.

**Why it happens:**
Multiple confirmed bugs (issues #10367, #8810, #9039) in Claude Code: settings files are not loaded when `process.cwd()` differs from `~`, and hook paths are resolved relative to the wrong working directory. The `/hooks` command itself does not show configured hooks when in subdirectories.

**How to avoid:**
- Use `$CLAUDE_PROJECT_DIR` as a prefix for ALL hook command paths — never relative paths
- Put hooks in `~/.claude/settings.json` (global), not project-local `.claude/settings.json`
- Test hooks by explicitly running `claude` from the actual project directory, not from `~`
- Add a smoke-test: a hook that `touch`es a temp file so you can verify firing independently of the notification server

**Warning signs:**
- Hooks work when you `cd ~` and test, but not from the actual project
- The `/hooks` command shows an empty list when run from a project directory
- Notifications fire when testing manually but never during actual coding sessions

**Phase to address:** Hook reliability fix phase (earliest phase)

---

### Pitfall 3: Stop Hook Fires on SubagentStop, Not Just Session End

**What goes wrong:**
The `Stop` hook fires more times than expected during a session — it fires for every sub-agent/tool completion, not just the final session stop. This produces spurious "Claude is done" voice notifications mid-session while Claude is still working.

**Why it happens:**
Claude Code has both a `Stop` hook (fires when the top-level session ends) and a `SubagentStop` hook (fires when a spawned sub-agent finishes). In practice, complex tasks spawn sub-agents heavily, and `Stop` can fire multiple times before the real completion.

**How to avoid:**
- Use `Stop` only, not `SubagentStop`, for "done" notifications
- Add debounce logic server-side: ignore Stop events that arrive within N seconds of each other from the same project
- If duplicate firing persists, consider a cooldown window (e.g., 10 seconds) per project before re-arming the Stop notification

**Warning signs:**
- "Claude is done" voice fires 3–4 times during a single long task
- Notifications arrive while Claude is visibly still processing in the terminal

**Phase to address:** Hook reliability fix phase (earliest phase)

---

### Pitfall 4: Polling Race — Notifications Lost Between Poll Windows

**What goes wrong:**
The current system writes a `trigger.json` file and a polling loop reads it. If two hooks fire within the 1-second poll interval, only one notification is delivered. Rapid task completions (e.g., Claude finishing 3 sub-tasks quickly) silently drop events.

**Why it happens:**
File-based polling is a single-consumer read-then-delete pattern. The poll interval creates a window where events stack up. The first event consumed causes `trigger.json` to be deleted, and subsequent events written after the read but before the delete overwrite or are never read.

**How to avoid:**
- Replace polling with an event queue (append to a JSONL file, not overwrite a single JSON file), or better yet, eliminate file-based IPC entirely
- Switch hooks to POST directly to the HTTP server instead of writing files
- On the CodeBox hook (local machine), use a Unix socket or direct HTTP call, not a shared file
- The SSE migration resolves this structurally: hooks push to server, server fans out to SSE clients

**Warning signs:**
- Rapid sequences of tasks produce fewer notifications than expected
- The `trigger.json` file sometimes contains stale data from a previous session

**Phase to address:** SSE/push architecture phase

---

### Pitfall 5: SSE Connections Leak When Clients Disconnect Ungracefully

**What goes wrong:**
Dashboard browser tabs are closed or the network drops. The server's SSE client list grows indefinitely. After hours/days of use, writing to dead connections throws errors or silently fails. In extreme cases, the Node.js process runs out of file descriptors.

**Why it happens:**
SSE is a long-lived HTTP connection. When a client disconnects (closed tab, network drop, sleep), the server does not receive an immediate notification unless the response `close` event is explicitly handled. The default Express response object does not auto-cleanup.

**How to avoid:**
```javascript
// REQUIRED for every SSE connection
req.on('close', () => {
  clients.delete(res);
});
```
- Maintain a `Set` of active SSE response objects, not an array
- Send a heartbeat comment (`:\n\n`) every 15–30 seconds — this causes write failures that surface dead connections
- Log `clients.size` periodically so leaks are visible in PM2 logs

**Warning signs:**
- `clients.size` grows monotonically in logs even after closing browser tabs
- `MaxListenersExceededWarning` in Node.js output
- Server slows down after 24+ hours of uptime

**Phase to address:** SSE/push architecture phase

---

### Pitfall 6: Caddy/Proxy Kills SSE Connections After 2 Minutes of Inactivity

**What goes wrong:**
The dashboard works perfectly on direct LAN access (`http://192.168.1.122:3099`) but SSE connections drop every ~2 minutes when accessed via `https://claude-notify.codebox.local` (through Caddy). The dashboard appears to reconnect but events during the reconnect window are missed.

**Why it happens:**
Caddy's default keepalive timeout is 2 minutes. An idle SSE connection (no events for 2 minutes) looks like a stalled connection and gets terminated. Caddy also buffers responses by default unless explicitly disabled.

**How to avoid:**
- Send SSE heartbeat comments every 30 seconds: `res.write(':\n\n')` — this keeps the connection active through Caddy's timeout
- In the Caddy config for the SSE endpoint, add `flush_interval -1` to disable buffering
- Test exclusively through Caddy during development, not direct port access, to surface proxy issues early

**Warning signs:**
- SSE works on `:3099` but not on `claude-notify.codebox.local`
- Connection drops happen on a regular interval (every ~120 seconds)
- Dashboard shows "reconnecting" state periodically even with no server restart

**Phase to address:** SSE/push architecture phase

---

### Pitfall 7: Web Push Requires Service Worker — Cannot Use Simple Notifications API

**What goes wrong:**
The developer implements browser push notifications using `new Notification(...)` (the simple Notifications API). This works when the tab is focused but silently fails when the tab is backgrounded or the browser window is minimized. No error is thrown.

**Why it happens:**
The Web Push API (background notifications, works when tab is not focused) requires a service worker. The simple `Notification` constructor only works when a page is active and focused. They are different APIs with different capabilities and registration requirements.

**How to avoid:**
- Use the Web Push API with a registered service worker for true background notifications
- Register VAPID keys on the server; store subscription object on the client
- Service worker file must be at the root path (e.g., `/sw.js`), not a subdirectory
- For this single-user system, VAPID keys can be generated once at server startup and persisted to disk

**Warning signs:**
- Notifications appear in the browser when the tab is active but never when it is backgrounded
- No `pushsubscriptionchange` or `push` events visible in DevTools service worker panel
- `Notification.permission` is `granted` but notifications don't appear from background

**Phase to address:** Web Push / browser notifications phase

---

### Pitfall 8: edge-tts 403 Errors Break All Voice Notifications Silently

**What goes wrong:**
The `edge-tts` subprocess exits with a 403 error. No voice plays. No error surfaces to the user (the HTTP notification request returns 200 because the server considers the notification "sent" even if TTS synthesis failed). The user assumes the notification system is working until they notice the silence.

**Why it happens:**
Microsoft periodically changes authentication requirements for the unofficial Edge TTS WebSocket endpoint. Versions before 6.1.9 do not send the required `Sec-MS-GEC` token. The fix is already in edge-tts v7.2.8+ (confirmed working), but a dependency drift or Python environment issue can revert to an older version.

**How to avoid:**
- Pin edge-tts in requirements at `>=7.2.8` and verify with `edge-tts --version` in the startup health check
- The server's TTS function must capture stderr from the Python subprocess and log it — do not discard stderr
- Add a startup self-test: synthesize a short phrase at server start and verify the output file was created

**Warning signs:**
- Voice notifications silently stop working after a Python update
- `edge-tts` in terminal prints `WSServerHandshakeError: 403`
- The TTS cache directory stops accumulating new `.wav` files

**Phase to address:** Server hardening / health check phase

---

### Pitfall 9: Project Name Resolution Fails for Remote Machines

**What goes wrong:**
On CodeBox, project names resolve correctly from the folder basename. On the Lenovo (Windows), the hook sends an HTTP POST with either no project name or a Windows-format path (`C:\Users\...`). The dashboard shows "Unknown" for all Lenovo sessions.

**Why it happens:**
The `notify-trigger.js` script on Lenovo resolves the project name using `process.cwd()` or `$CLAUDE_PROJECT_DIR`, which returns a Windows path. The basename extraction logic may not handle Windows path separators (`\` vs `/`), and `$CLAUDE_PROJECT_DIR` may not be set on Windows at all.

**How to avoid:**
- Use `path.basename()` which handles both separators natively in Node.js
- Fall back to the last path segment after splitting on both `/` and `\`
- In the hook script, log the raw `cwd` value for the first few runs to verify what is actually sent
- Accept `project` as an explicit HTTP POST parameter so the hook can hardcode it as a fallback

**Warning signs:**
- Dashboard shows "Unknown" only for sessions from the Lenovo
- The `project` field in POST requests from Lenovo is an empty string or a full Windows path

**Phase to address:** Hook reliability fix phase (earliest phase)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline HTML in server.js (current) | No build step, single file | Makes the file 600+ lines; adding a dashboard UI becomes unmanageable | Never — split at first UI expansion |
| Single `trigger.json` file for IPC | Simple to implement | Events lost under rapid firing; race conditions with concurrent sessions | Never — already causing bugs |
| No heartbeat on SSE | Simpler server code | Connections drop silently through Caddy; clients show stale data | Never for production use |
| Skipping service worker for push | Faster to implement | Background notifications never work — defeats the purpose | Never — this is the core requirement |
| Hardcoding CodeBox IP in hook scripts | Works for local testing | Breaks when Tailscale IP changes or accessing from new machine | Only in initial prototype, replace immediately |
| No TTS queue / running concurrent edge-tts | Simpler code | Concurrent TTS processes can 403-block each other and corrupt WAV cache files | Never — serialize TTS calls |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code hooks | Using `PreToolUse` matcher for `AskUserQuestion` | Use `PermissionRequest` with `tool: "AskUserQuestion"` |
| Claude Code hooks | Relative paths in hook command strings | Always prefix with `$CLAUDE_PROJECT_DIR` or use absolute paths |
| edge-tts | Ignoring stderr from Python subprocess | Capture and log stderr; treat non-zero exit as a hard error |
| edge-tts | Running concurrent TTS synthesis calls | Serialize with a queue; one synthesis at a time |
| Web Push API | Using `new Notification()` instead of service worker push | Register a service worker, use `PushManager.subscribe()` |
| Web Push API | Regenerating VAPID keys on every restart | Generate once, persist to disk, reuse across restarts |
| SSE via Caddy | Forgetting `flush_interval -1` | Add directive to Caddy config for SSE routes |
| SSE via Caddy | Not sending heartbeats | Send `:\n\n` every 30 seconds from the server |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded SSE client Set | Memory grows over days; eventual OOM | Always delete client on `req.on('close', ...)` | 10+ clients connected over 24h without cleanup |
| TTS synthesis for every notification with no caching | 2–3 second delay per notification; Microsoft rate-limit risk | Cache WAV files by (type, project) key — already partially implemented | 5+ concurrent sessions firing simultaneously |
| Broadcasting full session state to all SSE clients on every hook fire | Unnecessary data transfer; UI flicker | Broadcast only the changed session delta, not full state dump | 10+ active sessions each firing frequently |
| 1-second polling loop reading trigger.json | 86,400 file reads per day for a rarely-changing file; lost events | Replace with direct HTTP POST from hooks | Immediately — already causing bugs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No auth on the notification POST endpoint | Any machine on the network can inject fake notifications or spam voice | Add a shared secret header; validate on every POST |
| Exposing the notification server on `0.0.0.0` without Tailscale/LAN restriction | Publicly accessible if CodeBox firewall misconfigured | Bind to `127.0.0.1` only; let Caddy handle external access with optional IP allowlist |
| Storing VAPID private key in memory only | Loss on PM2 restart means all push subscriptions are invalidated | Persist VAPID keys to a local file at `~/.claude/voice-notify/vapid-keys.json` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Audio plays at full system volume | Jarring, especially late at night during long sessions | Respect a configurable volume level; default to 70% |
| Notification fires for every sub-agent stop | "Notification fatigue" — user starts ignoring all notifications | Deduplicate: one notification per project per N seconds |
| Dashboard shows no indication of which project needs attention vs. just finished | User has to read all session statuses to find the actionable one | Color-code: green = done, yellow = question/waiting, gray = idle |
| "Done" notification fires even when Claude stopped due to an error | User arrives expecting a finished task and finds a crash | Inspect the Stop hook payload; differentiate error stops from clean stops |
| Browser push permission requested immediately on page load | Chrome blocks auto-permission requests; user clicks "Block" reflexively | Request permission only after user explicitly clicks "Enable notifications" button |

---

## "Looks Done But Isn't" Checklist

- [ ] **Voice notifications:** Verify audio plays when the browser tab is NOT the active tab (requires system audio, not tab audio)
- [ ] **Question detection:** Verify `PermissionRequest` hook fires — do not test with Stop hook as a proxy
- [ ] **Remote machine hooks:** Verify Lenovo hook actually POSTs to the server (check PM2 logs, not just the hook script existing)
- [ ] **SSE reconnect:** Close the browser tab, wait 30 seconds, reopen — events from the gap should not appear; connection should resume cleanly
- [ ] **Background push:** Minimize the browser entirely, trigger a notification — verify OS-level popup appears
- [ ] **Project name:** Trigger a notification from a deeply nested project directory — verify project name is folder basename, not full path
- [ ] **Caddy routing:** Verify SSE works through `https://claude-notify.codebox.local`, not just direct `:3099`
- [ ] **edge-tts health:** Check that `~/.cache/voice-notify/` accumulates new `.wav` files after notifications; a frozen cache means silent failures

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong hook event for AskUserQuestion | LOW | Update `settings.json` to use `PermissionRequest`; restart Claude Code sessions |
| Hooks non-functional in subdirectories | LOW | Switch to absolute paths with `$CLAUDE_PROJECT_DIR`; verify with smoke-test hook |
| SSE connection leak causing degraded server | MEDIUM | `pm2 restart claude-notify`; add `req.on('close')` cleanup before next deploy |
| edge-tts 403 errors | LOW | `pip install --upgrade edge-tts`; verify version `>=7.2.8`; restart server |
| VAPID keys rotated (all subscriptions invalidated) | MEDIUM | Persist keys to disk; all clients must re-subscribe (one-time UX friction) |
| Polling events lost | LOW | Already known — fix is to switch to direct HTTP POST from hooks (architectural change) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong hook event for AskUserQuestion | Phase 1: Hook reliability | Manual test: trigger AskUserQuestion, verify notification fires |
| Hooks non-functional in subdirectories | Phase 1: Hook reliability | Smoke-test hook that writes a temp file; verify from project dir |
| Stop hook fires for sub-agents | Phase 1: Hook reliability | Count notification fires during a multi-step task; expect exactly 1 |
| Polling race / lost events | Phase 2: SSE architecture | Rapid-fire 5 notifications; verify all 5 appear in dashboard |
| SSE connection leak | Phase 2: SSE architecture | Open 5 tabs, close all, verify `clients.size` returns to 0 in logs |
| Caddy proxy kills SSE | Phase 2: SSE architecture | Connect via Caddy URL, leave idle 3 minutes, verify connection alive |
| Web Push requires service worker | Phase 3: Browser push | Test background tab notification delivery |
| edge-tts silent 403 failure | Phase 4: Server hardening | Startup health check synthesizes test phrase |
| Remote project name resolution | Phase 1: Hook reliability | Trigger notification from Lenovo, verify project name in dashboard |
| Browser push permission UX | Phase 3: Browser push | Verify permission prompt only appears on explicit user action |

---

## Sources

- [Add hook support for AskUserQuestion tool — Issue #15872 (closed Not Planned)](https://github.com/anthropics/claude-code/issues/15872)
- [pre_tool_use and post_tool_use hooks not firing — Issue #15441](https://github.com/anthropics/claude-code/issues/15441)
- [Hooks Completely Non-Functional in Subdirectories — Issue #10367](https://github.com/anthropics/claude-code/issues/10367)
- [UserPromptSubmit hooks not working in subdirectories — Issue #8810](https://github.com/anthropics/claude-code/issues/8810)
- [Notification hook delay vs Stop hook — Issue #23383](https://github.com/anthropics/claude-code/issues/23383)
- [edge-tts 403 error / Sec-MS-GEC token — Issue #290](https://github.com/rany2/edge-tts/issues/290)
- [Server-Sent Events are still not production ready — DEV Community](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie)
- [How to Configure Server-Sent Events Through Nginx](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view)
- [Common Issues and Reporting Bugs — web.dev Push Notifications](https://web.dev/push-notifications-common-issues-and-reporting-bugs)
- [Push API — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Hooks reference — Claude Code official docs](https://code.claude.com/docs/en/hooks)

---
*Pitfalls research for: Voice notification server + Claude Code developer dashboard*
*Researched: 2026-03-26*
