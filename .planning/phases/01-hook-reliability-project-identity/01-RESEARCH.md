# Phase 1: Hook Reliability + Project Identity - Research

**Researched:** 2026-03-27
**Domain:** Claude Code hooks, project name resolution, server-side deduplication
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 replaces the fragile dual-hook system (bash local + Node remote) with a single unified Node script that all machines use. The script sends rich JSON payloads via POST to the server, which applies debounce logic before triggering notifications. Project name resolution is simplified to folder-basename-with-override, removing CLAUDE.md and package.json parsing.

The most significant research finding is about **question detection** (HOOK-02). The user decision D-01 specifies using a "Notification hook" for question events, but Claude Code currently has **no dedicated AskUserQuestion notification type**. The available Notification matchers are `permission_prompt`, `idle_prompt`, `auth_success`, and `elicitation_dialog`. The `idle_prompt` fires after 60 seconds of inactivity (with reported unreliability). The best available approach for question detection is: use both the **Stop hook** (fires when Claude finishes a response, including when asking a question) and the **Notification hook with `idle_prompt` matcher** as a fallback. The Stop hook receives `stop_hook_active` and `last_assistant_message` fields that can help distinguish question vs. done events, though parsing `last_assistant_message` for question intent is heuristic. An alternative is to simply rely on the Notification hook with `idle_prompt` for all "needs attention" events, accepting the 60-second delay.

**Primary recommendation:** Use the Stop hook for both "done" and "question" detection. Differentiate by checking `last_assistant_message` content or accept a unified "needs attention" event type. Use Notification with `idle_prompt` as a safety net for cases the Stop hook misses (permission prompts, long idles).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Stop hook for "done" events and Notification hook for "question" events. Two separate hook event types in `.claude/settings.json`, both calling the same Node script with different type arguments.
- **D-02:** Hook payload is rich context -- not just type + project. Includes: machine identifier, session ID, timestamp, and working directory. This data pipeline supports the dashboard in Phase 3.
- **D-03:** Payload sent as POST with JSON body to `/trigger` endpoint (replaces current GET with query params).
- **D-04:** Default to folder basename, cleaned and title-cased (e.g., `voice_notifications` -> `Voice Notifications`). Current cleaning logic (camelCase split, hyphen/underscore to spaces, title case) is kept.
- **D-05:** Allow `.claude/project-display-name` file to override the folder basename. This is the only override -- remove CLAUDE.md parsing and package.json fallbacks from the resolution chain.
- **D-06:** Cache all resolved names in `.name-cache.json` with mtime validation. Even though basename is fast, cache covers the display-name override file read.
- **D-07:** Single `notify-trigger.js` Node script used on all machines (CodeBox, Lenovo, Mac). Retire `notify-done.sh` entirely.
- **D-08:** All hooks communicate via HTTP to the server (localhost on CodeBox, Tailscale IP on remote). No more direct file writes to trigger.json from hooks.
- **D-09:** Script distributed via git clone + symlink on each machine. Updates via `git pull`.
- **D-10:** Server-side debounce window of 3 seconds per unique key.
- **D-11:** Debounce key is `(type, project, sessionId)` -- allows two different sessions on the same project to fire simultaneously while preventing same-session duplicates.

### Claude's Discretion
- Server-side implementation of the debounce (in-memory map with TTL cleanup is fine, or any equivalent approach)
- How to extract session ID from Claude Code hook environment variables
- Error handling when server is unreachable from hooks (silent fail with exit 0, matching current behavior, is acceptable)
- Whether trigger.json is still needed or can be replaced entirely by in-memory state + SSE in Phase 2

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | Stop hook fires exactly once per Claude response completion, not randomly | Stop hook + server-side debounce (D-10, D-11); `stop_hook_active` field prevents infinite loops |
| HOOK-02 | AskUserQuestion hook fires when Claude asks a question | Notification hook with `idle_prompt` matcher (see Critical Finding below); no dedicated AskUserQuestion notification type exists |
| HOOK-03 | Hooks work correctly from subdirectories using absolute paths for `$CLAUDE_PROJECT_DIR` | `$CLAUDE_PROJECT_DIR` is available to all hooks as env var; hook script uses it to resolve project root |
| HOOK-04 | Local CodeBox hook resolves project name (not empty string) | Unified notify-trigger.js replaces notify-done.sh; folder basename always produces a name |
| PROJ-01 | Project name auto-resolved from folder basename (cleaned, title-cased) | cleanFolderName() logic retained; CLAUDE.md/package.json parsing removed per D-05 |
| PROJ-02 | Project name included in every notification (voice, push, toast) | POST payload includes project field; server stores in trigger state |
| PROJ-03 | Project name resolution works from CodeBox, Lenovo, and Mac | Single script (D-07) with VOICE_NOTIFY_URL env var per machine |
</phase_requirements>

