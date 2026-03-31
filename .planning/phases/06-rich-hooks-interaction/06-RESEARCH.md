# Phase 6: Rich Hooks + Interaction - Research

**Researched:** 2026-03-30
**Domain:** Claude Code hook events, SDK session relay, cross-platform hook deployment, session actions
**Confidence:** HIGH (hook payloads verified from official docs; SDK patterns established in Phase 5)

## Summary

This phase adds four capabilities: (1) new PostToolUse and SessionStart hooks that send richer payloads to the server, (2) SDK conversation loading and response relay for the dashboard, (3) cross-machine hook installation for Lenovo (Windows) and Mac, and (4) session action controls (dismiss, copy question, focus terminal).

The hook system research reveals that PostToolUse provides `tool_name` and `tool_input` fields in the stdin JSON payload -- exactly what is needed for real-time tool activity tracking on session cards. SessionStart fires on new sessions AND resumes with a `source` field distinguishing startup/resume/clear/compact. Notification hooks provide a `message` field containing the actual notification text, which can be used to capture question text for HOOK-08.

The SDK response relay via `resumeSession().send()` was already established in Phase 5 research with a key caveat: it spawns a new subprocess, not IPC to the running terminal. This remains the architecture -- the dashboard sends a response via SDK, which appends to the transcript. The running Claude Code session does not receive the message directly.

For cross-machine hooks, settings.json lives at `~/.claude/settings.json` on all platforms (Linux, macOS, Windows via `%USERPROFILE%`). The hook script is a single CJS file that works everywhere Node.js runs. The installer endpoint generates machine-specific setup instructions.

Focus Terminal is complex because Claude Code sessions on CodeBox run inside VS Code (not tmux). Process-to-cwd mapping is possible via `/proc/<pid>/cwd` on Linux, but there is no reliable way to focus a VS Code terminal tab programmatically from the server. The recommendation is to show the session's cwd as a clickable path that copies to clipboard, and defer true terminal focus to a future enhancement.

**Primary recommendation:** Extend the existing hook script to handle PostToolUse and SessionStart events. Add Notification `message` capture for question text. Build a `/hooks/install` API endpoint that generates platform-specific setup instructions. Wire SDK conversation loading into the existing conversation panel. Implement dismiss as a client-side action that removes a session card.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Match dashboard sessions to SDK transcripts automatically by project directory path (cwd). SDK listSessions() returns sessions with cwd -- find the most recent SDK session matching the hook session's project directory.
- **D-02:** When SessionStart hooks ship (HOOK-06), capture the exact SDK session_id for precise matching. Auto-match by directory is the fallback.
- **D-03:** If no SDK transcript is found for a session, show a clean empty state: "No conversation available -- session may be remote or just started."
- **D-04:** Full send capability -- user sees conversation, types answer, hits Send, SDK resumes the session with the response.
- **D-05:** SDK resumeSession().send() resumes the session with the user's reply. The response appears in the conversation panel. No disclaimers needed -- just make it work.
- **D-06:** Response input appears when a session has a pending question. After sending, show a loading state until the SDK response comes back.
- **D-07:** Must be dead-simple "just works" setup for Lenovo (Windows) and Mac. Research the best cross-platform approach during planning.
- **D-08:** Installing hooks on a remote machine must NOT affect CodeBox's existing configuration. Each machine has its own settings.json.
- **D-09:** The installer should handle: copying/downloading the hook script, configuring settings.json with the correct CodeBox server URL, and testing the connection.
- **D-10:** Progressive disclosure -- card gets a dismiss/X button (always visible). Conversation panel header gets the full toolbar: copy question, focus terminal, dismiss.
- **D-11:** Copy question copies the question text to clipboard with one click.
- **D-12:** Focus Terminal navigates to the right tmux window/pane. Research the best approach for mapping sessions to tmux during planning.
- **D-13:** PostToolUse hooks send tool name and target (e.g., "Edit: src/auth.ts", "Bash: npm test") to the server. Server updates the session with currentTool and currentTarget fields. Card renders these in real-time.
- **D-14:** SessionStart hooks register new sessions immediately when Claude Code launches. Card appears within 1 second.
- **D-15:** Question events (Notification hooks) include the actual question text in the payload when available. Server stores in session's questionText field.

