# Architecture Patterns: Center Console Integration

**Domain:** Session command center for Claude Code notifications
**Researched:** 2026-03-28
**Overall confidence:** HIGH (based on existing codebase analysis + official Claude Code docs)

## Current Architecture Snapshot

The existing system is clean and well-separated:

```
Hook Scripts (remote/local)
    |
    | HTTP POST /trigger
    v
server.js (router, ~195 lines)
    |-- sse.js (event bus, emit/subscribe, 100-event buffer)
    |-- config.js (JSON file persistence, voice settings)
    |-- tts.js (edge-tts subprocess, WAV caching)
    |-- push.js (VAPID web push)
    |
    v
public/index.html (SPA, ~1400 lines)
    |-- Client-side Map() for sessions
    |-- SSE EventSource for real-time events
    |-- Activity feed (in-memory array, max 50)
    |-- Toast/audio notification playback
```

**Key observation:** Sessions exist only in the browser's memory. No server-side session state. No persistence. Reload = gone.

---

## 1. Session Data Model

### Current State

Sessions live in a client-side `Map()` keyed by `sessionId`. Each entry:

```javascript
{
  project: string,      // from hook
  machine: string,      // hostname
  status: 'working' | 'done' | 'attention' | 'stale',
  lastActivity: number, // Date.now()
  startedAt: number     // first seen
}
```

Status transitions are primitive: `trigger` event sets `done` or `attention`, `session:alive` sets `working`, a 5-minute timer sets `stale`, 30-minute timer deletes.

### Recommended: Server-Side Session Store

**Move sessions to the server.** Reasons:
1. Multiple browser tabs/clients should see the same session state
2. Session history must survive page reloads
3. Manager AI needs access without a browser
4. Cross-machine aggregation requires a single source of truth

**Proposed schema:**

```javascript
// sessions.js — new module
const sessions = new Map(); // sessionId -> Session

// Session object
{
  sessionId: string,        // from Claude Code (uuid)
  project: string,          // resolved project name
  machine: string,          // hostname
  cwd: string,              // working directory
  status: 'working' | 'done' | 'attention' | 'stale' | 'idle',
  firstSeen: number,        // timestamp
  lastActivity: number,     // timestamp of last event
  lastEventType: string,    // 'done', 'question', 'alive'
  eventCount: number,       // total events received
  events: Event[],          // recent event history (last N)
  lastMessage: string|null, // from Stop hook's last_assistant_message (future)
}

// Event object (stored per session, last 20)
{
  type: string,             // 'done', 'question', 'alive', 'start'
  timestamp: number,
  hookEvent: string|null,   // raw hook_event_name
}
```

**Status lifecycle (server-managed):**

```
SessionStart hook  -->  'working'
PostToolUse hook   -->  'working' (activity heartbeat)
Stop hook          -->  'done'
Notification hook  -->  'attention'
5 min no activity  -->  'stale'
30 min no activity -->  removed from active, archived
```

**New module:** `sessions.js`
**Modified:** `server.js` (route /trigger updates sessions, new endpoint /sessions returns state)
**Modified:** `public/index.html` (reads from server on load, SSE for updates)

### Confidence: HIGH
This is straightforward state management. The existing SSE bus already carries the right data.

---

## 2. Manager AI Integration

### Architecture Decision: API Calls, Not a Separate Process

The Manager AI should NOT be:
- A separate long-running Claude Code session (expensive, wasteful idle time)
- A separate Node.js process (unnecessary complexity)
- A persistent agent (overkill for status monitoring)

The Manager AI SHOULD be:
- **On-demand Claude API calls** triggered by specific conditions
- Called from the server when noteworthy events occur
- Results pushed to clients via SSE

**Why:** The Manager AI's job is summarization and pattern detection, not autonomous action. It observes and reports. An API call with context is the right abstraction.

### Integration Architecture

```
server.js
    |
    |-- sessions.js (session store)
    |-- manager.js  (NEW — AI monitoring layer)
    |       |
    |       |-- Triggers: session attention, periodic summary, user request
    |       |-- Input: session state snapshot, recent events
    |       |-- Output: status summary, recommendations, alerts
    |       |-- Method: claude -p --bare with structured JSON output
    |       |
    |       v
    |   Claude API (via Agent SDK CLI)
    |       |
    |       v
    |   SSE emit('manager:insight', { ... })
    |
    v
Browser (displays manager insights)
```

**Implementation approach:**

