# Phase 4: Session Foundation - Research

**Researched:** 2026-03-28
**Domain:** Server-side session state management, JSON persistence, SSE event extension, notification regression testing
**Confidence:** HIGH

## Summary

Phase 4 moves session tracking from a client-side `Map()` in the browser to a server-side module with persistence, TTL-based lifecycle, and a REST+SSE hybrid API. The existing codebase is clean and modular (5 server modules, all ES modules, ~200 lines each), making this a straightforward state management addition. The `config.js` module already demonstrates the exact JSON file persistence pattern needed for sessions.

The key technical challenge is not complexity but correctness: the session store must handle concurrent updates from 7+ hooks arriving in rapid succession, survive PM2 restarts without data loss, emit SSE deltas (not full state) to all connected browsers, and do all of this without regressing voice/push/toast notifications. The notification regression gate (NOTIF-01/02/03) is the most important constraint — Playwright is already installed (v1.58.2) as a devDependency but no test files exist yet.

**Primary recommendation:** Create a `sessions.js` module that owns an in-memory Map with periodic JSON snapshot persistence, integrate it into the existing trigger handler in server.js, add a `GET /sessions` endpoint for initial load, emit `session:update` SSE events on every state change, and build a Playwright regression suite before modifying any notification-related code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Sessions are first-class server-side entities, not client-side Maps. Each session has: sessionId, project, machine, cwd, status (working/done/attention/stale), lastActivity timestamp, startedAt timestamp, event history, and question text when available.
- **D-02:** Event history depth and storage strategy is Claude's Discretion — balance usefulness with storage/performance constraints.
- **D-03:** Store question text from hooks when available, even though question display UI comes in Phase 6. Design the model to support future interaction features (response relay, tmux focus).
- **D-04:** Future-proof the model for Phase 6 interaction: include fields for pending question text, question timestamp, and potential response metadata.
- **D-05:** TTL-based lifecycle (not event-lifecycle). Sessions with no activity for 5 minutes become stale. Sessions with no activity for 30 minutes are removed. Carried forward from Phase 3 / research decisions.
- **D-06:** Persistence strategy is Claude's Discretion — pick the right approach for write frequency, data volume, and PM2 restart survival.
- **D-07:** REST + SSE hybrid pattern. GET /sessions returns full snapshot for initial page load. SSE delivers real-time delta events for updates. This is the research-recommended pattern.
- **D-08:** Existing SSE infrastructure (sse.js) stays — extend with session-specific events, don't replace.
- **D-09:** Playwright test suite for regression verification. Automated tests verify: trigger fires SSE event, toast appears in dashboard, audio endpoint returns valid response, push endpoint responds. Run after each plan in this phase.

### Claude's Discretion
- Session persistence strategy (JSON snapshots, JSONL append, hybrid)
- Event history depth per session
- Session data file location and format
- How stale/removed session cleanup works internally
- SSE event format for session updates (what fields in the delta)
- Whether to add a new sessions.js module or extend server.js

### Deferred Ideas (OUT OF SCOPE)
- Response relay from dashboard (Phase 6 / future)
- Chat interface per session (beyond v2.0)
- Cross-session dependency detection (Phase 7 Manager AI)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | Server tracks all active sessions with project, machine, status, cwd, and last activity timestamp | Session data model in Architecture Patterns section; `sessions.js` module design |
| SESS-02 | Session state persists across server restarts via JSON file storage | Persistence strategy section; JSON snapshot pattern modeled on existing `config.js` |
| SESS-05 | Sessions transition through working/done/attention/stale states based on hook events | Status lifecycle state machine documented; TTL timer implementation pattern |
| SESS-06 | Stale sessions auto-dim after 5 minutes and auto-remove after 30 minutes | TTL cleanup interval pattern; `setInterval` approach matching existing debounce cleanup |
| NOTIF-01 | Voice notifications fire on done and question events (no regression from v1.0) | Playwright regression test patterns; existing trigger handler analysis |
| NOTIF-02 | Browser push notifications work when tab is backgrounded | Playwright test for push subscription endpoint; push.js unchanged |
| NOTIF-03 | Visual toast notifications appear with auto-dismiss (8s done, 15s question) | Playwright DOM assertion patterns; toast container selectors documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, http) | v24.12.0 | Server, file I/O, HTTP routing | Already used; zero dependencies |
| web-push | ^3.6.7 | Browser push notifications | Already installed; unchanged |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright | ^1.58.2 | Notification regression tests | Already installed as devDependency; needs test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file persistence | SQLite (better-sqlite3) | Adds native compilation dep; data volume is kilobytes/day — JSON is correct at this scale |
| JSON file persistence | node:sqlite (built-in) | Still experimental in Node v24, requires --experimental-sqlite flag |
| setInterval TTL cleanup | setTimeout per session | Interval is simpler, matches existing debounce pattern in server.js |

