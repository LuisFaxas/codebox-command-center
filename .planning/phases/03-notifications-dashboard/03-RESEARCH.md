# Phase 3: Notifications Dashboard - Research

**Researched:** 2026-03-28
**Domain:** Browser notifications (voice + push + toast), real-time dashboard UI, service worker push delivery
**Confidence:** HIGH

## Summary

Phase 3 replaces the existing voice picker UI (213 lines) with a premium monitoring dashboard that delivers triple-fire notifications (voice TTS, browser push, visual toast) and shows real-time session status. The existing server infrastructure (SSE event bus, config persistence, TTS generation) from Phases 1-2 provides the foundation -- this phase is primarily frontend work with a service worker addition and server-side config/push extensions.

The three notification channels have different technical stacks: voice uses the existing Audio API + /notify-wav endpoint, browser push requires a service worker + web-push npm library + VAPID keys, and toasts are pure DOM manipulation. The dashboard session grid consumes existing SSE `session:alive` and `trigger` events. The config UI extends the existing /select and /config endpoints with rate and pitch fields.

**Primary recommendation:** Use web-push@3.6.7 for server-side push delivery, a minimal service worker for push reception, the existing Notification API for permission management, and vanilla CSS with CSS custom properties for the Grafana-style dark dashboard theme. No CSS framework needed -- the project has zero npm dependencies beyond web-push, and the aesthetic requires custom work anyway.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Premium, industry-leading monitoring dashboard design. Research the best dashboard patterns for this use case -- not a simple voice picker, but a proper notification monitoring console.
- **D-02:** Dark monitoring console style (Grafana/Datadog aesthetic). Dark background, neon status indicators, compact data-dense layout. Keeps the current dark + red accent vibe but elevated to professional quality.
- **D-03:** When a trigger fires, all three notification channels activate simultaneously: voice (TTS audio), browser push notification, and visual toast in the dashboard.
- **D-04:** Graceful push fallback -- if browser push permission is denied, voice + toast still fire. Show a subtle banner suggesting enabling push. Never block notifications because push is unavailable.
- **D-05:** Visual differentiation between done and question events is Claude's Discretion. Research best practices for monitoring dashboards -- color-coding, icons, positioning, or a combination.
- **D-06:** Each session card shows: project name + status indicator, machine name, last activity timestamp, and session duration.
- **D-07:** Session TTL (when sessions disappear from grid) is Claude's Discretion. Research appropriate monitoring dashboard patterns.
- **D-08:** Config UX pattern (sidebar, modal, overlay) is Claude's Discretion. Research the best approach for a monitoring-style dashboard.
- **D-09:** Voice config (voice, rate, pitch) is separate per notification type (done vs question). Currently config.js already stores per-type config -- extend with rate and pitch.