### Claude's Discretion
- PostToolUse debounce strategy (hooks fire frequently -- may need throttling)
- How to detect tmux session/window for "Focus Terminal"
- Hook installer technical approach (web page vs CLI vs hybrid)
- SessionStart hook implementation details (which Claude Code event to use)
- How to handle SDK session reading for remote machines (Lenovo/Mac sessions won't have local JSONL files)

### Deferred Ideas (OUT OF SCOPE)
- Manager AI summaries -- Phase 7 scope
- Remote machine SDK session reading -- SDK only reads local JSONL files. Remote sessions need SSH or file sync. Future enhancement.
- Multi-response threading -- Having a full back-and-forth conversation from the dashboard (not just one reply). Future if SDK supports it well.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-05 | PostToolUse hooks fire for tool activity tracking (which tool, file being edited) | PostToolUse stdin includes `tool_name` and `tool_input` fields. `tool_input` contains `file_path` for Edit/Write, `command` for Bash. Matcher supports `Bash\|Edit\|Write\|Read\|Glob\|Grep`. See Hook Payload Details. |
| HOOK-06 | SessionStart hooks register new sessions with the server | SessionStart fires on `startup`, `resume`, `clear`, `compact`. Provides `session_id`, `cwd`, `source`, `model`. See Hook Payload Details. |
| HOOK-07 | Server provides a `/hooks/install` endpoint that generates ready-to-paste config for any machine | settings.json at `~/.claude/settings.json` on all platforms. CJS hook script is cross-platform. See Cross-Platform Hook Installation. |
| HOOK-08 | Question events display the actual question text in the session card | Notification hook stdin includes `message` field with notification text. Capture from `idle_prompt` and `elicitation_dialog` matchers. See Hook Payload Details. |
| INT-01 | Question session cards show a "Focus Terminal" button to jump to the right tmux window | Sessions on CodeBox run in VS Code, not tmux. `/proc/<pid>/cwd` maps processes to directories. Recommend cwd-copy approach instead of true terminal focus. See Focus Terminal Analysis. |
| INT-02 | User can dismiss/acknowledge sessions from the dashboard | Client-side: remove card from carousel, server-side: update session status to 'dismissed'. Emit session:remove SSE. See Session Actions. |
| INT-03 | User can copy question text to clipboard from the dashboard | `navigator.clipboard.writeText()` API. Question text stored in session's `questionText` field (from Notification hook `message`). See Session Actions. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | 0.2.88 | Session listing, message reading, response relay | Already installed from Phase 5; SDK provides listSessions, getSessionMessages, resumeSession |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- all Node.js built-ins) | - | HTTP server, file I/O, child_process | Everything else uses existing infrastructure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single CJS hook script with type arg | Separate scripts per hook event | Single script is simpler to deploy cross-platform; type passed as CLI arg |
| Server-generated install instructions | npm package / installer binary | Instructions approach is simpler, no publish step, user copies 3 commands |
| Client-side dismiss (hide card) | Server-side session deletion | Client-side is simpler; session stays in store for potential undo |

## Architecture Patterns

### Pattern 1: Unified Hook Script with Event Routing

**What:** A single `notify-trigger.cjs` script that handles all hook events (Stop, Notification, PostToolUse, SessionStart) with the event type passed as CLI argument. The script reads stdin, extracts event-specific fields, and POSTs a rich JSON payload to the server.

**When to use:** All hook configurations point to this one script.

**Example:**
```javascript
// hooks/notify-trigger.cjs — unified hook for all events
// Usage: node notify-trigger.cjs <done|question|tool|session-start>

const type = process.argv[2] || 'done';

// Read stdin (Claude Code provides JSON)
let stdinDone = false;
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let hookInput = {};
  try { hookInput = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}
  sendNotification(hookInput);
});

function sendNotification(hookInput) {
  if (stdinDone) return;
  stdinDone = true;

  const sessionId = hookInput.session_id || 'unknown';
  const cwd = hookInput.cwd || process.cwd();

  // Build payload based on event type
  const payload = {
    type,
    sessionId,
    machine: os.hostname(),
    cwd,
    timestamp: new Date().toISOString()
  };

  // Event-specific enrichment
  if (type === 'tool') {
    payload.toolName = hookInput.tool_name || '';
    payload.toolInput = hookInput.tool_input || {};
  } else if (type === 'session-start') {
    payload.source = hookInput.source || 'startup';
    payload.model = hookInput.model || '';
  } else if (type === 'question') {
    payload.questionText = hookInput.message || '';
  }

  // ... resolve project name, POST to server
}
```

### Pattern 2: Enhanced Trigger Endpoint

**What:** The `/trigger` POST endpoint accepts enriched payloads with new fields: `toolName`, `toolInput`, `questionText`, `source`. The `upsertSession()` function stores these in session state.

**When to use:** All hook events POST to `/trigger`.

**Example:**
```javascript
// In server.js /trigger handler
const { type, project, sessionId, machine, cwd, timestamp,
        toolName, toolInput, questionText, source } = JSON.parse(body);

// Route by type
if (type === 'tool') {
  // Extract human-readable target from tool_input
  const target = extractToolTarget(toolName, toolInput);
  upsertSession({
    sessionId, project, machine, cwd, type: 'tool',
    currentTool: toolName,
    currentTarget: target
  });
  // No notification -- just session state update
} else if (type === 'session-start') {
  upsertSession({
    sessionId, project, machine, cwd, type: 'session-start',
    source
  });
} else {
  // done or question -- existing flow
  upsertSession({ sessionId, project, machine, cwd, type, questionText });
  // Voice/push/toast notification
  emit('trigger', { type, project, machine, sessionId, timestamp });
  pushToAll(type, project);
  generateCached(type, project, () => {});
}
```

### Pattern 3: Tool Target Extraction

**What:** Convert raw `tool_input` into human-readable target strings for display on session cards.

**When to use:** PostToolUse events arriving at the server.

**Example:**
```javascript
function extractToolTarget(toolName, toolInput) {
  if (!toolInput) return '';
  switch (toolName) {
    case 'Edit':
    case 'Write':
    case 'Read':
    case 'MultiEdit':
      // file_path is the primary input
      return toolInput.file_path
        ? toolInput.file_path.split('/').slice(-2).join('/')
        : '';
    case 'Bash':
      // command, truncated
      return toolInput.command
        ? toolInput.command.substring(0, 60)
        : '';
    case 'Glob':
      return toolInput.pattern || '';
    case 'Grep':
      return toolInput.pattern || '';
    case 'WebSearch':
      return toolInput.query || '';
    case 'WebFetch':
      return toolInput.url || '';
    default:
      return '';
  }
}
```

### Pattern 4: Hook Install Endpoint

**What:** A `/hooks/install` GET endpoint that returns platform-specific setup instructions and a pre-configured settings.json snippet.

**When to use:** When setting up hooks on a new machine (Lenovo, Mac).

**Example:**
```javascript
// GET /hooks/install?platform=windows|macos|linux
// Returns JSON with:
// - settingsJson: the hooks object to merge into settings.json
// - scriptUrl: URL to download the hook script
// - instructions: step-by-step setup text

const serverUrl = `http://${req.headers.host}`;

const hooksConfig = {
  Stop: [{
    hooks: [{
      type: "command",
      command: `node "${hookScriptPath}" done`,
      timeout: 5
    }]
  }],
  Notification: [
    { matcher: "idle_prompt", hooks: [{ type: "command", command: `node "${hookScriptPath}" question`, timeout: 5 }] },
    { matcher: "elicitation_dialog", hooks: [{ type: "command", command: `node "${hookScriptPath}" question`, timeout: 5 }] }
  ],
  PostToolUse: [{
    matcher: "Bash|Edit|Write|Read|MultiEdit",
    hooks: [{
      type: "command",
      command: `node "${hookScriptPath}" tool`,
      timeout: 3
    }]
  }],
  SessionStart: [{
    hooks: [{
      type: "command",
      command: `node "${hookScriptPath}" session-start`,
      timeout: 3
    }]
  }]
};
```

### Anti-Patterns to Avoid
- **Sending full tool_input to the server:** tool_input for Bash includes the entire command string; for Write, it includes file content. Only extract what is needed (file_path, truncated command). Keep payloads small.
- **Generating notifications for PostToolUse events:** Tool activity is a session state update, NOT a notification. Do not trigger voice/push/toast for tool events.
- **Modifying CodeBox's settings.json from the install endpoint:** D-08 explicitly forbids this. The endpoint generates instructions for the remote machine only.
- **Blocking on PostToolUse hooks:** Use short timeouts (3s). PostToolUse fires after EVERY tool call. A slow hook blocks Claude's next action.

## Hook Payload Details

### PostToolUse Stdin (verified from official docs)
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/user/project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

**Key fields for this phase:**
- `tool_name`: The tool that was used (Edit, Write, Bash, Read, Glob, Grep, etc.)
- `tool_input`: Tool-specific input object. Contains `file_path` for file tools, `command` for Bash, `pattern` for Glob/Grep.
- `session_id`: UUID to match with server session
- `cwd`: Working directory of the Claude Code session

**Matcher:** Supports regex-style patterns: `"Bash|Edit|Write|Read|MultiEdit|Glob|Grep"`. Can also match MCP tools: `"mcp__server__tool"`.

### SessionStart Stdin (verified from official docs)
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/user/project",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6"
}
```

**Key fields:**
- `source`: How the session started. Values: `"startup"` (new session), `"resume"` (--resume/--continue), `"clear"` (/clear), `"compact"` (auto/manual compaction)
- `model`: Model identifier
- `session_id`: UUID for the new session

**Matcher:** Matches on source value: `"startup"`, `"resume"`, `"clear"`, `"compact"`. Omit matcher to fire on all.

### Notification Stdin (verified from official docs)
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/user/project",
  "hook_event_name": "Notification",
  "message": "Claude needs your permission to use Bash",
  "title": "Permission needed",
  "notification_type": "permission_prompt"
}
```

**Key fields for HOOK-08:**
- `message`: The notification text. For `idle_prompt`, this contains the question Claude asked. For `elicitation_dialog`, this contains the MCP dialog text.
- `notification_type`: Matches the matcher value

### Stop Stdin (existing, for reference)
```json
{
  "session_id": "abc123",
  "cwd": "/Users/user/project",
  "hook_event_name": "Stop",
  "stop_hook_active": true,
  "last_assistant_message": "I've completed the refactoring..."
}
```

## PostToolUse Volume and Debounce Strategy

**Event frequency:** PostToolUse fires after EVERY tool call. During active coding, Claude may use 5-20 tools per minute (Read, Edit, Bash, Grep in rapid succession). During heavy refactoring, bursts of 10+ edits in seconds are common.

**Debounce recommendation:** Server-side debounce per session, NOT per tool call.

Strategy:
1. **Hook side:** Fire every time (no hook-side debounce). Keep the hook fast (<100ms). Use `async: true` in the hook config if available, but note that PostToolUse cannot be async (it runs synchronously after each tool).
2. **Hook timeout:** Set to 3 seconds. If the hook takes longer, Claude Code kills it and continues.
3. **Server side:** Accept all events but debounce SSE emissions. For session:update events caused by tool activity, batch updates: store the latest tool state, emit at most once per second per session.
4. **Card rendering:** The frontend already uses innerHTML re-render on session:update. No additional debounce needed -- the SSE debounce handles it.

**Implementation:**
```javascript
// Server-side: debounce tool updates per session
const toolUpdateTimers = new Map();