**Installation:**
```bash
# No new dependencies needed — everything is already installed
pnpm install  # ensures existing deps are current
```

## Architecture Patterns

### Recommended Project Structure
```
voice_notifications/
  server.js           # HTTP router — add /sessions route, integrate sessions.js
  sessions.js         # NEW — server-side session store (Map + persistence + TTL)
  sse.js              # UNCHANGED — emit() already supports arbitrary event types
  config.js           # UNCHANGED — voice/template config
  tts.js              # UNCHANGED — TTS generation
  push.js             # UNCHANGED — browser push
  hooks/
    notify-trigger.cjs  # MINOR CHANGE — add question text to payload
  public/
    index.html          # MODIFY — read sessions from server on load, consume session:update SSE
    sw.js               # UNCHANGED
  data/
    config.json         # existing
    vapid.json          # existing
    sessions.json       # NEW — session snapshot for restart recovery
    cache/              # existing TTS cache
    samples/            # existing TTS samples
  tests/
    notifications.spec.mjs  # NEW — Playwright regression tests
```

### Pattern 1: Session Store Module (sessions.js)
**What:** A new ES module that owns session state as an in-memory Map, exposes CRUD operations, manages TTL timers, and handles persistence to disk.
**When to use:** This is the core new module for Phase 4.
**Example:**
```javascript
// sessions.js — recommended structure
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './config.js';
import { emit } from './sse.js';

const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const STALE_MS = 5 * 60 * 1000;   // 5 minutes
const REMOVE_MS = 30 * 60 * 1000;  // 30 minutes
const PERSIST_INTERVAL_MS = 30000;  // save every 30 seconds
const MAX_EVENTS_PER_SESSION = 20;

const sessions = new Map();

// Session shape:
// {
//   sessionId: string,
//   project: string,
//   machine: string,
//   cwd: string,
//   status: 'working' | 'done' | 'attention' | 'stale',
//   firstSeen: number,
//   lastActivity: number,
//   lastEventType: string,
//   eventCount: number,
//   events: Array<{ type: string, timestamp: number }>,
//   questionText: string | null,
//   questionTimestamp: number | null,
// }

export function upsertSession({ sessionId, project, machine, cwd, type, questionText }) {
  const now = Date.now();
  const existing = sessions.get(sessionId);

  const session = existing || {
    sessionId,
    project,
    machine,
    cwd,
    status: 'working',
    firstSeen: now,
    lastActivity: now,
    lastEventType: null,
    eventCount: 0,
    events: [],
    questionText: null,
    questionTimestamp: null,
  };

  // Update fields
  session.project = project || session.project;
  session.machine = machine || session.machine;
  session.cwd = cwd || session.cwd;
  session.lastActivity = now;
  session.lastEventType = type;
  session.eventCount++;
  session.status = type === 'question' ? 'attention' : 'done';

  // Store question text if provided
  if (type === 'question' && questionText) {
    session.questionText = questionText;
    session.questionTimestamp = now;
  }

  // Append to event history (ring buffer)
  session.events.push({ type, timestamp: now });
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.shift();
  }

  sessions.set(sessionId, session);

  // Emit SSE delta
  emit('session:update', {
    sessionId,
    project: session.project,
    machine: session.machine,
    status: session.status,
    lastActivity: session.lastActivity,
    lastEventType: session.lastEventType,
    questionText: session.questionText,
  });

  return session;
}

export function getAllSessions() {
  return Object.fromEntries(sessions);
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}
```