### Claude's Discretion
- Overall page structure and component organization
- Toast position, duration, stacking behavior
- Session card visual design and status state machine (working/done/needs attention)
- Whether to use CSS framework or vanilla CSS
- Notification feed/history design (if included)
- How rate/pitch sliders interact with voice preview
- Service worker strategy for push notifications
- Whether to split index.html into multiple JS files or keep as single file

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-01 | Voice notification plays on Stop event with project name | Existing trigger SSE event + /notify-wav endpoint + Audio API |
| VOICE-02 | Voice notification plays on AskUserQuestion event with project name | Same mechanism as VOICE-01, type=question in trigger event |
| VOICE-03 | Stop and question events use different voice configurations | config.js already stores per-type config; extend with rate/pitch |
| VOICE-04 | Voice selection panel with audition per notification type | Extend existing /generate + /samples + /wav endpoints; add rate/pitch to generation |
| VOICE-05 | Rate and pitch configurable per notification type | edge-tts --rate and --pitch params; config schema extension |
| PUSH-01 | Browser push notification fires when tab is in background | Service worker + Push API + web-push library |
| PUSH-02 | Push notification includes project name and event type | Push payload carries project + type fields |
| PUSH-03 | Service worker registered for background push delivery | sw.js with push event listener + showNotification() |
| PUSH-04 | VAPID keys generated and persisted to disk | web-push.generateVAPIDKeys() + save to data/vapid.json |
| PUSH-05 | User prompted for notification permission on first visit | Notification.requestPermission() with UX best practices |
| VIS-01 | Toast notification appears in-app for each event | DOM-based toast system on SSE trigger event |
| VIS-02 | Toast differentiates between done and question events | Color coding + icon differentiation |
| VIS-03 | Toast includes project name | Template rendering with {project} substitution |
| TMPL-01 | User can customize notification message templates per event type | Config UI with template input per type |
| TMPL-02 | Templates support {project} placeholder | Already implemented in config.js template system |
| TMPL-03 | Template changes apply to voice, push, and toast | All three channels read from same config[type].template |
| TMPL-04 | Templates persist across server restarts | Already implemented -- config.js saves to data/config.json |
| DASH-01 | Session status board shows all active Claude Code projects | SSE session:alive + trigger events build session state |
| DASH-02 | Each session displays status: working/done/needs attention | State machine derived from event types and timing |
| DASH-03 | Status updates in real-time via SSE | Existing SSE infrastructure from Phase 2 |
| DASH-04 | Activity feed shows chronological event stream | Client-side array of trigger events, rendered as list |
| DASH-05 | Activity feed shows project name, event type, timestamp | Fields already present in trigger SSE event payload |
| UI-01 | Single polished web app served from CodeBox | Replace public/index.html with dashboard |
| UI-02 | Beautiful, modern design | Grafana/Datadog dark monitoring aesthetic per D-02 |
| UI-03 | Accessible via LAN and Tailscale | Already works -- server binds 0.0.0.0:3099 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| web-push | 3.6.7 | Server-side push notification delivery | Only maintained Node.js Web Push library; handles VAPID signing and payload encryption |
| Notification API | Browser built-in | Permission management + foreground notifications | Standard Web API, no library needed |
| Push API | Browser built-in | Background push subscription + reception | Standard Web API, works with service worker |
| EventSource | Browser built-in | SSE connection (already implemented) | Already in use from Phase 2 |
| edge-tts | 7.2.8 (Python) | TTS voice generation | Already installed and in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Custom Properties | Browser built-in | Theming system for dark dashboard | Always -- define color palette, spacing, border-radius as variables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| web-push | Manual VAPID signing | Enormous complexity for no benefit; web-push handles all encryption |
| CSS framework (Tailwind) | Vanilla CSS | Project has zero npm deps; CSS framework adds build step; Grafana aesthetic needs custom work anyway |
| Multiple JS files | Single index.html | For this scale (~500-800 lines JS), a single file with clear sections is simpler than module splitting without a bundler |

**Installation:**
```bash
cd /home/faxas/workspaces/projects/personal/voice_notifications
pnpm add web-push
```

**Version verification:** web-push@3.6.7 is current latest on npm (verified 2026-03-28). edge-tts 7.2.8 installed on system.

## Architecture Patterns

### Recommended Project Structure
```
public/
  index.html          # Dashboard SPA (replaces current voice picker)
  sw.js               # Service worker for push notifications
server.js             # Entry + routing (add /subscribe, /push endpoints)
sse.js                # SSE event bus (unchanged)
config.js             # Config persistence (extend schema with rate, pitch, vapid)
tts.js                # TTS generation (extend with rate/pitch params)
push.js               # NEW: Push notification module (VAPID keys, subscription store, send)
data/
  config.json         # Voice/template config (extended with rate, pitch)
  vapid.json          # VAPID key pair (generated once, persisted)
  subscriptions.json  # Push subscription endpoints (one per browser)
```

### Pattern 1: Triple-Fire Notification Architecture
**What:** When a trigger SSE event arrives at the client, three independent notification channels fire in parallel
**When to use:** Every trigger event
**Example:**
```javascript
// Client-side trigger handler
eventSource.addEventListener('trigger', async (e) => {
  const data = JSON.parse(e.data);

  // 1. Voice: play TTS audio
  const audio = new Audio(`/notify-wav?type=${data.type}&project=${encodeURIComponent(data.project)}&t=${Date.now()}`);
  audio.play();

  // 2. Toast: show in-app notification
  showToast(data.type, data.project);

  // 3. Push handled server-side -- service worker receives it independently
  // (server sends push when trigger fires, SW shows notification)
});
```

### Pattern 2: Server-Side Push on Trigger
**What:** Server sends web push to all subscribed browsers when a trigger fires, so background tabs receive notifications
**When to use:** On every /trigger POST, after SSE emit
**Example:**
```javascript
// In server.js trigger handler, after emit('trigger', ...)
import { pushToAll } from './push.js';

// Fire-and-forget -- don't block trigger response
pushToAll(type, project).catch(() => {});
```