## Critical Finding: Question Detection (HOOK-02)

**Confidence:** MEDIUM

The user decision D-01 references using a "Notification hook" for question events. Research reveals a significant ecosystem gap:

### What Exists
| Notification Matcher | What It Detects | Latency |
|---------------------|-----------------|---------|
| `permission_prompt` | Claude needs tool permission | Immediate |
| `idle_prompt` | Claude has been idle 60+ seconds | 60s delay |
| `auth_success` | Authentication completed | Immediate |
| `elicitation_dialog` | MCP server requests user input | Immediate |

### What Does NOT Exist
- No `ask_user_question` or `user_input_required` matcher
- No way to detect AskUserQuestion tool calls via Notification hook
- GitHub issues #10168, #12048, #13024, #13830 all request this -- still open as of March 2026

### Recommended Approach for D-01

Honor D-01 by using Notification hook with `idle_prompt` matcher for question events. This is the closest available match to "Claude needs your attention." The 60-second delay is acceptable because:
1. The voice notification system is for awareness, not instant response
2. The Stop hook catches the initial "done" events immediately
3. The `idle_prompt` acts as a "still waiting" reminder

**Hook configuration:**
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node /path/to/hooks/notify-trigger.js done",
          "timeout": 5
        }]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [{
          "type": "command",
          "command": "node /path/to/hooks/notify-trigger.js question",
          "timeout": 5
        }]
      }
    ]
  }
}
```

**Risk:** The `idle_prompt` matcher has reported unreliability (GitHub #8320). If it fires too frequently or not at all, the "question" notification channel may be noisy or silent. Server-side debounce (D-10) mitigates the noise case.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `http` | v24.12.0 | HTTP server and hook script HTTP client | Already in use; no dependencies needed |
| Node.js built-in `fs` | v24.12.0 | File I/O for config, cache, trigger | Already in use |
| Node.js built-in `child_process` | v24.12.0 | edge-tts subprocess | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `os` (Node built-in) | v24.12.0 | Machine identifier via `os.hostname()` | Rich payload (D-02) |
| `jq` (system) | 1.7 | Parse hook JSON input from stdin | Reading stdin JSON in hook script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `http.request` in hook | `fetch` (Node 24 native) | fetch is cleaner but adds async/await complexity to a script that must exit fast |
| `jq` for stdin parsing | Node.js `process.stdin` | Node script already running; can parse stdin directly without jq dependency |

**No installation needed.** This phase uses only Node.js built-ins and system tools already present.

## Architecture Patterns

### Recommended Changes to Project Structure
```
hooks/
  notify-trigger.js      # Unified hook script (refactored)
  .name-cache.json       # Project name cache (runtime, gitignored)
server.js                # Updated /trigger endpoint (POST + debounce)
data/
  trigger.json           # Keep for Phase 1 (browser polling still active)
  config.json            # Voice/template config (unchanged)
  cache/                 # WAV cache (unchanged)
```

### Pattern 1: Unified Hook Script with Stdin JSON Parsing
**What:** Single `notify-trigger.js` reads Claude Code's JSON input from stdin, extracts session_id and other fields, resolves project name, sends POST to server.
**When to use:** All hook invocations (Stop and Notification events).
**Example:**
```javascript
// Hook reads JSON from stdin (Claude Code provides this)
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let hookInput = {};
  try { hookInput = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}

  const sessionId = hookInput.session_id || 'unknown';
  const cwd = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const type = process.argv[2] || 'done';
  const machine = require('os').hostname();
  const project = resolveProjectName(cwd);

  const payload = JSON.stringify({
    type,
    project,
    sessionId,
    machine,
    cwd,
    timestamp: new Date().toISOString()
  });

  // POST to server
  const req = http.request(/* ... */);
  req.write(payload);
  req.end();
});
```

### Pattern 2: Server-Side Debounce Map
**What:** In-memory Map keyed by `${type}:${project}:${sessionId}` with timestamps. Reject triggers within 3-second window of the same key.
**When to use:** Every incoming `/trigger` POST request.
**Example:**
```javascript
const debounceMap = new Map();
const DEBOUNCE_MS = 3000;

