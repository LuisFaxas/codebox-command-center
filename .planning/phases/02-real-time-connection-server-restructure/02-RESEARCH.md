# Phase 2: Real-Time Connection + Server Restructure - Research

**Researched:** 2026-03-27
**Domain:** Server-Sent Events (SSE), Node.js ES modules, server modularization, Caddy reverse proxy
**Confidence:** HIGH

## Summary

This phase replaces HTTP polling with Server-Sent Events for instant notification delivery, splits the monolithic server.js into focused ES modules, and configures Caddy for SSE passthrough. The existing codebase is 484 lines of CommonJS in a single file with HTML embedded as a template literal. All decisions are locked via CONTEXT.md -- SSE (not WebSocket), ES modules (not CommonJS), full event bus with four event types, and trigger.json removal.

SSE is the right tool here: it is a browser-native unidirectional push protocol built on HTTP. Node.js implements it trivially with the built-in `http` module -- no libraries needed. The `EventSource` browser API provides automatic reconnection with `Last-Event-ID` replay out of the box. Caddy automatically detects `Content-Type: text/event-stream` and disables response buffering, though explicit `flush_interval -1` is recommended for certainty.

**Primary recommendation:** Implement SSE with an EventEmitter-backed event bus (sse.js), split server into 4 modules + entry point, migrate to ES modules via `package.json` `"type": "module"`, and add a Caddy site block with `flush_interval -1`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single `/events` SSE endpoint carries all event types, differentiated by the SSE `event:` field. One connection per browser tab, one reconnect to manage.
- **D-02:** Full event bus from day one -- not just triggers. Four event types: `trigger`, `session:alive`, `config:updated`, `connection:health`.
- **D-03:** Events carry sequential IDs. Clients use `Last-Event-ID` on reconnect to replay missed events from an in-memory circular buffer.
- **D-04:** Full module split. server.js becomes entry + routing only. New modules: `sse.js`, `tts.js`, `config.js`, `public/index.html`.
- **D-05:** Switch from CommonJS to ES modules. Add `package.json` with `"type": "module"`. Clean break from legacy style.
- **D-06:** Remove trigger.json entirely. SSE event bus with Last-Event-ID replay buffer replaces file-based signaling.
- **D-07:** Remove the `/check` polling endpoint. SSE is the only notification delivery path.
- **D-08:** Dual protection: server sends SSE `:keepalive` comments every 15 seconds, Caddy configured with `flush_interval -1` and extended `read_timeout`.
- **D-09:** Caddy config update is part of this phase's plan.

### Claude's Discretion
- Replay buffer size (reasonable default like 100 events is fine)
- How session:alive heartbeats are collected
- Internal module boundaries -- exact function signatures and export shapes
- How to handle ES module migration for the hook script (notify-trigger.js)
- Whether to add package.json `scripts` section

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | SSE replaces HTTP polling for server-to-client push | SSE protocol via `Content-Type: text/event-stream`, EventSource API, `/events` endpoint (D-01) |
| RT-02 | SSE connection auto-reconnects on disconnect | EventSource built-in reconnection + `Last-Event-ID` replay buffer (D-03) |
| RT-03 | SSE heartbeat prevents Caddy/proxy timeout (30s interval) | Server keepalive comments every 15s + Caddy `flush_interval -1` (D-08) |
| RT-04 | Server uses EventEmitter as internal event bus | Node.js `events` module EventEmitter in sse.js, decouples trigger from delivery (D-02) |
| UI-04 | Embedded HTML extracted from server.js to separate frontend | `public/index.html` served via static file serving (D-04) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Package manager:** pnpm only (never npm or yarn)
- **Node.js:** v24 with erasable TypeScript support (but this project uses plain JS only)
- **No npm packages:** Project uses Node.js built-ins only -- this phase should maintain that constraint (no Express, no SSE libraries)
- **Stack:** No build step. Direct Node.js execution
- **Plain JavaScript only:** No TypeScript
- **Secrets:** Never commit .env files or credentials
- **GSD workflow:** All changes go through GSD commands

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `http` | built-in (v24) | HTTP server | Already in use, no framework needed for SSE |
| Node.js `events` | built-in (v24) | EventEmitter for event bus | Native pub/sub, zero dependencies |
| Node.js `fs` | built-in (v24) | Static file serving, config persistence | Already in use |
| EventSource API | browser built-in | SSE client | Native browser API, auto-reconnect built in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Caddy | 2.11.2 (installed) | Reverse proxy with SSE support | Route `voice-notifications.codebox.local` to port 3099 |
| edge-tts | 7.2.8 (installed) | TTS synthesis | Already in use, unchanged this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SSE | WebSocket (ws) | Bidirectional not needed; SSE has native reconnect + Last-Event-ID; WS adds npm dependency |
| EventEmitter | Third-party event bus | Overkill for single-process server; EventEmitter is zero-dependency and sufficient |
| Manual static serving | serve-static/Express | Adds npm dependency; one `fs.readFileSync` + `res.end()` is enough for a single HTML file |