### Pattern 3: Session State Machine (Client-Side)
**What:** Client maintains a Map of sessions derived from SSE events
**When to use:** Dashboard session grid
**Example:**
```javascript
const sessions = new Map(); // key: sessionId

// On trigger event
sessions.set(sessionId, {
  project, machine, status: type === 'question' ? 'needs-attention' : 'done',
  lastActivity: Date.now(), startedAt: sessions.get(sessionId)?.startedAt || Date.now()
});

// On session:alive event
sessions.set(sessionId, {
  ...sessions.get(sessionId), status: 'working', lastActivity: Date.now()
});

// TTL check: remove sessions inactive > 30 minutes
// (Grafana-style: stale panels gray out, then disappear)
```

### Pattern 4: VAPID Key Persistence
**What:** Generate VAPID keys once, save to data/vapid.json, load on startup
**When to use:** Server initialization
**Example:**
```javascript
import webPush from 'web-push';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const VAPID_PATH = join(DATA_DIR, 'vapid.json');

function loadOrGenerateVapid() {
  if (existsSync(VAPID_PATH)) {
    return JSON.parse(readFileSync(VAPID_PATH, 'utf8'));
  }
  const keys = webPush.generateVAPIDKeys();
  const vapid = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  writeFileSync(VAPID_PATH, JSON.stringify(vapid, null, 2));
  return vapid;
}
```

### Pattern 5: Grafana-Style Dashboard Layout
**What:** CSS Grid for responsive monitoring layout with header, session grid, activity feed, and config panel
**When to use:** Main page structure
**Example:**
```css
:root {
  --bg-primary: #0d1117;
  --bg-card: #161b22;
  --bg-input: #0d1117;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --accent-done: #3fb950;      /* green for done */
  --accent-question: #f0883e;  /* amber for question/attention */
  --accent-working: #58a6ff;   /* blue for working */
  --accent-danger: #f85149;    /* red for errors */
  --glow-done: 0 0 8px rgba(63, 185, 80, 0.4);
  --glow-question: 0 0 8px rgba(240, 136, 62, 0.4);
}

.dashboard {
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-rows: auto 1fr;
  gap: 16px;
  height: 100vh;
  padding: 16px;
}

.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
```

### Anti-Patterns to Avoid
- **Blocking on push delivery:** Never await push.sendNotification() in the trigger response path -- fire and forget. Push delivery can be slow or fail; it must not delay the SSE emit or HTTP response.
- **Polling for session state:** Never poll the server for session updates. All state flows through SSE events. The client builds session state from the event stream.
- **Storing session state server-side for the dashboard:** Sessions are transient and only need client-side tracking. The server emits events; the client computes state. This avoids server-side cleanup complexity.
- **Requesting Notification permission immediately on page load:** Browsers penalize this. Show a custom "Enable push notifications" button/banner first, then call requestPermission() on click.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAPID key signing | Custom crypto for push payload encryption | web-push npm library | RFC 8291 encryption is complex; web-push handles it correctly |
| Push subscription management | Custom subscription database | JSON file in data/ directory | Single-user system; one browser = one subscription; no database needed |
| TTS rate/pitch parsing | Custom string formatting for edge-tts params | Direct string interpolation | edge-tts accepts simple format: `--rate="+20%"` `--pitch="+5Hz"` |
| SSE reconnection | Custom retry logic | Browser's native EventSource auto-reconnect | Already implemented in Phase 2; EventSource handles reconnection per spec |

**Key insight:** This project's constraint is "no npm dependencies beyond edge-tts." web-push is the single justified exception because VAPID signing and payload encryption are cryptographically complex. Everything else (toasts, dashboard layout, session tracking) is straightforward DOM/CSS work that does not need libraries.

## Common Pitfalls

