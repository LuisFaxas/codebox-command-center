# Architecture Research

**Domain:** Real-time notification system + live coding dashboard (single-user, single-server)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOOK LAYER (event producers)                  │
│                                                                      │
│  ┌───────────────────┐    ┌───────────────────┐                     │
│  │  notify-done.sh   │    │  notify-trigger.js│                     │
│  │  (CodeBox local)  │    │  (Lenovo remote)  │                     │
│  │  writes file      │    │  HTTP GET         │                     │
│  └────────┬──────────┘    └────────┬──────────┘                     │
│           │                        │                                 │
└───────────┼────────────────────────┼─────────────────────────────────┘
            │                        │
┌───────────▼────────────────────────▼─────────────────────────────────┐
│                      SERVER LAYER (CodeBox :3099)                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Event Bus (EventEmitter)                   │    │
│  │   trigger received → emit('notification', {type, project})   │    │
│  └──────────────┬──────────────────────┬────────────────────────┘    │
│                 │                      │                              │
│  ┌──────────────▼───────┐  ┌───────────▼──────────────────────────┐  │
│  │   Session Store      │  │   SSE Broadcaster                    │  │
│  │   (in-memory Map)    │  │   (Set of response streams)          │  │
│  │   project → {status, │  │   fan-out to all connected clients   │  │
│  │   last seen, type}   │  └──────────────────────────────────────┘  │
│  └──────────────────────┘                                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    TTS Engine (edge-tts)                      │    │
│  │   generateCached(type, project) → WAV file                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Web Push Sender                            │    │
│  │   web-push + VAPID → push subscription endpoints             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  data/                                                               │
│    config.json     (voice/template prefs)                            │
│    subscriptions/  (push subscription endpoints, one per client)     │
│    cache/          (WAV files, type--project.wav)                    │
│    samples/        (audition WAVs)                                   │
└──────────────────────────────────────────────────────────────────────┘
            │ SSE stream + HTTP                │ Web Push (external)
┌───────────▼──────────────────────────────────▼──────────────────────┐
│                      CLIENT LAYER (browser tab)                      │
│                                                                      │
│  ┌───────────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  SSE Connection   │  │ Audio Player  │  │  Service Worker   │   │
│  │  EventSource API  │  │ plays WAV     │  │  handles push     │   │
│  │  receives events  │  │ on notify evt │  │  shows OS toast   │   │
│  └───────────────────┘  └───────────────┘  └───────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Dashboard UI                               │   │
│  │   session cards: project / status / last-seen / type         │   │
│  │   activity feed: stream of recent notification events        │   │
│  │   config panel: voice picker, template editor                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Hook (local shell) | Write trigger.json on CodeBox Stop event | Server file watcher |
| Hook (remote node) | HTTP GET /trigger from Lenovo/Mac | Server /trigger endpoint |
| /trigger endpoint | Accept inbound events, write to session store, emit to event bus | Event bus, session store |
| Event Bus (EventEmitter) | Decouple trigger receipt from fan-out; single place to add listeners | SSE broadcaster, web push sender |
| Session Store (Map) | Track current status of every active project (in-memory) | /trigger endpoint writes, /sessions endpoint reads |
| SSE Broadcaster | Hold open response streams for all connected browser clients; fan-out events | All open SSE connections |
| TTS Engine | Shell out to edge-tts; cache WAVs keyed by type+project | /notify-wav endpoint, /trigger (pre-warm) |
| Web Push Sender | Send OS-level notifications via VAPID to browser push endpoints | Service worker on each client |
| Service Worker | Register push subscription; handle push events when tab is backgrounded | Web Push Sender, browser Notification API |
| Dashboard UI | Render live session grid and activity feed; host config panel | SSE Connection, Audio Player, Service Worker |

## Recommended Project Structure

```
voice_notifications/
├── server.js                  # Entry point — assembles and starts server
├── src/
│   ├── events.js              # EventEmitter singleton (event bus)
│   ├── sessions.js            # Session store (in-memory Map, read/write API)
│   ├── sse.js                 # SSE broadcaster (manages client Set, fan-out)
│   ├── tts.js                 # edge-tts wrapper (generateCached, clearCache, samples)
│   ├── push.js                # web-push sender (subscribe, send, VAPID setup)
│   ├── config.js              # Config load/save (voice+template prefs, disk-backed)
│   └── routes/
│       ├── trigger.js         # POST/GET /trigger — hook entry point
│       ├── stream.js          # GET /events — SSE connection handler
│       ├── audio.js           # GET /notify-wav, /wav/:file — WAV serving
│       ├── push.js            # POST /push-subscribe, POST /push-unsubscribe
│       └── settings.js        # GET /config, POST /select, POST /generate, GET /samples
├── public/
│   ├── index.html             # Dashboard SPA (extracted from embedded string)
│   ├── app.js                 # Client JS (SSE client, audio player, UI updates)
│   ├── sw.js                  # Service worker (push subscription + notification display)
│   └── style.css              # Styles (optional extraction)
├── hooks/
│   ├── notify-done.sh         # Local CodeBox hook (currently writes file)
│   └── notify-trigger.js      # Remote hook for Lenovo/any machine
└── data/                      # Runtime data (gitignored)
    ├── config.json
    ├── subscriptions.json      # Persisted push subscription objects
    ├── cache/
    └── samples/
```