**Installation:**
```bash
# No npm packages needed. Only action:
cd /home/faxas/workspaces/projects/personal/voice_notifications
pnpm init  # Creates package.json, then manually set "type": "module"
```

## Architecture Patterns

### Recommended Project Structure
```
voice_notifications/
├── server.js          # Entry point: HTTP server + routing only (~80 lines)
├── sse.js             # Event bus, SSE client management, replay buffer
├── tts.js             # edge-tts wrapper (generateSamples, generateCached, clearCache)
├── config.js          # Settings persistence (load, save, defaults, voice list)
├── public/
│   └── index.html     # Extracted UI (voice picker + notification listener)
├── hooks/
│   └── notify-trigger.js  # Remote hook (stays CommonJS -- see note below)
├── data/              # Runtime data (gitignored)
│   ├── config.json
│   ├── cache/
│   └── samples/
└── package.json       # "type": "module"
```

### Pattern 1: SSE Event Bus with EventEmitter
**What:** A central EventEmitter instance acts as the internal event bus. When `/trigger` receives a POST, it emits an event. The SSE module listens and fans out to all connected clients.
**When to use:** Whenever trigger-to-client delivery is needed.
**Example:**
```javascript
// sse.js — Source: MDN SSE docs + Node.js EventEmitter docs
import { EventEmitter } from 'events';

const bus = new EventEmitter();
const clients = new Set();
const buffer = [];  // Circular replay buffer
const BUFFER_SIZE = 100;
let eventId = 0;

export function emit(eventType, data) {
  eventId++;
  const event = { id: eventId, type: eventType, data, timestamp: Date.now() };
  buffer.push(event);
  if (buffer.length > BUFFER_SIZE) buffer.shift();

  const formatted = formatSSE(event);
  for (const client of clients) {
    client.write(formatted);
  }
}

function formatSSE(event) {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function addClient(req, res, lastEventId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // Prevents nginx buffering if ever used
  });

  // Replay missed events
  if (lastEventId) {
    const missedIdx = buffer.findIndex(e => e.id > Number(lastEventId));
    if (missedIdx >= 0) {
      for (let i = missedIdx; i < buffer.length; i++) {
        res.write(formatSSE(buffer[i]));
      }
    }
  }

  clients.add(res);
  req.on('close', () => clients.delete(res));
}

// Keepalive: send comment every 15 seconds
setInterval(() => {
  for (const client of clients) {
    client.write(': keepalive\n\n');
  }
}, 15000);
```

### Pattern 2: ES Module Migration with CommonJS Hook Exception
**What:** Main server uses ES modules (`import/export`), but the hook script (`notify-trigger.js`) stays CommonJS since it is invoked as a standalone executable by Claude Code.
**When to use:** When `package.json` has `"type": "module"` but a specific file must remain CommonJS.
**Example:**
```javascript
// hooks/notify-trigger.js stays as-is with require() calls
// Option A: Rename to notify-trigger.cjs (Claude Code settings must update path)
// Option B: Keep as .js but it works because hooks/ could have its own package.json
// Recommended: Rename to .cjs — simplest, no ambiguity
```