### Pitfall 1: Audio Autoplay Blocked in Background Tabs
**What goes wrong:** Browser refuses to play audio via `new Audio().play()` when the tab is not focused, or if user hasn't interacted with the page yet
**Why it happens:** Chrome's autoplay policy requires a user gesture before audio can play. Background tabs have stricter restrictions.
**How to avoid:** The SSE trigger event starts audio playback, which works IF the user has previously interacted with the page (clicked anything). Add a one-time "click to enable" interaction on first visit. For truly background delivery, the push notification is the fallback (it can't play audio, but it shows the system notification).
**Warning signs:** Audio plays fine when tab is focused but silently fails when tab is in background.

### Pitfall 2: Service Worker Scope Mismatch
**What goes wrong:** Service worker can't intercept push events because it's registered with wrong scope
**Why it happens:** sw.js must be served from the root path (`/sw.js`) or the scope must explicitly cover `/`. If served from `/public/sw.js`, the default scope would be `/public/`.
**How to avoid:** Serve sw.js from the root URL path in server.js (add a route for `/sw.js`). Or register with explicit scope: `navigator.serviceWorker.register('/sw.js', { scope: '/' })`.
**Warning signs:** Service worker registers successfully but push events never fire.

### Pitfall 3: Push Subscription Expiration
**What goes wrong:** Push notifications stop working after days/weeks without visible error
**Why it happens:** Push subscriptions can expire. The browser may revoke the subscription. The endpoint URL becomes invalid.
**How to avoid:** Re-subscribe on every page load (check `pushManager.getSubscription()` first). If subscription exists, send it to server anyway (server updates stored endpoint). Handle 410 Gone responses from push service by removing stale subscriptions.
**Warning signs:** Push worked initially but stopped; no server-side error logging.

### Pitfall 4: Config Schema Migration
**What goes wrong:** Existing config.json (from Phase 1-2) lacks rate and pitch fields; server reads undefined values
**Why it happens:** config.js currently stores `{ voice, template }` per type. Phase 3 adds `{ voice, template, rate, pitch }`.
**How to avoid:** Apply defaults on load: `config[type].rate = config[type].rate || '+0%'` and same for pitch. Never assume fields exist in persisted config.
**Warning signs:** edge-tts called with `--rate=undefined` producing error or unexpected behavior.

### Pitfall 5: Multiple Browser Tabs Cause Duplicate Notifications
**What goes wrong:** User has 2 tabs open; both play voice audio on trigger event, creating echo/doubling
**Why it happens:** Each tab has its own SSE connection and trigger event listener. Both fire independently.
**How to avoid:** Use a BroadcastChannel or localStorage event to coordinate between tabs -- only one tab plays audio. Alternatively, accept the limitation and document "use one tab" (simpler, fits single-user use case). Push notifications are naturally deduplicated by the browser (one notification per push).
**Warning signs:** Audio plays twice simultaneously.

### Pitfall 6: edge-tts Rate/Pitch Parameter Format
**What goes wrong:** TTS generation fails silently when rate or pitch values have wrong format
**Why it happens:** edge-tts expects specific formats: rate is percentage like `"+20%"` or `"-10%"`, pitch is Hz like `"+5Hz"` or `"-10Hz"`. Missing the `+`/`-` prefix or unit suffix causes silent failure.
**How to avoid:** Validate and format on the server before passing to edge-tts. Store numeric values in config (-50 to +50 range), then format: `rate > 0 ? '+' + rate + '%' : rate + '%'`.
**Warning signs:** generateCached() callback fires with error but no audio file is produced.

## Code Examples

### Service Worker for Push (sw.js)
```javascript
// Source: MDN Push API docs + web.dev push notifications guide
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.type === 'question'
    ? 'Claude needs attention'
    : 'Claude is done';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.project ? `${data.project} - ${data.type}` : data.type,
      icon: '/icon-192.png',  // optional
      tag: `claude-${data.type}-${data.project}`,  // deduplicates
      renotify: true,
      requireInteraction: data.type === 'question',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      if (windowClients.length > 0) {
        windowClients[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
```

### Push Subscription (Client-Side)
```javascript
// Source: MDN Push API + web.dev subscribe guide
async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Fetch VAPID public key from server
  const vapidRes = await fetch('/vapid-public-key');
  const { publicKey } = await vapidRes.json();

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Send subscription to server
  await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}
```

### Push Module (Server-Side push.js)
```javascript
import webPush from 'web-push';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './config.js';

const VAPID_PATH = join(DATA_DIR, 'vapid.json');
const SUBS_PATH = join(DATA_DIR, 'subscriptions.json');

let vapidKeys = null;
let subscriptions = [];

export function loadPush() {
  // Load or generate VAPID keys
  if (existsSync(VAPID_PATH)) {
    vapidKeys = JSON.parse(readFileSync(VAPID_PATH, 'utf8'));
  } else {
    vapidKeys = webPush.generateVAPIDKeys();
    writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2));
  }

  webPush.setVapidDetails(
    'mailto:admin@codebox.local',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  // Load subscriptions
  if (existsSync(SUBS_PATH)) {
    try { subscriptions = JSON.parse(readFileSync(SUBS_PATH, 'utf8')); } catch(e) { subscriptions = []; }
  }
}

export function getPublicKey() {
  return vapidKeys.publicKey;
}

export function addSubscription(sub) {
  // Replace if same endpoint exists
  subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
  subscriptions.push(sub);
  writeFileSync(SUBS_PATH, JSON.stringify(subscriptions, null, 2));
}

export async function pushToAll(type, project) {
  const payload = JSON.stringify({ type, project, timestamp: Date.now() });
  const results = await Promise.allSettled(
    subscriptions.map(sub => webPush.sendNotification(sub, payload))
  );

  // Remove expired subscriptions (410 Gone)
  const valid = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' || (result.reason && result.reason.statusCode !== 410)) {
      valid.push(subscriptions[i]);
    }
  });
  if (valid.length !== subscriptions.length) {
    subscriptions = valid;
    writeFileSync(SUBS_PATH, JSON.stringify(subscriptions, null, 2));
  }
}
```

### Toast Notification System
```javascript
// Source: Standard monitoring dashboard pattern
const toastContainer = document.getElementById('toast-container');

function showToast(type, project) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'question' ? '?' : '!';  // or SVG icons
  const label = type === 'question' ? 'Needs Attention' : 'Done';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <strong>${label}</strong>
      <span>${project || 'Unknown project'}</span>
    </div>
    <span class="toast-time">${new Date().toLocaleTimeString()}</span>
  `;

  toastContainer.prepend(toast);

  // Auto-dismiss after 8 seconds (question toasts stay longer: 15s)
  const duration = type === 'question' ? 15000 : 8000;
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
```

### Config Schema Extension for Rate/Pitch
```javascript
// config.js update pattern
const defaults = {
  done: { voice: 'en-US-GuyNeural', template: 'Done with {project}', rate: '+0%', pitch: '+0Hz' },
  question: { voice: 'en-US-GuyNeural', template: 'I need your attention at {project}', rate: '+0%', pitch: '+0Hz' },
};

// On load, merge with defaults to handle migration from old config
export function load() {
  // ... existing load logic ...
  for (const type of ['done', 'question']) {
    config[type] = { ...defaults[type], ...config[type] };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCM/FCM for push | VAPID (Voluntary Application Server Identity) | 2018+ | No Google dependency; self-hosted push possible |
| Polling for notifications | SSE + Push API | Already migrated (Phase 2) | Real-time delivery, lower overhead |
| Single notification channel | Triple-fire (voice + push + toast) | This phase | Redundancy ensures user never misses event |

**Deprecated/outdated:**
- GCM API keys for push: Replaced by VAPID. web-push library supports VAPID natively.
- `ServiceWorkerRegistration.update()` for refreshing: Modern browsers auto-update service workers within 24 hours.

## Open Questions

1. **Multiple tab audio coordination**
   - What we know: Each tab with an SSE connection will independently play voice audio on trigger
   - What's unclear: Whether BroadcastChannel coordination is worth the complexity for a single-user system
   - Recommendation: Accept single-tab-active as the norm. Document "keep one dashboard tab open." The push notification provides redundancy for background tabs.

2. **Session TTL value**
   - What we know: Grafana typically grays out stale panels after 5 minutes, removes after configurable duration
   - What's unclear: How long Claude Code sessions typically last between activity
   - Recommendation: 30 minutes TTL with visual degradation: active (blue glow) -> stale after 5 min (dim) -> removed after 30 min. This can be tuned later.

3. **web-push maintenance status**
   - What we know: Latest version 3.6.7 published ~2 years ago; Snyk reports "healthy" maintenance; 50+ contributors
   - What's unclear: Whether there are breaking issues with Node.js v24
   - Recommendation: Install and test immediately. If it fails on Node 24, the Notification API alone (without Push API for background) is the fallback -- voice + toast still work in foreground tab.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server | Yes | v24 | -- |
| edge-tts | Voice TTS | Yes | 7.2.8 | -- |
| pnpm | Package install | Yes | Available | -- |
| web-push (npm) | Push notifications | Not yet installed | 3.6.7 (to install) | Notification API in foreground only |
| Service Worker API | Push delivery | Yes (Chrome/Edge) | -- | Notification API fallback |

**Missing dependencies with no fallback:**
- None -- all critical dependencies available

**Missing dependencies with fallback:**
- web-push: needs `pnpm add web-push`. If it fails on Node 24, push degrades to foreground-only Notification API (voice + toast still work).

## Project Constraints (from CLAUDE.md)

- **No npm/yarn:** Use pnpm exclusively
- **No framework:** Vanilla JS + Node.js built-ins (web-push is the only justified npm dependency)
- **Plain JavaScript:** No TypeScript
- **ES modules:** `"type": "module"` in package.json
- **2-space indentation** throughout
- **camelCase** functions, **UPPER_SNAKE_CASE** constants
- **edge-tts** for TTS -- no paid API keys
- **Port 3099** default
- **GSD workflow enforcement:** Use GSD commands for code changes

## Discretion Recommendations

### D-05: Event Differentiation (Claude's Discretion)
**Recommendation:** Use color + icon combination. Done events: green accent with checkmark icon. Question events: amber/orange accent with question mark icon. This is the standard in every monitoring tool (Grafana, Datadog, PagerDuty). Color alone fails for colorblind users; icons alone lack visual punch. Both together provide instant recognition.

### D-07: Session TTL (Claude's Discretion)
**Recommendation:** Three-tier system:
- **Active** (blue glow): received event within last 2 minutes
- **Stale** (dimmed, no glow): no event for 5+ minutes
- **Removed**: no event for 30+ minutes (session card disappears)

### D-08: Config UX Pattern (Claude's Discretion)
**Recommendation:** Slide-out panel from the right edge, triggered by a gear icon in the header. This is the standard Grafana/Datadog pattern for settings that are used occasionally but shouldn't consume main viewport. A modal would block the dashboard view; a sidebar permanently consumes space. The slide-out panel overlays the right portion, keeping session grid visible.

### Toast Design (Claude's Discretion)
**Recommendation:** Top-right corner, stacking downward, max 5 visible. Auto-dismiss: 8s for done, 15s for question. This is the standard position (Grafana, GitHub, Slack all use top-right). Question toasts stay longer because they require user action. Stacking limit prevents screen flooding during burst events.

### File Organization (Claude's Discretion)
**Recommendation:** Keep as single index.html with clearly sectioned `<script>` and `<style>` blocks. At ~500-800 lines total (HTML + CSS + JS), splitting into separate files adds complexity without a bundler. The project deliberately avoids build tools. Use comment sections like `// === TOAST SYSTEM ===` for navigation.

## Sources

### Primary (HIGH confidence)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) - Push API interfaces, browser support, security model
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API) - Permission model, foreground vs persistent notifications
- [web.dev Push Notifications](https://web.dev/articles/push-notifications-subscribing-a-user) - Subscription flow, VAPID usage
- [web-push npm](https://www.npmjs.com/package/web-push) - Library API, VAPID key generation
- [edge-tts CLI](https://github.com/rany2/edge-tts) - Rate/pitch parameter format verification
- edge-tts --help output on CodeBox - Verified rate (percentage), pitch (Hz), volume (percentage) parameters

### Secondary (MEDIUM confidence)
- [Demystifying Web Push Notifications](https://pqvst.com/2023/11/21/web-push-notifications/) - Complete implementation walkthrough verified against MDN docs
- [web-push GitHub](https://github.com/web-push-libs/web-push) - Library maintenance status, contributor count

### Tertiary (LOW confidence)
- web-push Node 24 compatibility - Not verified; library last published 2 years ago. Needs install test.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - web-push is the definitive Node.js push library; all other components are browser built-ins
- Architecture: HIGH - Pattern follows existing server structure; SSE event bus already supports all needed event types
- Pitfalls: HIGH - Audio autoplay, service worker scope, subscription expiration are well-documented browser behaviors
- Push notifications: MEDIUM - web-push on Node 24 untested; graceful fallback exists

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- Web Push API and edge-tts are mature)