### Pattern 2: TTL Cleanup via setInterval
**What:** A periodic timer that transitions stale sessions and removes expired ones.
**When to use:** Runs continuously while the server is alive.
**Example:**
```javascript
// Inside sessions.js — cleanup timer
function runCleanup() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const elapsed = now - session.lastActivity;
    if (elapsed > REMOVE_MS) {
      sessions.delete(id);
      emit('session:remove', { sessionId: id });
    } else if (elapsed > STALE_MS && session.status !== 'stale') {
      session.status = 'stale';
      emit('session:update', {
        sessionId: id,
        status: 'stale',
        lastActivity: session.lastActivity,
      });
    }
  }
}

// Run every 30 seconds — matches existing cleanup pattern in server.js debounceMap
setInterval(runCleanup, 30000);
```

### Pattern 3: JSON Snapshot Persistence
**What:** Periodic save of the sessions Map to a JSON file, plus load on startup.
**When to use:** For PM2 restart survival.
**Example:**
```javascript
// Inside sessions.js — persistence
export function loadSessions() {
  try {
    if (!existsSync(SESSIONS_FILE)) return;
    const data = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
    const now = Date.now();
    for (const [id, session] of Object.entries(data.sessions || {})) {
      // Only restore sessions from last 30 minutes
      if (now - session.lastActivity < REMOVE_MS) {
        sessions.set(id, session);
      }
    }
  } catch(e) {}
}

export function saveSessions() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify({
      sessions: Object.fromEntries(sessions),
      savedAt: Date.now()
    }, null, 2));
  } catch(e) {}
}

// Periodic save
setInterval(saveSessions, PERSIST_INTERVAL_MS);

// Graceful shutdown save
process.on('SIGTERM', () => { saveSessions(); process.exit(0); });
process.on('SIGINT', () => { saveSessions(); process.exit(0); });
```

### Pattern 4: REST + SSE Hybrid for Session API
**What:** `GET /sessions` returns full state; SSE `session:update` and `session:remove` events deliver deltas.
**When to use:** Browser loads initial state via REST, then stays synced via SSE.
**Example integration in server.js:**
```javascript
// In server.js route handler
} else if (pathname === '/sessions') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getAllSessions()));
}
```

### Pattern 5: Trigger Handler Integration
**What:** The existing `/trigger` POST handler calls `upsertSession()` before emitting the trigger SSE event.
**When to use:** Every hook trigger creates/updates a session.
**Example:**
```javascript
// In server.js /trigger handler, after dedup check:
import { upsertSession } from './sessions.js';

// Inside the handler:
upsertSession({ sessionId, project, machine, cwd, type, questionText: null });

// Existing trigger SSE emit, push, and TTS generation remain unchanged
emit('trigger', { type, project, machine, sessionId, timestamp });
pushToAll(type, project).catch(() => {});
if (project) generateCached(type, project, () => {});
```

### Anti-Patterns to Avoid
- **Storing sessions in server.js globals:** Use a dedicated module. server.js is a router, not a data store.
- **Full state SSE broadcasts:** Emit deltas (changed fields only). Full session maps on every event waste bandwidth and cause UI flicker.
- **Synchronous file writes on every trigger:** Write persistence snapshots on a timer (30s) and on shutdown. Per-trigger writes would block the event loop under load.
- **Complex event sourcing:** A simple Map with periodic snapshots is correct here. Event sourcing adds complexity with no benefit at this data volume.
- **Modifying sse.js internals:** The `emit()` function already accepts any event type string. Just call `emit('session:update', data)` — no changes to sse.js needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence | Custom database layer | JSON file snapshot (like config.js pattern) | Data is kilobytes; config.js already proves this pattern works |
| TTL timers | Per-session setTimeout tracking | Single setInterval cleanup sweep | Simpler, matches existing debounce cleanup in server.js |
| SSE event types | Custom event routing system | Existing sse.js emit() with new event type strings | sse.js already handles arbitrary event types |
| Regression testing | Manual testing checklist | Playwright (already installed) | D-09 requires automated tests; Playwright is already a devDependency |
| Session ID generation | UUID generation library | Use Claude Code's session_id (provided by hooks) | The hook already sends `session_id`; server never creates sessions |

**Key insight:** The existing codebase already has every pattern needed. `config.js` shows JSON persistence. `sse.js` shows event broadcasting. The trigger handler shows payload parsing. Phase 4 is assembly, not invention.

## Common Pitfalls