Node.js v24 supports `import.meta.dirname` as the ES module replacement for `__dirname`:
```javascript
// server.js (ES module)
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || join(import.meta.dirname, 'data');
```

### Pattern 3: Static HTML File Serving
**What:** Serve `public/index.html` from disk instead of embedding in a template literal.
**When to use:** Default route (`/` or any unmatched path).
**Example:**
```javascript
// server.js
import { readFileSync } from 'fs';
import { join } from 'path';

// Read once at startup (simple, no file watcher needed for this use case)
const htmlPath = join(import.meta.dirname, 'public', 'index.html');
let indexHtml = readFileSync(htmlPath, 'utf8');

// In request handler:
if (pathname === '/' || !matchedRoute) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(indexHtml);
}
```

### Anti-Patterns to Avoid
- **Polling fallback:** Do NOT keep `/check` as a fallback. SSE is the only delivery path (D-07). Adding fallback creates two code paths to maintain.
- **Per-event file writes:** Do NOT write trigger.json when SSE is active. The event bus IS the signaling mechanism (D-06).
- **Large replay buffers:** Do NOT use unbounded arrays for replay. Circular buffer with fixed size (100 events) prevents memory growth.
- **Blocking TTS in event handler:** Do NOT await TTS generation before sending SSE event. Emit the trigger event immediately, generate WAV in background, send a separate event or let client fetch WAV on demand.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE client reconnection | Custom reconnection logic in browser JS | Browser's native `EventSource` API | Auto-reconnect with backoff is built into the spec; `Last-Event-ID` header sent automatically |
| Event ID sequencing | UUIDs or timestamps as event IDs | Simple incrementing integer counter | SSE spec uses `Last-Event-ID` as an opaque string; integers are simplest for replay buffer indexing |
| Circular buffer | Custom linked list or ring buffer | Array with `push()` + `shift()` when over limit | For 100 items, array performance is irrelevant; simplicity wins |
| SSE message formatting | String concatenation ad-hoc | Dedicated `formatSSE()` function | SSE format has specific rules (double newline terminators, field prefixes); centralizing prevents bugs |

**Key insight:** SSE is intentionally simple. The entire server-side implementation is ~60 lines of code. The EventSource browser API handles all the hard reconnection logic. Do not add libraries.

## Common Pitfalls

### Pitfall 1: Missing Double Newline in SSE Messages
**What goes wrong:** SSE messages are not delivered to the client even though data is being written.
**Why it happens:** Each SSE message MUST end with `\n\n` (two newlines). A single `\n` is a field separator within a message. Missing the trailing `\n\n` means the browser treats it as an incomplete message and buffers indefinitely.
**How to avoid:** Use a single `formatSSE()` function that always appends `\n\n`. Never construct SSE messages inline.
**Warning signs:** Client connects but never receives events; events arrive in batches.

### Pitfall 2: Caddy Response Buffering
**What goes wrong:** SSE events are delayed or arrive in bursts instead of instantly.
**Why it happens:** While Caddy auto-detects `text/event-stream` and flushes immediately, this only works if the content-type header is set correctly AND no compression middleware interferes. Caddy's `encode` directive (gzip/zstd) can buffer SSE streams.
**How to avoid:** Add explicit `flush_interval -1` in the Caddy reverse_proxy block. Do NOT enable `encode` on the SSE route. Verify with: open browser DevTools Network tab, SSE connection should show data arriving in real-time.
**Warning signs:** Events arrive in bursts of 2-3; 30+ second delay before first event.