### Structure Rationale

- **src/**: Server logic separated by concern. Events.js is the pivot — everything talks through it, nothing talks around it.
- **src/routes/**: Each route file owns one URL namespace, imports from src/ modules. Avoids the current 422-line monolith growing into an 800-line monolith.
- **public/**: Static files served from disk, not embedded in JS strings. This is the single most important structural change to enable maintainable UI work.
- **hooks/**: Unchanged. Hook scripts stay flat — they're installed on remote machines and must stay simple.
- **data/**: All runtime files. `subscriptions.json` is new — stores push subscription objects across server restarts.

## Architectural Patterns

### Pattern 1: Central Event Bus via Node.js EventEmitter

**What:** A single EventEmitter instance in `src/events.js` is the only place notification events flow through. `/trigger` writes to session store and emits `'notification'`. SSE broadcaster and web push sender are listeners — they don't know about each other or about hooks.

**When to use:** Any time you have one producer (hook) and multiple consumers (SSE fan-out, push send, session update, activity log). Adding a new consumer — say, a Slack webhook — means adding one listener, not modifying the trigger handler.

**Trade-offs:** In-process only — fine for a single Node.js process. If this ever became multi-process, you'd swap the EventEmitter for Redis Pub/Sub. That refactor is minimal because the interface is identical.

**Example:**
```javascript
// src/events.js
const EventEmitter = require('events');
module.exports = new EventEmitter();

// src/routes/trigger.js
const bus = require('../events');
const sessions = require('../sessions');
// ...
sessions.update(project, { type, status: 'done', lastSeen: Date.now() });
bus.emit('notification', { type, project, ts: Date.now() });

// src/sse.js
const bus = require('./events');
bus.on('notification', (event) => {
  broadcast({ type: 'notification', data: event });
});
```

### Pattern 2: SSE for Server-to-Client Push (not WebSocket)

**What:** Use Server-Sent Events (`text/event-stream`) for all server-to-client data: notification events, session state updates, activity feed entries. The browser uses the native `EventSource` API.

**When to use:** This system is entirely unidirectional — the server pushes, clients consume. Client-to-server communication (voice selection, template save) remains plain HTTP POST. WebSocket buys nothing here and adds complexity (manual reconnect logic, binary framing, protocol upgrade).

**Trade-offs:** SSE runs over standard HTTP, auto-reconnects on disconnect, works through Caddy without additional proxy config, and benefits from HTTP/2 multiplexing if enabled. The only downside is the HTTP/1.1 6-connection browser limit per domain — irrelevant here since this is a single-tab application on a private network.

**Example:**
```javascript
// src/sse.js — broadcaster
const clients = new Set();

function addClient(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',   // required for Caddy/nginx proxies
  });
  res.write('retry: 3000\n\n');  // tell client to retry after 3s on disconnect
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(res => res.write(payload));
}
```

### Pattern 3: In-Memory Session Store with Disk Config

**What:** Track all known project sessions in a `Map` keyed by project name. Each entry holds `{ status, type, lastSeen, machine }`. This is the source of truth for the dashboard "session grid" view.

**When to use:** Single-process, single-user system. No need for a database. The Map initializes empty on startup; sessions appear as hooks fire. Config (voice, template preferences) is disk-backed (`config.json`) since it must survive restarts.

**Trade-offs:** Sessions are ephemeral — restarting the server clears them. For this use case that is correct behavior: stale sessions from a previous day should not appear. If persistence became important, appending to a simple JSON log file would suffice.

**Example:**
```javascript
// src/sessions.js
const sessions = new Map();

function update(project, fields) {
  const existing = sessions.get(project) || {};
  sessions.set(project, { ...existing, ...fields });
}

function getAll() {
  return Array.from(sessions.entries()).map(([project, data]) => ({ project, ...data }));
}
```

### Pattern 4: Web Push + Service Worker for Background Notifications

**What:** Register a Service Worker in the browser to receive Web Push API notifications. The server holds VAPID keys and push subscription endpoints (one per browser client). On each notification event, `web-push` sends to all registered endpoints via the Push Service (Google/Mozilla infrastructure). The Service Worker's `push` event handler displays an OS notification — this works even when the browser tab is backgrounded or on a locked screen.

**When to use:** The user runs 5+ concurrent sessions and may not be watching the browser tab. Browser Push is the only mechanism that reliably surfaces a notification when the tab is inactive. The `web-push` npm package handles all VAPID signing and protocol details.

**Trade-offs:** Requires HTTPS (or localhost) — fine because Caddy provides TLS for `*.codebox.local` and the Tailscale address can use HTTPS. Push subscriptions expire or become invalid if the browser reinstalls; the server must handle 410 Gone responses by deleting the subscription. Push delivery is not guaranteed (Google/Mozilla push services have SLA limitations) — but for a local network, delivery is reliably sub-second.

## Data Flow

### Notification Event Flow

```
[Claude Code hook fires]
        ↓
[Hook writes trigger.json  OR  HTTP GET /trigger]
        ↓
[/trigger handler]
  → writes session store: project status = 'done'|'question', lastSeen = now
  → bus.emit('notification', { type, project, ts })
        ↓
[Event Bus (EventEmitter) — synchronous fan-out]
  ├→ [SSE Broadcaster] → writes SSE frame to all open EventSource connections
  │      ↓
  │   [Browser tab(s)]
  │      ├→ Audio Player: fetch /notify-wav → play WAV
  │      ├→ UI update: update session card for project
  │      └→ append to activity feed
  │
  └→ [Web Push Sender] → web-push.sendNotification() to all subscriptions
         ↓
      [Push Service (Google/Mozilla)]
         ↓
      [Service Worker push event] → new Notification(title, options)
         ↓
      [OS notification toast — works even with tab closed]
```

### Client Initial Load Flow

```
[Browser opens app URL]
        ↓
[GET /] → serve public/index.html
[GET /app.js, /sw.js] → serve static files
        ↓
[JS: navigator.serviceWorker.register('/sw.js')]
[JS: pushManager.subscribe() → POST /push-subscribe]
[JS: fetch /sessions → get current session state → render dashboard]
[JS: new EventSource('/events') → open SSE connection]
        ↓
[Server: SSE connection opens]
  → immediately emit 'init' event with current sessions snapshot
        ↓
[Client: renders live session grid]
[Client: listens for 'notification' events → update UI + play audio]
```

### Config Change Flow

```
[User picks voice in UI]
        ↓
[POST /select { voice, template, type }]
        ↓
[config.js: update in-memory config, write config.json to disk]
[tts.js: clearCache(type) — force regeneration of WAVs for new voice]
        ↓
[200 OK → UI confirms selection]
```

## Build Order Implications

The component dependency graph dictates this build order:

1. **Event Bus + Session Store** — no dependencies; everything else reads/writes these.
2. **SSE Broadcaster** — depends on event bus (listens for 'notification'); replaces polling entirely.
3. **Refactored /trigger route** — upgrade local hook to use same project resolution as remote hook; emit to event bus instead of writing bare file.
4. **Static file serving** — extract embedded HTML to `public/`; serve from disk. Prerequisite for building a real dashboard UI.
5. **Dashboard UI** — uses SSE connection (step 2) and sessions endpoint (step 1). Session grid + activity feed.
6. **Service Worker + Web Push** — depends on static file serving (sw.js must be served); requires HTTPS config.
7. **Voice config + template editor UI** — standalone; can be built any time after static extraction.

Steps 1-3 fix the core reliability issues. Steps 4-5 deliver the dashboard. Steps 6-7 add polish.

## Anti-Patterns

### Anti-Pattern 1: Keeping HTML Embedded in server.js

**What people do:** Continue extending the template literal `const html = \`...\`` inside server.js as features grow.

**Why it's wrong:** The UI is already 190 lines of inline HTML/CSS/JS inside a JS string. Adding a dashboard, service worker registration, and config panels will push it past 600-800 lines. No syntax highlighting, no ability to extract into components, breakpoints are unusable.

**Do this instead:** Serve `public/index.html` from disk. Use `fs.readFileSync` once at startup or stream with `fs.createReadStream`. This is the highest-priority structural change.

### Anti-Pattern 2: Continuing to Poll /check

**What people do:** Keep the 1-second `setTimeout(poll, 1000)` loop as a fallback alongside adding SSE.

**Why it's wrong:** Two competing notification channels create race conditions. If polling fires 50ms before the SSE event, the WAV is already playing when the SSE handler fires and tries to play it again. Also, polling requires the mtime-comparison state (`lastTrigger`) to stay in sync with SSE state — they will drift.

**Do this instead:** Remove /check and the polling loop entirely. SSE is strictly better: lower latency, no duplicate events, no missed events between polls, no wasted requests on quiet periods.

### Anti-Pattern 3: Storing Push Subscriptions Only in Memory

**What people do:** Keep push subscriptions in a `Set` or `Array` on the server process.

**Why it's wrong:** PM2 restarts the server when it crashes or when `pm2 restart claude-notify` is run (which happens after every code change). All subscriptions are lost. The next notification silently reaches nobody.

**Do this instead:** Persist subscriptions to `data/subscriptions.json`. On startup, load existing subscriptions. Handle 410 Gone responses from push services by removing the stale entry from the file.

### Anti-Pattern 4: Local Hook That Doesn't Resolve Project Name

**What people do:** Keep `notify-done.sh` writing `{"type":"done","project":""}` — the existing script.

**Why it's wrong:** Every CodeBox session notification says "Done" with no project name. When running 5+ concurrent sessions, the user cannot tell which project finished.

**Do this instead:** Replace `notify-done.sh` with a call to `notify-trigger.js` targeting localhost: `VOICE_NOTIFY_URL=http://localhost:3099 node /path/to/notify-trigger.js done`. This reuses the existing project resolution logic without duplicating it.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| edge-tts (Python CLI) | `child_process.exec()` — shell out, capture exit code | Must be ≥ v7.2.8. Pre-warm cache on /trigger so WAV is ready before browser requests it. |
| Browser Push Services (Google, Mozilla) | `web-push.sendNotification()` via VAPID | Requires HTTPS. Handle 410 Gone by removing subscription. Single-user so subscription list stays tiny. |
| Caddy reverse proxy | Standard HTTP + `X-Accel-Buffering: no` header on SSE routes | The buffering header is critical — Caddy buffers responses by default, which breaks SSE streaming. |
| Tailscale | Network layer only — no code changes needed | Server binds `0.0.0.0:3099`. Tailscale IP (100.123.116.23) is just a routed address. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Hook scripts → Server | HTTP GET /trigger (remote) or file write (local) | Local hook should be upgraded to HTTP too (simpler, same code path) |
| /trigger → Session Store | Direct function call (`sessions.update()`) | Synchronous; session store is a module, not a service |
| /trigger → Event Bus | `bus.emit('notification', event)` | Synchronous fan-out in Node.js EventEmitter |
| Event Bus → SSE Broadcaster | EventEmitter listener | SSE broadcaster registers on startup; auto-cleans dead connections on `res.close` |
| Event Bus → Web Push Sender | EventEmitter listener | Async; push failures should not block or throw |
| Browser → Server (config changes) | Plain HTTP POST | No real-time requirement; request/response is appropriate |
| Browser → Server (session snapshot) | GET /sessions → JSON array | Called once on page load; SSE keeps it current after that |

## Scaling Considerations

This is a single-user system. Scaling is not a concern. The relevant resilience considerations are:

| Concern | Reality | Approach |
|---------|---------|---------|
| Server restarts (PM2 restart after deploys) | Common | Persist push subscriptions to disk; sessions are intentionally ephemeral |
| SSE connection drops (network hiccup) | Occasional | `retry: 3000` in SSE stream tells client to reconnect; `EventSource` auto-reconnects natively |
| edge-tts API failures | Occasional (Microsoft API) | Log error, return 404 for WAV, skip notification rather than blocking |
| Multiple browser tabs open | Rare but possible | SSE broadcaster handles N clients in a Set; no special casing needed |

## Sources

- [WebSockets vs Server-Sent Events (SSE) — Ably](https://ably.com/blog/websockets-vs-sse)
- [SSE vs WebSockets vs Polling — RxDB comprehensive comparison](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [Server-Sent Events in Node.js — DigitalOcean tutorial](https://www.digitalocean.com/community/tutorials/nodejs-server-sent-events-build-realtime-app)
- [Using Server-Sent Events — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Web Push API — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push npm package](https://www.npmjs.com/package/web-push)
- [Web Push Protocol — web.dev](https://web.dev/articles/push-notifications-web-push-protocol)
- [Building Real-Time Dashboards with Node.js — OpenReplay](https://blog.openreplay.com/real-time-dashboards-nodejs/)
- [Event-Driven Architecture in Node.js 2025 — OneUptime](https://oneuptime.com/blog/post/2026-01-30-nodejs-event-driven-architecture/view)

---
*Architecture research for: voice notification system + live coding dashboard*
*Researched: 2026-03-26*