### Pitfall 1: Process Signal Handling Conflicts
**What goes wrong:** Multiple modules register `process.on('SIGTERM')` handlers, but `process.exit()` in one handler prevents others from running.
**Why it happens:** PM2 sends SIGTERM on restart. If sessions.js calls `process.exit(0)` in its handler, other cleanup (e.g., closing SSE connections) never runs.
**How to avoid:** Use a single shutdown coordinator. Or: don't call `process.exit()` in individual handlers — let the process exit naturally after all handlers run. Node.js runs all registered listeners for the same signal.
**Warning signs:** Sessions not persisted on PM2 restart despite having a SIGTERM handler.

### Pitfall 2: Race Condition on Concurrent Hook Fires
**What goes wrong:** Two hooks for the same session arrive within milliseconds (e.g., Stop + PostToolUse). Both read the session, modify it, and write back — one overwrites the other.
**Why it happens:** JavaScript is single-threaded but async I/O can interleave if persistence writes are async.
**How to avoid:** Keep the session Map updates synchronous (they already are — Map.set is sync). Only file I/O is async, and that runs on a timer, not per-trigger. No race condition.
**Warning signs:** Session status flickering between states.

### Pitfall 3: Client-Side Session Map Conflicts with Server State
**What goes wrong:** The browser still maintains its own `sessions` Map from SSE `trigger` events, conflicting with the new server-side `/sessions` + `session:update` pattern.
**Why it happens:** The client currently builds sessions from `trigger` events. If both `trigger` and `session:update` events arrive, the client has two sources of truth.
**How to avoid:** Client must switch to `session:update` as the authoritative source for session state. The `trigger` event should ONLY be used for notifications (toast, voice, push). Session rendering should be driven exclusively by `session:update` and `session:remove` events plus the initial `GET /sessions` load.
**Warning signs:** Duplicate session cards, stale sessions not disappearing, status badges flickering.

### Pitfall 4: Playwright Tests Failing in CI/Headless Environment
**What goes wrong:** Tests pass locally but fail when run by PM2 or in a headless environment because the server isn't running or the browser can't connect.
**Why it happens:** Playwright needs a running server to test against. Tests must start the server themselves or verify it's running.
**How to avoid:** Use Playwright's `webServer` config to auto-start the server before tests. Or start server in the test setup and tear down after.
**Warning signs:** "Connection refused" errors in test output.

### Pitfall 5: Session Snapshot File Corruption on Crash
**What goes wrong:** Server crashes mid-write, leaving sessions.json truncated/corrupt. On restart, all sessions are lost.
**Why it happens:** `writeFileSync` is not atomic — a power loss or OOM kill during write corrupts the file.
**How to avoid:** Write to a temp file, then rename (atomic on Linux ext4). `writeFileSync('sessions.json.tmp', data)` then `renameSync('sessions.json.tmp', 'sessions.json')`.
**Warning signs:** Empty sessions after PM2 restart following a crash (not graceful stop).

### Pitfall 6: SSE Replay Buffer Replaying Session Updates After Reconnect
**What goes wrong:** Browser reconnects SSE and replays old `session:update` events, causing stale data to overwrite current state.
**Why it happens:** The existing SSE replay buffer (100 events) replays all events including session updates. Old session states overwrite newer ones.
**How to avoid:** On SSE reconnect, the client should fetch fresh state from `GET /sessions` and ignore replayed `session:update` events (use lastEventId dedup, which already exists in the client). Alternatively, only replay `trigger` events, not `session:update`.
**Warning signs:** Session status reverting to old values briefly after browser reconnect.

## Code Examples

### Server Integration: Adding /sessions Route
```javascript
// In server.js — add near other route handlers
import { upsertSession, getAllSessions, loadSessions, saveSessions } from './sessions.js';

// Initialize on startup (after loadConfig())
loadSessions();

// In route handler:
} else if (pathname === '/sessions') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getAllSessions()));
}
```

### Server Integration: Trigger Handler Update
```javascript
// In server.js /trigger handler, after dedup check, before existing emit:
upsertSession({
  sessionId: sessionId || 'unknown',
  project,
  machine,
  cwd,
  type,
  questionText: null  // Phase 6 will pass actual text
});

// Existing code remains unchanged:
emit('trigger', { type, project, machine, sessionId, timestamp });
pushToAll(type, project).catch(() => {});
if (project) generateCached(type, project, () => {});
```