```javascript
// manager.js
import { exec } from 'child_process';

const COOLDOWN_MS = 30000; // Don't call AI more than once per 30s
let lastCall = 0;

export function analyzeSessionState(sessions, trigger) {
  const now = Date.now();
  if (now - lastCall < COOLDOWN_MS) return;
  lastCall = now;

  const snapshot = JSON.stringify({
    trigger, // what prompted this analysis
    sessions: Array.from(sessions.values()),
    timestamp: new Date().toISOString()
  });

  const prompt = `You are monitoring Claude Code sessions. Analyze this snapshot and provide a brief status report. Be concise — 1-2 sentences per notable session. Flag anything that needs user attention.`;

  exec(
    `echo '${snapshot}' | claude -p --bare --output-format json "${prompt}"`,
    { timeout: 30000 },
    (err, stdout) => {
      if (err) return;
      try {
        const result = JSON.parse(stdout);
        emit('manager:insight', { text: result.result, timestamp: now });
      } catch(e) {}
    }
  );
}
```

**Trigger conditions for Manager AI calls:**
1. Session enters 'attention' state (question asked)
2. User explicitly requests a status update (button click)
3. Periodic summary (every 5-10 minutes when sessions are active)
4. Anomaly: session stuck in 'working' for an unusual duration

**Cost control:** The Manager AI uses `claude -p --bare` which is a fresh invocation each time. With the 30-second cooldown and event-driven triggers, this means at most ~120 API calls per hour in heavy use, typically far fewer. Each call is small (session snapshot context).

**Alternative considered:** Using the Anthropic Messages API directly (via `fetch` to `api.anthropic.com`). This would be leaner than spawning a CLI process, but requires managing an API key. Since the user already has Claude Code with authentication configured, `claude -p` leverages existing auth. If latency becomes an issue, switch to direct API calls later.

### New module: `manager.js`
### Modified: `server.js` (import manager, call on trigger events)
### Modified: `public/index.html` (listen for `manager:insight` SSE events, display)

### Confidence: MEDIUM
The `claude -p --bare` approach works technically. Uncertainty is around:
- Whether the latency (2-5 seconds per call) is acceptable for the UX
- Whether the cost profile is reasonable with heavy multi-session use
- Whether structured output from `claude -p` is reliable enough for display

**Recommendation:** Build the Manager AI as Phase 3 or 4, after sessions and UI are solid. Keep it behind a feature flag. Start with user-triggered summaries only, then add automatic triggers.

---

## 3. Bidirectional Communication

### SSE + POST Is the Right Pattern (No WebSockets Needed)

The current SSE setup (server -> client) combined with regular HTTP POST (client -> server) is sufficient. This is the exact pattern MCP originally used and it works well for this use case.

**Why not WebSocket:**
- SSE already works, is simpler, auto-reconnects with `EventSource`
- The server already handles POST for /trigger, /select, /subscribe
- Adding WebSocket adds a parallel connection to maintain
- No need for sub-millisecond bidirectional latency

**Communication paths for Center Console features:**

```
User Action                    Path                          Server Action
-----------                    ----                          -------------
View sessions                  GET /sessions                 Return session store
Dismiss notification           POST /sessions/:id/dismiss    Update session status
Mark as seen                   POST /sessions/:id/seen       Clear attention flag
Request AI summary             POST /manager/analyze         Trigger manager.js
Send response to session       POST /sessions/:id/respond    (future - see below)

Server Event                   Path                          Client Action
------------                   ----                          -------------
New trigger                    SSE 'trigger'                 Update session card
Session state change           SSE 'session:update'          Re-render card
Manager insight                SSE 'manager:insight'         Show insight panel
Config change                  SSE 'config:updated'          Sync config
```

### "Respond to a Session" — The Hard Problem

Sending a response to a running Claude Code session is NOT currently possible through hooks or the CLI. Claude Code sessions are interactive terminal processes. The options:

1. **Copy-to-clipboard + notification** (pragmatic, Phase 1): The dashboard shows "Session X needs attention at Project Y." User clicks, gets a deep link or clipboard copy of the project path, then switches to their terminal. This is what v2.0 should ship.

2. **`claude -p --resume <session_id>`** (possible but limited): This continues a conversation in headless mode. It does NOT inject input into a running interactive session. It creates a new turn in the transcript. The running interactive session won't see it.