function isDuplicate(type, project, sessionId) {
  const key = `${type}:${project}:${sessionId}`;
  const now = Date.now();
  const last = debounceMap.get(key);
  if (last && (now - last) < DEBOUNCE_MS) return true;
  debounceMap.set(key, now);
  return false;
}

// Periodic cleanup (every 60s, remove entries older than 30s)
setInterval(() => {
  const cutoff = Date.now() - 30000;
  for (const [key, ts] of debounceMap) {
    if (ts < cutoff) debounceMap.delete(key);
  }
}, 60000);
```

### Pattern 3: Simplified Project Name Resolution
**What:** Two-step resolution: (1) check `.claude/project-display-name`, (2) fall back to cleaned folder basename. No CLAUDE.md or package.json parsing.
**When to use:** Every hook invocation.
**Example:**
```javascript
function resolveProjectName(projectDir) {
  if (!projectDir) return 'Unknown';

  // Check cache first
  const cached = nameCache[projectDir];
  if (cached) {
    const displayNamePath = path.join(projectDir, '.claude', 'project-display-name');
    try {
      const currentMtime = fs.statSync(displayNamePath).mtimeMs;
      if (currentMtime <= cached.mtime) return cached.name;
    } catch(e) {
      // File doesn't exist; if cached from basename, still valid
      if (cached.source === 'basename') return cached.name;
    }
  }

  // 1. Display name override
  try {
    const name = fs.readFileSync(
      path.join(projectDir, '.claude', 'project-display-name'), 'utf8'
    ).trim();
    if (name) {
      nameCache[projectDir] = { name, mtime: Date.now(), source: 'file' };
      saveCache();
      return name;
    }
  } catch(e) {}

  // 2. Folder basename (always succeeds)
  const name = cleanFolderName(path.basename(projectDir));
  nameCache[projectDir] = { name, mtime: Date.now(), source: 'basename' };
  saveCache();
  return name || 'Unknown';
}
```

### Anti-Patterns to Avoid
- **Parsing CLAUDE.md for project names:** Fragile regex patterns break across different CLAUDE.md formats. Decision D-05 explicitly removes this.
- **Direct file writes from hooks:** Decision D-08 prohibits local hooks writing trigger.json directly. All hooks must go through HTTP.
- **GET with query params for triggers:** Decision D-03 requires POST with JSON body to support rich payloads.
- **Blocking on stdin read with no timeout:** The hook script must handle the case where stdin is empty or never closes. Use a short timeout or fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing from stdin | Custom character-by-character parser | `JSON.parse(Buffer.concat(chunks))` | Standard Node pattern; handles all edge cases |
| Hostname detection | Reading /etc/hostname or env vars | `require('os').hostname()` | Cross-platform (Linux, macOS, Windows) |
| HTTP POST from hook | Raw TCP socket | Node `http.request` with method POST | Handles encoding, headers, timeouts correctly |
| Debounce timing | setTimeout chains | Simple Map with timestamp comparison | No async complexity; O(1) lookup |

**Key insight:** This phase is mostly about wiring -- connecting Claude Code events to the server via HTTP. The complexity is in getting the lifecycle right (stdin parsing, silent failures, debounce), not in the algorithms.

## Common Pitfalls

### Pitfall 1: Stop Hook Infinite Loop
**What goes wrong:** Stop hook fires, sends notification to server, server responds, Claude processes the hook output, triggers another Stop event.
**Why it happens:** Stop hooks can return JSON that causes Claude to continue working, which triggers another Stop event.
**How to avoid:** Check `stop_hook_active` field in hook input JSON. If `true`, exit immediately with code 0. This is documented in official Claude Code docs.
**Warning signs:** Claude keeps working after every response in a loop.

### Pitfall 2: Stdin Not Available or Empty
**What goes wrong:** Hook script hangs waiting for stdin that never comes, or receives empty stdin.
**Why it happens:** Different Claude Code versions may or may not pipe JSON to stdin for all hook types. Historical bug #9567 reported empty environment variables.
**How to avoid:** Set a timeout on stdin reading (2 seconds max). Fall back to env vars (`CLAUDE_PROJECT_DIR`, `process.cwd()`) if stdin parsing fails. Always produce a valid payload even with partial data.
**Warning signs:** Hook hangs and Claude Code reports timeout.

### Pitfall 3: Hook Exit Code Semantics
**What goes wrong:** Hook exits with non-zero code, causing Claude to treat it as an error or block.
**Why it happens:** Unhandled exceptions, HTTP request failures, DNS resolution errors.
**How to avoid:** Wrap entire hook script in try-catch. Always `process.exit(0)` in all code paths including error handlers. Exit code 2 specifically blocks actions -- never use it in notification hooks.
**Warning signs:** Error messages in Claude Code verbose mode (Ctrl+O).

### Pitfall 4: Session ID Unavailability
**What goes wrong:** `session_id` field is missing from hook input, breaking debounce key generation.
**Why it happens:** Older Claude Code versions or specific edge cases may not provide session_id. Bug #9188 reported stale session_ids after `/exit` + `--continue`.
**How to avoid:** Use `session_id || 'unknown'` as fallback. Debounce still works -- it just treats all unknown-session events from the same project as one stream.
**Warning signs:** Multiple notifications firing when they shouldn't, or debounce being too aggressive.

### Pitfall 5: Server Unreachable During Hook Execution
**What goes wrong:** HTTP request to server hangs, causing hook to timeout and potentially block Claude Code.
**Why it happens:** Server down, network connectivity lost, Tailscale tunnel not established.
**How to avoid:** Set aggressive timeouts on HTTP requests (4 seconds max per current code). Destroy request on timeout. Always exit 0 regardless of success/failure.
**Warning signs:** Claude Code feels slow after responses.

### Pitfall 6: trigger.json Race Condition During Transition
**What goes wrong:** Phase 1 changes `/trigger` to POST but browser still polls `/check` which reads trigger.json. If trigger.json isn't updated, browser never sees new notifications.
**Why it happens:** The browser polling loop (Phase 2 replaces this with SSE) depends on trigger.json mtime changes.
**How to avoid:** Server's `/trigger` POST handler must still write trigger.json for backward compatibility with the existing browser UI. Phase 2 removes this dependency.
**Warning signs:** Server receives triggers but browser doesn't play audio.

## Code Examples

### Hook Script: Reading Stdin JSON (Verified Pattern)
```javascript
// Source: Claude Code hooks reference - https://code.claude.com/docs/en/hooks
// All hooks receive JSON on stdin with common fields
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}
  // input.session_id, input.cwd, input.hook_event_name available
});