function handleToolUpdate(sessionId, toolName, target) {
  // Always store latest state immediately
  const session = sessions.get(sessionId);
  if (session) {
    session.currentTool = toolName;
    session.currentTarget = target;
    session.lastActivity = Date.now();
    session.status = 'working';
  }

  // Debounce SSE emission to max 1/second per session
  if (!toolUpdateTimers.has(sessionId)) {
    toolUpdateTimers.set(sessionId, setTimeout(() => {
      toolUpdateTimers.delete(sessionId);
      emit('session:update', sessionDelta(session));
    }, 1000));
  }
}
```

## Cross-Platform Hook Installation

### Settings.json Locations (verified)

| Platform | Path | Notes |
|----------|------|-------|
| Linux | `~/.claude/settings.json` | CodeBox (already configured) |
| macOS | `~/.claude/settings.json` | Mac (CPR MacBook) |
| Windows | `%USERPROFILE%\.claude\settings.json` | Lenovo. `~` resolves to `C:\Users\<username>` |

All platforms use the same `~/.claude/settings.json` user scope.

### Hook Script Deployment Strategy

The hook script (`notify-trigger.cjs`) uses CommonJS (`require`) and Node.js built-ins only. It runs on any platform with Node.js installed.

**Installation approach: Server-generated instructions page**

1. **`GET /hooks/install`** returns an HTML page with:
   - Detected platform (from User-Agent) or manual platform selector
   - The hook script content (downloadable or copy-paste)
   - The settings.json hooks snippet with the correct server URL baked in
   - Step-by-step instructions: (a) save script, (b) merge hooks into settings.json, (c) test with `curl`

2. **`GET /hooks/script`** serves the raw `notify-trigger.cjs` file for download via `curl` or browser.

3. **`GET /hooks/test`** accepts a test ping from a remote hook to verify connectivity.

**Why instructions page, not automated installer:**
- No SSH access from server to remote machines
- The user (with physical access) runs 3 commands
- No security risk of remote code execution
- Works on any OS with Node.js + curl

### Per-Platform Instructions

**macOS (Mac):**
```bash
# 1. Download hook script
curl -o ~/.claude/hooks/notify-trigger.cjs http://100.123.116.23:3099/hooks/script