3. **Terminal multiplexer integration** (future, complex): Using tmux/screen to send keystrokes to the terminal pane running Claude Code. Technically possible (`tmux send-keys -t <pane> "response text" Enter`) but fragile and requires all sessions to run in tmux.

4. **Agent SDK with custom transport** (future, speculative): Using the TypeScript/Python Agent SDK to create sessions that accept input programmatically. This would require running Claude Code sessions via the SDK rather than the CLI, which is a fundamental architecture change.

**Recommendation:** Ship option 1 (copy + navigate) for v2.0. Explore option 3 as an optional enhancement if the user runs sessions in tmux (which is common on CodeBox). Do NOT pursue option 2 or 4 — they change the session model.

### New endpoints: `/sessions`, `/sessions/:id/dismiss`, `/sessions/:id/seen`, `/manager/analyze`
### Modified: `sse.js` (new event types: `session:update`, `manager:insight`)
### Modified: `public/index.html` (POST calls for user actions)

### Confidence: HIGH for SSE+POST pattern, MEDIUM for session response approach

---

## 4. Cross-Machine Hooks

### Current State

The hook script `hooks/notify-trigger.cjs` already works cross-machine. It:
- Reads JSON from stdin (Claude Code provides `session_id`, `cwd`, `hook_event_name`)
- Resolves project name from folder basename
- POSTs to `VOICE_NOTIFY_URL` (defaults to CodeBox's Tailscale IP)

**Problem:** The hook script must be copied to each machine manually. Claude Code settings must be configured per-machine.

### Recommended: Richer Hook Events

Currently only `Stop` and `Notification` events are hooked. With 21 lifecycle events now available in Claude Code, we should capture more:

**Priority hook events for the command center:**

| Hook Event | Value for Dashboard | Priority |
|------------|-------------------|----------|
| `SessionStart` | Know when sessions begin | HIGH |
| `Stop` | Know when Claude finishes (existing) | HIGH |
| `Notification` | Attention needed (existing) | HIGH |
| `PostToolUse` | Activity heartbeat, know Claude is working | MEDIUM |
| `SessionEnd` | Clean removal from dashboard | MEDIUM |
| `SubagentStart/Stop` | Track parallel agents | LOW |

**Updated hook payload (extend existing):**

```javascript
// hooks/notify-trigger.cjs additions
const payload = {
  type,                          // existing
  project,                       // existing
  sessionId,                     // existing
  machine: os.hostname(),        // existing
  cwd,                           // existing
  timestamp: new Date().toISOString(), // existing
  // NEW fields:
  hookEvent: hookInput.hook_event_name,  // raw event name
  lastMessage: hookInput.last_assistant_message || null, // from Stop event
  toolName: hookInput.tool_name || null,  // from PostToolUse
  agentType: hookInput.agent_type || null, // from subagent events
};
```

### Simplifying Deployment

**Option A: One-liner install script** (recommended)

```bash
# Install hook on any machine
curl -s http://100.123.116.23:3099/install-hook | bash
```

The server serves a shell script that:
1. Downloads `notify-trigger.cjs` to `~/.claude/hooks/`
2. Adds hook entries to `~/.claude/settings.json` (or creates it)
3. Tests connectivity to the server

**Option B: Server-side hook registration API**

Instead of hooks POSTing to the server, machines could register and the server could poll them. This inverts the model and is worse — hooks are push-based and low-latency.

**Recommendation:** Option A. Add a `/install-hook` endpoint to the server that serves a self-contained installer script. The hook file itself is already cross-platform (Node.js CJS).

### New endpoint: `/install-hook` (serves installer script)
### Modified: `hooks/notify-trigger.cjs` (richer payload, more hook events)
### New file: `hooks/claude-settings-snippet.json` (hook configuration template)

### Confidence: HIGH

---

## 5. UI Architecture

### Can a Single-File SPA Scale to a Command Center?

The current `public/index.html` is ~1400 lines: ~860 lines CSS, ~540 lines JavaScript. For a command center, expect 3-4x growth: ~4000-5000 lines total.

**Verdict: Split, but not into a framework.**

A 5000-line single file is manageable but painful for:
- Finding code sections (scrolling)
- Parallel development (merge conflicts)
- Testing individual components

A framework (React, Vue) would be overkill for:
- Single-user app
- No build step currently (and that's a strength)
- No component reuse across projects
- The existing vanilla JS works well

### Recommended: ES Module Split with Import Maps

```html
<!-- index.html — stays as the shell -->
<script type="importmap">
{
  "imports": {
    "./state.js": "./modules/state.js",
    "./sse.js": "./modules/sse.js",
    "./sessions.js": "./modules/sessions.js",
    "./feed.js": "./modules/feed.js",
    "./toasts.js": "./modules/toasts.js",
    "./config.js": "./modules/config-panel.js",
    "./manager.js": "./modules/manager-panel.js",
    "./audio.js": "./modules/audio.js"
  }
}
</script>
<script type="module" src="./modules/app.js"></script>
```

**Module structure:**

```
public/
  index.html          -- HTML shell + CSS (no JS)
  modules/
    app.js            -- Entry point, imports all modules
    state.js          -- Shared state (sessions Map, feed array, config)
    sse.js            -- SSE connection, event routing
    sessions.js       -- Session grid rendering, card templates
    feed.js           -- Activity feed rendering
    toasts.js         -- Toast notification system
    config-panel.js   -- Config sidebar
    manager-panel.js  -- Manager AI panel (NEW)
    audio.js          -- Voice playback
    utils.js          -- escapeHtml, formatDuration, etc.
```

**Why this approach:**
- No build step needed — browsers support ES modules natively
- Import maps let us use bare specifiers (cleaner imports)
- Each module is 150-400 lines — easy to navigate
- CSS stays in index.html (it's declarative, splitting it adds complexity without value)
- Server already serves static files from `public/`

**What needs to change in `server.js`:** Add a static file handler for `public/modules/*.js` files. Currently the server only serves `index.html` and `sw.js` explicitly. Need a general static file handler for the `public/` directory.

### Modified: `server.js` (add static file serving for public/ directory)
### Modified: `public/index.html` (extract JS into modules, keep HTML + CSS)
### New directory: `public/modules/` (8-10 JS modules)

### Confidence: HIGH
ES modules in browsers have been stable since 2018. Import maps are supported in all modern browsers.

---

## 6. Data Persistence

### What to Persist and How

| Data | Persist? | Store | Retention |
|------|----------|-------|-----------|
| Active sessions | In-memory Map | `sessions.js` | Until stale (30 min) |
| Session history | Yes | JSON file | 7 days rolling |
| Event log | Yes | JSON file | 24 hours rolling |
| Voice config | Yes (existing) | `config.json` | Forever |
| Push subscriptions | Yes (existing) | `subscriptions.json` | Forever |
| Manager AI insights | Yes | JSON file | 24 hours |
| TTS cache | Yes (existing) | WAV files | Forever |

### Use JSON Files, Not SQLite

**Reasoning:**
1. **Zero dependencies** — the project currently has only `web-push` as an npm dependency. Adding `better-sqlite3` requires native compilation (node-gyp, Python, C++). That's heavy for what we need.
2. **Node.js built-in SQLite is still experimental** — even in Node v25 it requires `--experimental-sqlite`. Not stable enough for production.
3. **Data volume is tiny** — even with 20 sessions and 1000 events/day, we're talking kilobytes. JSON file reads are sub-millisecond at this scale.
4. **Append-only patterns work** — event logs are append-only. Session snapshots are small. JSON lines (JSONL) format handles this well.

**Persistence implementation:**

```javascript
// persistence.js — new module

// Session snapshots: written every 60s and on shutdown
// Format: data/sessions.json
{
  sessions: { [sessionId]: Session },
  savedAt: timestamp
}

// Event log: append-only JSONL, rotated daily
// Format: data/events/YYYY-MM-DD.jsonl
{"type":"trigger","sessionId":"abc","project":"foo","timestamp":1234567890}

// Manager insights: append-only JSONL, rotated daily
// Format: data/insights/YYYY-MM-DD.jsonl
{"text":"All sessions idle","trigger":"periodic","timestamp":1234567890}
```

**Cleanup:** A daily timer deletes files older than retention period.

**Recovery on restart:** Read `sessions.json` to restore active sessions. Sessions older than 30 minutes are discarded. This means a server restart doesn't lose session state.

### New module: `persistence.js`
### New directories: `data/events/`, `data/insights/`
### Modified: `server.js` (save on shutdown via `process.on('SIGTERM')`)

### Confidence: HIGH
JSON files at this scale are the right choice. If the project ever needs complex queries, migrate to SQLite then.

---

## 7. Build Order

### Dependency Graph

```
                    UI Module Split (5)
                         |
    +--------------------+--------------------+
    |                    |                    |
Server Sessions (1) --> Session UI (2) --> Manager AI (6)
    |                    |
    v                    v
Persistence (3)     Richer Hooks (4)
    |                    |
    v                    v
Event History UI     Hook Installer
```

### Recommended Build Sequence

**Wave 1: Foundation (sessions become server-side)**

| Order | Component | Type | Depends On | Rationale |
|-------|-----------|------|------------|-----------|
| 1 | `sessions.js` module | NEW | nothing | Core data model must exist first |
| 2 | Server routes for sessions | MODIFIED `server.js` | sessions.js | Expose session state via API |
| 3 | Static file serving | MODIFIED `server.js` | nothing | Required before UI split |
| 4 | UI module split | MODIFIED `public/` | static serving | Must split before adding new UI |

**Wave 2: Rich sessions + persistence**

| Order | Component | Type | Depends On | Rationale |
|-------|-----------|------|------------|-----------|
| 5 | Session cards with actions | MODIFIED `public/modules/sessions.js` | UI split | Dismiss, mark seen, deep link |
| 6 | Richer hook payload | MODIFIED `hooks/notify-trigger.cjs` | server sessions | More data flowing in |
| 7 | `persistence.js` module | NEW | sessions.js | Survive restarts, history |
| 8 | Event history in UI | MODIFIED `public/modules/feed.js` | persistence | Show historical events |

**Wave 3: Manager AI + deployment**

| Order | Component | Type | Depends On | Rationale |
|-------|-----------|------|------------|-----------|
| 9 | `manager.js` module | NEW | sessions.js | AI needs session data |
| 10 | Manager UI panel | NEW `public/modules/manager-panel.js` | UI split, manager.js | Display insights |
| 11 | Hook installer endpoint | NEW route in server.js | richer hooks | Simplify cross-machine setup |

**Wave 4: Polish + advanced features**

| Order | Component | Type | Depends On | Rationale |
|-------|-----------|------|------------|-----------|
| 12 | Screen-space-aware layout | MODIFIED CSS in `index.html` | UI split | Responsive to 16" screen |
| 13 | Session response helpers | NEW in sessions UI | sessions.js | Copy path, terminal hints |
| 14 | Notification regression tests | MODIFIED various | all | Ensure v1.0 features intact |

### Why This Order

1. **Sessions first** because everything depends on server-side session state
2. **Static file serving before UI split** because modules need to be served
3. **UI split early** because all subsequent UI work benefits from modularity
4. **Persistence after sessions** because you need the data model before you can persist it
5. **Richer hooks after server sessions** because the server needs to know what to do with the extra data
6. **Manager AI late** because it's the riskiest feature (API costs, latency, reliability) and benefits from a stable foundation
7. **Hook installer last in Wave 3** because it's a convenience feature, not a blocker

---

## Component Change Summary

### New Files

| File | Purpose | Phase |
|------|---------|-------|
| `sessions.js` | Server-side session store | Wave 1 |
| `persistence.js` | JSON file persistence for sessions/events | Wave 2 |
| `manager.js` | Manager AI integration (claude -p calls) | Wave 3 |
| `public/modules/app.js` | Client entry point | Wave 1 |
| `public/modules/state.js` | Shared client state | Wave 1 |
| `public/modules/sse.js` | SSE connection management | Wave 1 |
| `public/modules/sessions.js` | Session grid rendering | Wave 1 |
| `public/modules/feed.js` | Activity feed | Wave 1 |
| `public/modules/toasts.js` | Toast notifications | Wave 1 |
| `public/modules/config-panel.js` | Config sidebar | Wave 1 |
| `public/modules/manager-panel.js` | Manager AI display | Wave 3 |
| `public/modules/audio.js` | Voice playback | Wave 1 |
| `public/modules/utils.js` | Shared utilities | Wave 1 |
| `hooks/claude-settings-snippet.json` | Hook config template | Wave 3 |

### Modified Files

| File | Changes | Phase |
|------|---------|-------|
| `server.js` | Import sessions.js, add /sessions routes, static file serving, manager triggers | Wave 1-3 |
| `sse.js` | New event types (session:update, manager:insight) | Wave 1-2 |
| `public/index.html` | Extract JS to modules, keep HTML+CSS shell, add manager panel HTML | Wave 1, 3 |
| `hooks/notify-trigger.cjs` | Richer payload (hookEvent, lastMessage, toolName) | Wave 2 |

### Unchanged Files

| File | Reason |
|------|--------|
| `config.js` | Voice config is independent of session management |
| `tts.js` | TTS is independent of session management |
| `push.js` | Push notifications continue to work as-is |
| `public/sw.js` | Service worker unchanged |

---

## Data Flow: Complete Picture

```
Machine (CodeBox/Lenovo/Mac)
    |
    | Claude Code hooks (SessionStart, PostToolUse, Stop, Notification)
    v
hooks/notify-trigger.cjs
    |
    | HTTP POST /trigger (rich JSON payload)
    v
server.js
    |
    |-- sessions.js: update session state
    |-- persistence.js: append to event log
    |-- sse.js: emit 'trigger' + 'session:update'
    |-- tts.js: generate cached WAV (existing)
    |-- push.js: send push notification (existing)
    |-- manager.js: conditionally analyze (if attention or periodic)
    |
    v
SSE event stream
    |
    |-- Browser: update session cards, feed, toasts, play audio
    |-- Browser: display manager insights when received
    |
    | (user actions)
    v
HTTP POST /sessions/:id/dismiss, /manager/analyze, etc.
    |
    v
server.js -> sessions.js -> sse.js (emit update)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: WebSocket Migration
**What:** Replacing SSE with WebSocket for "true bidirectional" communication
**Why bad:** SSE works, has auto-reconnect, is simpler. WebSocket adds connection management complexity for no real benefit in this use case. The POST+SSE pattern handles all bidirectional needs.
**Instead:** Keep SSE for server->client, use POST for client->server.

### Anti-Pattern 2: Framework Migration
**What:** Adopting React/Vue/Svelte for the command center UI
**Why bad:** Introduces build step, massive dependency tree, learning curve for a single-user app. The vanilla JS approach is fast, simple, and working.
**Instead:** Split into ES modules. Use Web Components only if you need shadow DOM isolation (you probably don't).

### Anti-Pattern 3: Persistent Manager AI Session
**What:** Running a long-lived Claude Code session as the "Manager AI"
**Why bad:** Expensive (continuous API usage), complex state management, unclear recovery on crash. A monitoring AI doesn't need persistent conversation context.
**Instead:** Stateless `claude -p --bare` calls with session snapshot as input. Each call is independent.

### Anti-Pattern 4: SQLite for Small Data
**What:** Adding better-sqlite3 or node:sqlite for session/event storage
**Why bad:** Adds native compilation dependency (better-sqlite3) or requires experimental flag (node:sqlite). The data volume (kilobytes per day) doesn't justify a database.
**Instead:** JSON files with JSONL for append-only logs. Revisit if querying becomes complex.

### Anti-Pattern 5: Overloading the Hook Script
**What:** Making the hook script do complex processing (AI calls, state management)
**Why bad:** Hooks must be fast (< 4 second timeout). Complex hooks slow down Claude Code's response cycle. Hooks should be thin pipes.
**Instead:** Hook sends minimal data to server. Server does all processing.

---

## Scalability Considerations

| Concern | 5 sessions | 20 sessions | 50+ sessions |
|---------|------------|-------------|--------------|
| In-memory sessions | Trivial | Trivial | Trivial (~50KB) |
| SSE broadcast | Fast | Fast | May need batching |
| Event log (JSONL) | Tiny | ~100KB/day | ~500KB/day, fine |
| TTS cache | ~5MB | ~20MB | ~50MB, add cache limit |
| Manager AI calls | Rare | Moderate | Rate limit strictly |
| Hook processing | Instant | Instant | Debounce more aggressively |

The system comfortably handles the target use case (5-20 concurrent sessions) without any architectural changes beyond what's proposed.

---

## Sources

- [Claude Code Headless/Programmatic Mode](https://code.claude.com/docs/en/headless) -- Official docs on `claude -p`, session IDs, structured output
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- All 21+ lifecycle events, input schemas, common fields
- [MCP SSE Architecture](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/) -- SSE + POST bidirectional pattern (the pattern we're using)
- [Node.js SQLite API](https://nodejs.org/api/sqlite.html) -- Still experimental as of Node v25
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) -- Fastest SQLite for Node.js (considered, not recommended for this project)
- [Building Modular Web Apps with Vanilla JavaScript](https://devdecodes.medium.com/building-modular-web-apps-with-vanilla-javascript-no-frameworks-needed-631710bae703) -- ES module patterns
- [Vanilla App Architecture Using Web Components](https://frontendmasters.com/blog/architecture-through-component-colocation/) -- Component colocation patterns