// Timeout fallback in case stdin never closes
setTimeout(() => {
  // Proceed with whatever we have
  process.stdin.destroy();
}, 2000);
```

### Stop Hook: Preventing Infinite Loops
```javascript
// Source: Claude Code hooks guide - https://code.claude.com/docs/en/hooks-guide
// Check stop_hook_active to prevent re-triggering
process.stdin.on('end', () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  if (input.stop_hook_active) {
    process.exit(0); // Allow Claude to stop, don't re-trigger
  }
  // ... proceed with notification
});
```

### Server: POST Body Parsing
```javascript
// Replace GET query param parsing with POST JSON body parsing
// Current: parsed.query.type, parsed.query.project
// New:
if (parsed.pathname === '/trigger' && req.method === 'POST') {
  let body = '';
  req.on('data', c => {
    body += c;
    if (body.length > 4096) { req.destroy(); return; } // Size limit
  });
  req.on('end', () => {
    try {
      const { type, project, sessionId, machine, cwd, timestamp } = JSON.parse(body);
      if (isDuplicate(type, project, sessionId)) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: true, deduplicated: true }));
        return;
      }
      // ... existing trigger logic
    } catch(e) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  });
}
```

### Settings.json Hook Configuration
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.js\" done",
          "timeout": 5
        }]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [{
          "type": "command",
          "command": "node \"/home/faxas/workspaces/projects/personal/voice_notifications/hooks/notify-trigger.js\" question",
          "timeout": 5
        }]
      }
    ]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `url.parse(req.url, true)` | `new URL(req.url, 'http://localhost')` | Node 10+ | Deprecated API; should update in server.js |
| GET /trigger?type=X&project=Y | POST /trigger with JSON body | This phase (D-03) | Enables rich payloads for dashboard |
| Separate bash + Node hooks | Single Node hook for all machines | This phase (D-07) | Eliminates CodeBox empty-project bug |
| CLAUDE.md + package.json name parsing | .claude/project-display-name + basename | This phase (D-05) | Simpler, faster, more reliable |
| No stdin JSON parsing in hooks | Hooks receive JSON on stdin | Claude Code 2024+ | session_id, cwd, hook_event_name available |

**Deprecated/outdated:**
- `url.parse()`: Use `new URL()` instead. Should be updated when touching server.js routing code.
- `notify-done.sh`: Retired entirely in this phase (D-07).

## Open Questions

1. **idle_prompt Reliability**
   - What we know: The `idle_prompt` notification matcher should fire after 60 seconds of inactivity. Multiple GitHub issues report it firing too often or not at all.
   - What's unclear: Whether current Claude Code version (on CodeBox) fires `idle_prompt` reliably.
   - Recommendation: Implement it as designed (D-01). If testing reveals unreliability, consider also adding `permission_prompt` to the Notification matcher to catch permission-related question events. The debounce prevents duplicates if both fire.

2. **Stop Hook Fires for Sub-agents**
   - What we know: STATE.md notes "Stop hook fires for sub-agents -- debounce needed server-side (10s cooldown per project)." Decision D-10 sets 3-second debounce.
   - What's unclear: Whether 3 seconds is sufficient for sub-agent bursts, or if sub-agents produce different session_ids.
   - Recommendation: Start with 3 seconds as decided. The debounce key includes sessionId (D-11), so sub-agents with their own session_id won't be deduplicated against the main agent. If sub-agent noise is a problem, can tune the window later.

3. **trigger.json Retention**
   - What we know: Phase 2 replaces polling with SSE. trigger.json is the bridge between server state and browser polling.
   - What's unclear: Whether to keep trigger.json writes in Phase 1 or rely purely on in-memory state.
   - Recommendation: Keep trigger.json writes in Phase 1. The browser UI still polls /check which reads trigger.json. Removing it would break the UI until Phase 2 ships SSE.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Hook script + server | Yes | v24.12.0 | -- |
| Python 3 | edge-tts | Yes | 3.12.3 | -- |
| edge-tts | TTS generation | Yes | 7.2.8 | -- |
| jq | Optional stdin parsing | Yes | 1.7 | Node handles stdin parsing natively |
| PM2 | Server process management | Yes | (installed) | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Complete hook event types, JSON input schemas, matcher patterns, exit code semantics
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) - Setup walkthrough, Notification hook example, Stop hook `stop_hook_active` pattern
- [GitHub Issue #29494](https://github.com/anthropics/claude-code/issues/29494) - Confirmed `session_id` is available in Stop hook input JSON (closed/completed)
- [Hook Development SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/hook-development/SKILL.md) - Environment variables available to hooks

### Secondary (MEDIUM confidence)
- [GitHub Issue #10168](https://github.com/anthropics/claude-code/issues/10168) - Feature request for UserInputRequired hook (still open, 38 upvotes)
- [GitHub Issue #12048](https://github.com/anthropics/claude-code/issues/12048) - idle_prompt fires after every response (closed as duplicate)
- [GitHub Issue #13830](https://github.com/anthropics/claude-code/issues/13830) - AskUserQuestion notification request (closed as duplicate of #13024)
- [GitHub Issue #9188](https://github.com/anthropics/claude-code/issues/9188) - Stale session_id after /exit + --continue

### Tertiary (LOW confidence)
- [GitHub Issue #8320](https://github.com/anthropics/claude-code/issues/8320) - 60-second idle notifications not triggering (reliability concern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all Node.js built-ins verified on system
- Architecture: HIGH - Patterns are straightforward HTTP/JSON; well-understood domain
- Hook event mapping: MEDIUM - Stop hook is well-documented; Notification `idle_prompt` has known reliability concerns
- Pitfalls: HIGH - Well-documented in Claude Code issues and official docs

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (hooks API relatively stable; check for new notification types)