# 2. Merge hooks into settings.json (jq or manual)
# Show the JSON snippet to merge

# 3. Test
node ~/.claude/hooks/notify-trigger.cjs done <<< '{"session_id":"test","cwd":"/tmp"}'
```

**Windows (Lenovo):**
```powershell
# 1. Download hook script
Invoke-WebRequest -Uri "http://100.123.116.23:3099/hooks/script" -OutFile "$env:USERPROFILE\.claude\hooks\notify-trigger.cjs"

# 2. Merge hooks into settings.json (manual or PowerShell)
# Show the JSON snippet to merge

# 3. Test
echo '{"session_id":"test","cwd":"C:\\temp"}' | node "$env:USERPROFILE\.claude\hooks\notify-trigger.cjs" done
```

### Windows-Specific Considerations

- **Shell:** Windows hooks default to `bash` shell. If Git Bash is installed, this works. Otherwise, use `"shell": "powershell"` in the hook config.
- **Path separators:** `tool_input.file_path` uses backslashes on Windows. The `extractToolTarget()` function must handle both `/` and `\`.
- **Server URL:** Lenovo connects via Tailscale IP `100.123.116.23:3099`. LAN IP `192.168.1.122` may not be reachable from Lenovo when remote.
- **Node.js required:** Both Lenovo and Mac must have Node.js installed. Check with `node --version` in the instructions page.

## Focus Terminal Analysis

**Problem:** D-12 says "Focus Terminal navigates to the right tmux window/pane."

**Reality on CodeBox:** Claude Code sessions run inside VS Code integrated terminals (verified by `ps aux` showing `--output-format stream-json` and VS Code server paths). They do NOT run in tmux panes. The existing tmux session (`windsurf-dev`) has only one bash pane.

**Process-to-cwd mapping is possible:**
```bash
# Linux: read /proc/<pid>/cwd symlink
readlink /proc/684078/cwd
# Output: /home/faxas/workspaces/projects/clients/carcraft_2
```

This allows the server to determine which Claude Code process is working in which directory. However, there is no API to focus a specific VS Code terminal tab from an external process.

**Recommendation for INT-01:**
1. **Show session cwd** prominently in the conversation panel header
2. **"Copy Path" button** copies the cwd to clipboard (user can Cmd+P in VS Code to navigate)
3. **For tmux users (future):** If sessions are detected in tmux panes (via `tmux list-panes -a -F` with pid matching), show a "Focus" button that runs `tmux select-window -t <target>` and `tmux select-pane -t <target>`
4. **Current implementation:** Button label says "Copy Path" instead of "Focus Terminal". The underlying data (session cwd) is already available from hooks.

This satisfies the spirit of INT-01 (quickly navigate to the right terminal) without promising functionality that is not achievable for VS Code sessions.

## Session Actions

### Dismiss (INT-02)

**Server-side:**
- Add `DELETE /sessions/:id` or `POST /sessions/:id/dismiss` endpoint
- Update session status to `'dismissed'`
- Emit `session:remove` SSE event
- Session removed from active display but can be retained in store briefly for undo

**Client-side:**
- X button on session card (always visible per D-10)
- Card slides out of carousel
- Embla `reInit()` after removal
- If dismissed session was selected, clear conversation panel

### Copy Question (INT-03)

**Implementation:**
```javascript
// In conversation panel header toolbar
async function copyQuestion(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.questionText) return;
  try {
    await navigator.clipboard.writeText(session.questionText);
    dispatch('toast', { type: 'done', message: 'Question copied to clipboard' });
  } catch (e) {
    // Fallback for non-HTTPS contexts (LAN access)
    const textarea = document.createElement('textarea');
    textarea.value = session.questionText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
```

**Note:** `navigator.clipboard.writeText()` requires HTTPS or localhost. Since the dashboard is accessed via `http://192.168.1.122:3099` (not HTTPS), the fallback `document.execCommand('copy')` is needed for LAN access. Tailscale HTTPS (`https://codebox.tail....`) would work natively.

## SDK Session Matching (D-01, D-02)

### Matching Strategy

Two approaches, used progressively:

1. **SessionStart hook provides exact session_id** (D-02): When SessionStart fires, the hook sends `session_id` to the server. The server's session store already has this ID from the hook. The SDK's `listSessions()` returns sessions with the same `sessionId`. Direct match.

2. **Fallback: match by cwd** (D-01): For sessions started before SessionStart hooks are installed, or remote sessions without SDK access. The hook provides `cwd`. The SDK's `listSessions()` returns sessions with `cwd`. Find the most recent SDK session whose `cwd` matches the hook session's `cwd`.

### Implementation in sdk-bridge.js

```javascript
// Enhanced getSdkSessions to support cwd-based lookup
export async function findSdkSessionForCwd(targetCwd) {
  try {
    const sessions = await listSessions({ limit: 50 });
    // Find most recent session matching the cwd
    return sessions
      .filter(s => s.cwd === targetCwd)
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))[0] || null;
  } catch (e) {
    return null;
  }
}
```

### Remote Sessions (Claude's Discretion)

SDK only reads local JSONL files (`~/.claude/projects/`). Sessions from Lenovo and Mac are visible through hooks but their conversation transcripts are NOT readable via SDK on CodeBox.

**Approach:** When a remote session is selected, show: "Conversation not available -- session is running on [machine name]. View from that machine's dashboard."

This is explicitly deferred per CONTEXT.md deferred ideas.

## Sessions.js Enhancements

New fields needed in the session store:

```javascript
// Enhanced session object
{
  sessionId: 'abc123',
  project: 'Voice Notifications',
  machine: 'codebox',
  cwd: '/home/faxas/workspaces/projects/personal/voice_notifications',
  status: 'working',           // existing
  firstSeen: 1711800000000,    // existing
  lastActivity: 1711800060000, // existing
  lastEventType: 'tool',      // existing (expanded values)
  eventCount: 42,              // existing
  events: [...],               // existing
  questionText: null,          // existing (now populated from Notification.message)
  questionTimestamp: null,     // existing

  // NEW fields for Phase 6
  currentTool: 'Edit',         // from PostToolUse tool_name
  currentTarget: 'src/auth.ts', // extracted from tool_input
  source: 'startup',           // from SessionStart source field
  sdkSessionId: null,          // exact SDK session ID (from SessionStart or match)
  dismissed: false              // for INT-02
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool input parsing per tool type | Generic JSON stringifier | `extractToolTarget()` switch on tool_name | Each tool has different input structure; need readable labels not raw JSON |
| Cross-platform path normalization | Custom path parser | `path.basename()` + split on both `/` and `\` | Node.js handles most of this; just need to handle display |
| Settings.json merging | Full JSON deep merge | Instruct user to copy the hooks object; provide jq one-liner | The hooks key is additive; no complex merging needed |
| Session-to-SDK matching | Filesystem walk of ~/.claude | SDK's `listSessions()` with cwd filter | SDK handles encoded project paths and index parsing |
| Clipboard API | Custom implementation | `navigator.clipboard.writeText()` + execCommand fallback | Standard browser API with well-known fallback pattern |

## Common Pitfalls

### Pitfall 1: PostToolUse Hook Blocks Claude
**What goes wrong:** Hook takes too long, Claude Code waits 3+ seconds between every tool call.
**Why it happens:** PostToolUse runs synchronously. Network request to server has latency.
**How to avoid:** Set `timeout: 3` in hook config. Use fire-and-forget HTTP request in the hook (write and end immediately, don't wait for response). The existing hook already exits on timeout.
**Warning signs:** Claude Code feels sluggish, especially on remote machines with higher latency to CodeBox.

### Pitfall 2: Infinite Hook Loop with SessionStart
**What goes wrong:** SessionStart hook triggers a server update, which... no, this one is safe. SessionStart hooks don't cause re-entry.
**Actual risk:** The `stop_hook_active` guard in the existing hook prevents Stop hook loops. SessionStart has no equivalent -- but since SessionStart hooks don't cause Claude to continue responding, there is no loop risk. No guard needed.

### Pitfall 3: Question Text Not Available in Notification Hook
**What goes wrong:** The `message` field in Notification hooks may not contain the actual question Claude asked. It may contain a generic string like "Claude needs your input."
**Why it happens:** The `message` field is the notification text, not the conversation content. For `idle_prompt`, the message may be generic.
**How to avoid:** Use the Notification `message` as a best-effort capture. For the authoritative question text, fall back to the SDK: `getSessionMessages()` returns the last assistant message which contains the actual question. The Stop hook's `last_assistant_message` field is another source but only fires on Stop, not on questions.
**Warning signs:** Question cards show generic text like "Permission needed" instead of the actual question.

### Pitfall 4: Hook Script Path Differences on Windows
**What goes wrong:** Hook command uses forward slashes in path, Windows can't find the script.
**Why it happens:** Windows requires backslashes in some contexts, but Node.js generally handles both.
**How to avoid:** Use double-quoted paths in the settings.json command. Node.js resolves both slash types. Test on Windows before releasing installer.
**Warning signs:** "ENOENT" errors in Claude Code hook output.

### Pitfall 5: Clipboard API Fails on HTTP (Non-HTTPS)
**What goes wrong:** `navigator.clipboard.writeText()` throws a SecurityError on `http://192.168.1.122:3099`.
**Why it happens:** Clipboard API requires secure context (HTTPS or localhost). LAN HTTP access is not secure context.
**How to avoid:** Always include the `document.execCommand('copy')` fallback. Test on the actual LAN URL, not just localhost.
**Warning signs:** "Copy question" button does nothing on LAN access, works on localhost.

### Pitfall 6: SDK Version Mismatch
**What goes wrong:** `unstable_v2_resumeSession` import fails or API signature changed.
**Why it happens:** SDK is at 0.2.88 (unstable); API changes between minor versions.
**How to avoid:** Pin SDK version in package.json. The existing `sdk-bridge.js` abstraction layer isolates the rest of the system. If the API changes, only `sdk-bridge.js` needs updating.
**Warning signs:** Server crash on startup with import error or "is not a function" error.

## Code Examples

### Hook Configuration for settings.json (CodeBox)
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs\" done",
        "timeout": 5
      }]
    }],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [{
          "type": "command",
          "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs\" question",
          "timeout": 5
        }]
      },
      {
        "matcher": "elicitation_dialog",
        "hooks": [{
          "type": "command",
          "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs\" question",
          "timeout": 5
        }]
      }
    ],
    "PostToolUse": [{
      "matcher": "Bash|Edit|Write|Read|MultiEdit|Glob|Grep",
      "hooks": [{
        "type": "command",
        "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs\" tool",
        "timeout": 3
      }]
    }],
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.cjs\" session-start",
        "timeout": 3
      }]
    }]
  }
}
```

### Enhanced Hook Script Payload for PostToolUse
```javascript
// In notify-trigger.cjs, inside sendNotification()
if (type === 'tool') {
  payload.toolName = hookInput.tool_name || '';
  // Only send what we need, not full tool_input (which may contain file content)
  const ti = hookInput.tool_input || {};
  payload.toolTarget = ti.file_path || ti.command?.substring(0, 100) || ti.pattern || ti.query || ti.url || '';
}
```

### Dismiss Session Endpoint
```javascript
// POST /sessions/:id/dismiss
} else if (/^\/sessions\/([^/]+)\/dismiss$/.test(pathname) && req.method === 'POST') {
  const id = decodeURIComponent(pathname.match(/^\/sessions\/([^/]+)\/dismiss$/)[1]);
  const session = getSession(id);
  if (session) {
    session.status = 'dismissed';
    sessions.delete(id);
    emit('session:remove', { sessionId: id });
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
  }
```

### Session Card with Tool Activity
```javascript
// In sessions.js renderCard(), add currentTool display
const toolLine = session.currentTool
  ? `<div class="session-tool">
       <span class="tool-icon">${getToolIcon(session.currentTool)}</span>
       <span class="tool-label">${escapeHtml(session.currentTool)}: ${escapeHtml(session.currentTarget || '')}</span>
     </div>`
  : '';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hook sends type + project only | Hook sends type + project + tool_name + tool_input + message | Phase 6 (this phase) | Real-time tool activity on cards |
| Sessions only created on Stop/Notification | Sessions created on SessionStart too | Phase 6 (this phase) | Cards appear instantly on session launch |
| Generic "needs attention" text | Actual question text from Notification.message | Phase 6 (this phase) | Users see what Claude is asking |
| Hooks only on CodeBox | Hooks on CodeBox + Lenovo + Mac | Phase 6 (this phase) | True multi-machine dashboard |

## Open Questions

1. **Does the Notification `message` field contain the actual Claude question for `idle_prompt`?**
   - What we know: The docs say `message` is "Notification text content." For `permission_prompt`, the example shows "Claude needs your permission to use Bash." This is a UI notification string, not the conversation content.
   - What's unclear: For `idle_prompt`, is the `message` the actual question Claude asked, or is it a generic "Claude is waiting for input" string?
   - Recommendation: Test empirically. If `message` is generic, fall back to extracting the question from `getSessionMessages()` (last assistant message) when a question event fires. The Stop hook's `last_assistant_message` field is NOT available on Notification hooks.

2. **Will PostToolUse hooks with 3s timeout cause perceptible latency?**
   - What we know: The hook makes an HTTP POST to localhost (CodeBox to CodeBox). Local network latency is <1ms. The hook script starts Node.js (cold start ~50ms), reads stdin, POSTs, and exits.
   - What's unclear: Whether 50-100ms per tool call adds up to noticeable slowness when Claude does 10 rapid tool calls.
   - Recommendation: Implement and measure. If too slow, consider making the hook use `async: true` in the config (if supported for PostToolUse). Alternatively, batch multiple tool events into a single POST if they arrive within 200ms.

3. **How do existing GSD hooks in settings.json interact with new hooks?**
   - What we know: settings.json already has SessionStart (gsd-check-update.js), PostToolUse (gsd-context-monitor.js), and PreToolUse (gsd-prompt-guard.js) hooks. Hook arrays support multiple entries -- they all run.
   - What's unclear: Whether multiple hooks in the same event array run sequentially or in parallel. Whether a slow hook blocks subsequent hooks.
   - Recommendation: Add the notification hooks as additional entries in the existing arrays. The existing GSD hooks are fast (timeout 5-10s). Test that both fire reliably.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server + hooks + SDK | Yes | v24 | -- |
| @anthropic-ai/claude-agent-sdk | SDK integration | Yes (installed Phase 5) | 0.2.88 | -- |
| Python 3 + edge-tts | TTS (existing) | Yes | existing | -- |
| Node.js on Mac | Remote hooks | Needs verification | -- | Install via brew |
| Node.js on Lenovo | Remote hooks | Needs verification | -- | Install via nvm-windows |
| Tailscale | Remote connectivity | Yes (all machines) | -- | LAN (local only) |

**Missing dependencies with no fallback:**
- None on CodeBox

**Missing dependencies with fallback:**
- Node.js on remote machines: If not installed, the install page shows how to install it first

## Project Constraints (from CLAUDE.md)

- Use **pnpm** for package management
- No build step -- direct Node.js execution
- Plain JavaScript only, no TypeScript
- ES modules for server code (`"type": "module"`)
- **CJS for hook scripts** -- hooks use `require()` (CommonJS) because Claude Code may not support ESM hook scripts in all environments
- 2-space indentation
- camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- JSON responses use `{ ok: true/false }` pattern
- Silent error swallowing for non-critical operations
- GSD workflow enforcement

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Complete PostToolUse, SessionStart, Notification, Stop event schemas with stdin/stdout formats
- [Claude Code Settings](https://code.claude.com/docs/en/settings) - settings.json locations per platform, scope hierarchy
- `~/.claude/settings.json` (CodeBox) - Verified existing hook configuration with SessionStart and PostToolUse entries
- `hooks/notify-trigger.cjs` - Existing hook script, base for enhancement
- `sdk-bridge.js` - Current SDK abstraction layer
- `sessions.js` - Current session store with upsertSession pattern

### Secondary (MEDIUM confidence)
- Process-to-cwd mapping via `/proc/<pid>/cwd` - Verified working on CodeBox Linux
- npm registry: `@anthropic-ai/claude-agent-sdk` version 0.2.88 - Verified 2026-03-30
- Phase 5 Research - SDK V2 resumeSession behavior and limitations

### Tertiary (LOW confidence)
- Notification `message` field content for `idle_prompt` events - docs show permission_prompt example only; idle_prompt message content unverified
- PostToolUse latency impact at high tool volume - theoretical analysis, not measured
- Windows hook execution with bash shell vs powershell - not tested on actual Windows machine

## Metadata

**Confidence breakdown:**
- Hook payloads: HIGH - verified from official documentation with exact JSON schemas
- Session actions (dismiss, copy): HIGH - straightforward browser APIs and REST endpoints
- Cross-platform installation: MEDIUM - paths verified from docs, but Windows execution not tested
- PostToolUse debounce: MEDIUM - strategy is sound but volume/latency not measured
- Focus Terminal: LOW - VS Code sessions cannot be focused programmatically; recommend cwd-copy alternative
- SDK response relay: MEDIUM - established in Phase 5, same caveats apply (new subprocess, not IPC)

**Research date:** 2026-03-30
**Valid until:** 2026-04-15 (hook API is stable; SDK V2 may change)