### Pitfall 3: EventSource 6-Connection Limit (HTTP/1.1)
**What goes wrong:** After opening 6 tabs to the same origin, no more SSE connections work.
**Why it happens:** HTTP/1.1 limits browsers to 6 concurrent connections per domain. Each SSE connection holds one open. This is a hard browser limit.
**How to avoid:** This is unlikely to be a problem (user won't open 6+ tabs), but worth knowing. HTTP/2 raises the limit to ~100 streams. Caddy serves HTTP/2 by default over TLS (which the `tls internal` directive enables).
**Warning signs:** New tabs show "connecting" forever; existing tabs work fine.

### Pitfall 4: `res.write()` After Connection Close
**What goes wrong:** Server crashes with "write after end" error.
**Why it happens:** Client disconnects (tab close, network drop) but server still tries to write to the response stream on next event.
**How to avoid:** Listen for `req.on('close')` to remove client from the Set. Before writing, check if `res.writableEnded` is false (though removing from Set on close is sufficient).
**Warning signs:** Unhandled exception crashes, especially when users close/reopen tabs frequently.

### Pitfall 5: ES Module `__dirname` and `require` Errors
**What goes wrong:** `ReferenceError: __dirname is not defined` or `ReferenceError: require is not defined`.
**Why it happens:** ES modules don't have CommonJS globals (`__dirname`, `__filename`, `require`, `module`, `exports`).
**How to avoid:** Use `import.meta.dirname` (Node.js v21.2+, confirmed working on v24.12.0). For dynamic imports of JSON, use `fs.readFileSync` + `JSON.parse` or `import` with assert.
**Warning signs:** Server crashes on startup after switching to ES modules.

### Pitfall 6: Hook Script Breaks After ES Module Switch
**What goes wrong:** `notify-trigger.js` fails with `require is not defined` because `package.json` has `"type": "module"`.
**Why it happens:** The `"type": "module"` in package.json affects ALL `.js` files in the project directory tree.
**How to avoid:** Rename the hook to `notify-trigger.cjs` (the `.cjs` extension forces CommonJS regardless of package.json). Update Claude Code settings to reference the new filename. OR place a separate `package.json` with `"type": "commonjs"` in the `hooks/` directory.
**Warning signs:** Claude Code hook silently fails (hook scripts exit 0 on all errors).

## Code Examples

### SSE Client in Browser (EventSource)
```javascript
// Source: MDN Server-sent events documentation
// Replace the current poll() function in public/index.html

const eventSource = new EventSource('/events');

eventSource.addEventListener('trigger', (e) => {
  const data = JSON.parse(e.data);
  // data: { type: 'done'|'question', project: 'My Project', ... }
  playNotification(data.type, data.project);
});

eventSource.addEventListener('config:updated', (e) => {
  const data = JSON.parse(e.data);
  serverConfig = data;
  applyTab();
});

eventSource.addEventListener('connection:health', (e) => {
  // Server keepalive received — connection is healthy
});

eventSource.onerror = () => {
  // EventSource will automatically reconnect
  // Show "reconnecting..." UI if desired
};
```

### Server `/events` Endpoint
```javascript
// Source: Node.js http module + SSE protocol spec
// In server.js route handler

if (pathname === '/events') {
  const lastEventId = req.headers['last-event-id'] || null;
  addClient(req, res, lastEventId);
  return;
}
```

### Trigger Endpoint Emitting to Event Bus
```javascript
// In server.js POST /trigger handler (after debounce check)

import { emit } from './sse.js';

// Replace trigger.json write with:
emit('trigger', { type, project, machine, sessionId, timestamp });

// Pre-generate WAV in background (unchanged)
if (project) {
  generateCached(type, project, () => {});
}
```

### Caddy Configuration for SSE
```
# Add to /etc/caddy/Caddyfile
voice-notifications.codebox.local {
    tls internal
    reverse_proxy localhost:3099 {
        flush_interval -1
        transport http {
            read_timeout 0
        }
    }
}
```

### ES Module Config Pattern
```javascript
// config.js — ES module version of config management
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || join(import.meta.dirname, 'data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const defaults = {
  done: { voice: 'en-US-GuyNeural', template: 'Done with {project}' },
  question: { voice: 'en-US-GuyNeural', template: 'I need your attention at {project}' },
};

let config = { ...defaults };

export function load() {
  mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (existsSync(CONFIG_FILE)) {
      config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch(e) {}
  return config;
}

export function save() {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function get() { return config; }

export function update(type, voice, template) {
  config[type] = { voice, template };
  save();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CommonJS `require()` | ES modules `import/export` | Node.js 14+ (stable) | `"type": "module"` in package.json; `.cjs` for legacy files |
| `__dirname` / `__filename` | `import.meta.dirname` / `import.meta.filename` | Node.js 21.2+ | Direct replacements, no `fileURLToPath` workaround needed |
| Manual SSE reconnection | Native `EventSource` with `Last-Event-ID` | Always been in spec | Browser handles reconnect timing and ID header automatically |
| `url.parse()` | `new URL()` | Node.js 10+ | Already available; migration cleans up server.js parsing |

**Deprecated/outdated:**
- `url.parse()`: Used in current server.js. Replace with `new URL(req.url, 'http://localhost')` in ES module version.
- Callback-style async for TTS: Current code uses callbacks. Could modernize to `child_process.execFile` with `util.promisify`, but this is optional since callbacks work fine.

## Open Questions

1. **Hook script naming**
   - What we know: `notify-trigger.js` uses `require()` and is referenced in Claude Code `settings.json`. Renaming to `.cjs` requires updating every machine's settings.
   - What's unclear: How many machines have the hook configured? Is there a way to update all at once?
   - Recommendation: Rename to `.cjs` and document the settings update as a task. Alternatively, add `hooks/package.json` with `"type": "commonjs"` to avoid filename change -- this is cleaner if many machines are configured.

2. **Session heartbeat collection**
   - What we know: D-02 specifies `session:alive` events. Hooks currently fire on Stop and PermissionRequest only, not periodically.
   - What's unclear: Whether to add a periodic ping from hooks or infer "alive" from recent trigger events.
   - Recommendation: For Phase 2, infer session activity from trigger events (last-seen tracking). True heartbeat hooks can be added in Phase 4 (multi-machine).

3. **PM2 configuration**
   - What we know: Voice notifications is not in the PM2 ecosystem config and has no Caddy entry.
   - What's unclear: Whether the server is currently run manually or via some other mechanism.
   - Recommendation: Add PM2 and Caddy entries as part of this phase (supports D-09).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | Yes | 24.12.0 | -- |
| Caddy | Reverse proxy + TLS | Yes | 2.11.2 | Direct port access (already works) |
| edge-tts | TTS synthesis | Yes | 7.2.8 | -- |
| Python 3 | edge-tts runtime | Yes | 3.12.3 | -- |
| pnpm | Package management | Yes | (system) | -- |
| PM2 | Process management | Yes | (system) | Manual `node server.js` |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- Caddy site entry for voice-notifications: Does not exist yet. Fallback is direct port access on 3099 (current behavior). D-09 specifies adding it in this phase.
- PM2 ecosystem entry: Does not exist. Not blocking, but should be added.

## Sources

### Primary (HIGH confidence)
- [MDN Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) -- SSE protocol format, EventSource API, reconnection behavior, `Last-Event-ID`
- [Caddy reverse_proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) -- `flush_interval`, transport timeouts, auto-detection of `text/event-stream`
- Node.js v24.12.0 runtime verification -- `import.meta.dirname` confirmed working
- `/etc/caddy/Caddyfile` -- verified no voice-notifications entry exists

### Secondary (MEDIUM confidence)
- [Caddy SSE buffering issue #6293](https://github.com/caddyserver/caddy/issues/6293) -- `encode` directive can interfere with SSE flushing
- [Caddy community: SSE buffering](https://caddy.community/t/server-sent-events-buffering-with-reverse-proxy/11722) -- confirms `flush_interval -1` as fix
- [AppSignal: CommonJS vs ES Modules](https://blog.appsignal.com/2024/12/11/a-deep-dive-into-commonjs-and-es-modules-in-nodejs.html) -- `.cjs` extension for CommonJS files in ESM projects

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all built-in Node.js APIs verified on installed v24
- Architecture: HIGH -- SSE is a well-understood protocol; EventEmitter pattern is textbook Node.js
- Pitfalls: HIGH -- Caddy buffering, connection limits, and ES module migration issues are well-documented
- Caddy config: HIGH -- Verified Caddyfile path and current contents directly

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, unlikely to change)