### Client Integration: Loading Sessions on Page Load
```javascript
// In public/index.html — replace client-side session Map with server-sourced state
async function loadInitialSessions() {
  try {
    const res = await fetch('/sessions');
    const serverSessions = await res.json();
    for (const [id, session] of Object.entries(serverSessions)) {
      sessions.set(id, session);
    }
    renderSessions();
    updateStats();
  } catch(e) {}
}

// Call on page load
loadInitialSessions();
```

### Client Integration: Consuming session:update SSE Events
```javascript
// In SSE connection setup — add listener for session updates
eventSource.addEventListener('session:update', (e) => {
  const data = JSON.parse(e.data);
  const existing = sessions.get(data.sessionId) || {};
  sessions.set(data.sessionId, { ...existing, ...data });
  renderSessions();
  updateStats();
});

eventSource.addEventListener('session:remove', (e) => {
  const { sessionId } = JSON.parse(e.data);
  sessions.delete(sessionId);
  renderSessions();
  updateStats();
});
```

### Atomic File Write Pattern
```javascript
// Safe persistence — atomic write via rename
import { writeFileSync, renameSync } from 'fs';

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, data);
  renameSync(tmp, filePath);
}
```

### Playwright Regression Test Structure
```javascript
// tests/notifications.spec.mjs
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3099';

test.describe('Notification Regression', () => {
  test('trigger fires SSE event and shows toast', async ({ page }) => {
    await page.goto(BASE);

    // Fire a trigger
    const triggerRes = await page.request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'TestProject', sessionId: 'test-001', machine: 'test', cwd: '/tmp' }
    });
    expect(triggerRes.ok()).toBeTruthy();

    // Toast should appear
    await expect(page.locator('#toast-container .toast')).toBeVisible({ timeout: 3000 });
  });

  test('audio endpoint returns valid response', async ({ request }) => {
    // Pre-generate cached WAV
    await request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'AudioTest', sessionId: 'test-002', machine: 'test', cwd: '/tmp' }
    });

    // Wait for TTS generation
    await new Promise(r => setTimeout(r, 3000));

    const res = await request.get(`${BASE}/notify-wav?type=done&project=AudioTest`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio');
  });

  test('push subscription endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE}/vapid-public-key`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.publicKey).toBeTruthy();
  });

  test('GET /sessions returns session state after trigger', async ({ request }) => {
    await request.post(`${BASE}/trigger`, {
      data: { type: 'done', project: 'SessionTest', sessionId: 'test-003', machine: 'test', cwd: '/tmp' }
    });

    const res = await request.get(`${BASE}/sessions`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data['test-003']).toBeTruthy();
    expect(data['test-003'].project).toBe('SessionTest');
    expect(data['test-003'].status).toBe('done');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side `new Map()` for sessions | Server-side Map with REST+SSE sync | Phase 4 (now) | Sessions survive reloads, sync across tabs, available to future Manager AI |
| No persistence (sessions lost on reload) | JSON snapshot every 30s + atomic write | Phase 4 (now) | Sessions survive PM2 restarts |
| Trigger SSE event drives session rendering | `session:update` SSE event drives rendering | Phase 4 (now) | Separation of notification events from state events |

## Open Questions

1. **Question text extraction from hooks**
   - What we know: Claude Code hook input includes fields like `transcript_summary` for Stop events and potentially question text for Notification/AskUserQuestion events. The exact field name for question text is not confirmed in current hook documentation.
   - What's unclear: Which field in the hook input JSON contains the actual question text for AskUserQuestion events.
   - Recommendation: Add `questionText: null` to the session model now. Update the hook to extract and forward it when the field is identified. This is forward-compatible — Phase 6 will activate the display.

2. **Event history depth**
   - What we know: The user runs 7+ sessions. At 20 events per session, that is 140 event objects in memory — trivial.
   - What's unclear: Whether 20 events per session is enough for useful history display in Phase 5.
   - Recommendation: Start with 20. It covers ~2 hours of typical activity. Increase later if needed.

3. **Persistence write frequency**
   - What we know: PM2 restarts are the primary recovery scenario. PM2 sends SIGTERM which allows graceful shutdown.
   - What's unclear: Whether 30-second snapshot interval is too frequent (unnecessary I/O) or too infrequent (data loss window).
   - Recommendation: 30 seconds is correct. The write is <1KB, sub-millisecond on NVMe. A 30-second data loss window is acceptable for session state (not financial data).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | Yes | v24.12.0 | -- |
| Playwright | Regression tests (D-09) | Yes | 1.58.2 | -- |
| edge-tts | TTS generation (unchanged) | Yes | installed via pip | -- |
| PM2 | Process management | Yes | running | -- |
| pnpm | Package management | Yes | installed | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Discretion Recommendations

### Session Persistence Strategy: JSON Snapshots (not JSONL)
**Recommendation:** Periodic JSON snapshot file (`data/sessions.json`), not JSONL append log.
**Reasoning:**
- The data volume is tiny (7-20 sessions = ~5-10KB).
- JSONL is useful for event logs with rolling retention, but sessions need full-state snapshots for restart recovery.
- A JSONL file requires replay to reconstruct state — unnecessary complexity.
- The `config.js` module already demonstrates this exact pattern: `readFileSync` on load, `writeFileSync` on save.
- Use atomic write (write to .tmp, then rename) to prevent corruption.

### Event History Depth: 20 Events Per Session
**Recommendation:** Ring buffer of last 20 events per session.
**Reasoning:**
- 20 events covers ~2 hours of typical coding activity (1 done/question event every 5-10 minutes).
- Memory: 20 events * 20 sessions * ~100 bytes = ~40KB — negligible.
- Provides useful "what happened recently" context for Phase 5 timeline UI.
- If Phase 5 needs more, increase to 50 — trivial change.

### Session Data File Location: `data/sessions.json`
**Recommendation:** Same `data/` directory as `config.json` and `vapid.json`.
**Reasoning:** All persistent data lives in `data/`. The directory is already gitignored. The `DATA_DIR` constant from `config.js` can be reused.

### Cleanup Implementation: Single setInterval
**Recommendation:** One 30-second interval that both persists and cleans up stale sessions.
**Reasoning:** Combining persistence + cleanup into one timer reduces timer count. The operations are fast (<1ms). This matches the existing debounce cleanup pattern in server.js (lines 26-31).

### SSE Event Format for Session Deltas
**Recommendation:** Emit the full session object (minus events array) on every update.
**Reasoning:**
- Partial deltas (`{ sessionId, status: 'stale' }`) require the client to track and merge incrementally — error-prone.
- Full session objects (minus the events array to save bandwidth) are simple: client does `sessions.set(data.sessionId, data)`.
- At ~200 bytes per event with 7 sessions and ~1 event/minute average, bandwidth is negligible.
- Include a separate `session:remove` event type for deletions.

### Module Structure: New sessions.js Module
**Recommendation:** Create `sessions.js` as a standalone module, do not extend server.js.
**Reasoning:** server.js is a router (195 lines). Embedding 100+ lines of session logic would double it and mix concerns. The project has a clear pattern: one module per domain (config.js, tts.js, push.js, sse.js). sessions.js follows this pattern.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `server.js` (195 lines), `sse.js` (53 lines), `config.js` (57 lines), `push.js` (57 lines), `tts.js` (78 lines)
- `hooks/notify-trigger.cjs` (167 lines) — current hook payload structure
- `public/index.html` — current client-side session Map implementation (lines 967-1139)
- `.planning/research/ARCHITECTURE.md` — v2.0 architecture research (session model, persistence, build order)
- `.planning/research/SUMMARY.md` — research synthesis and pitfalls

### Secondary (MEDIUM confidence)
- Node.js fs.renameSync documentation — atomic file replacement on Linux ext4 (standard behavior)
- Playwright test API — test structure patterns from v1.58.x

### Tertiary (LOW confidence)
- Claude Code hook input fields for question text — exact field name for AskUserQuestion payload not verified against current hook docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns exist in codebase
- Architecture: HIGH — straightforward Map + JSON persistence, modeled on existing config.js
- Pitfalls: HIGH — identified from direct codebase analysis (signal handling, SSE replay, file corruption)
- Regression testing: MEDIUM — Playwright is installed but untested in this project; test patterns are standard

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no fast-moving dependencies)
