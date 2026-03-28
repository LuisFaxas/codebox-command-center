# Technology Stack

**Project:** Voice Notifications v2.0 -- Center Console
**Researched:** 2026-03-28
**Focus:** Stack additions for session command center, Manager AI, cross-machine aggregation, screen-filling UI

## Decision Framework

This project values leanness. Every addition must justify itself against "can vanilla JS + Node.js builtins do this?" The bar is: does it save significant complexity, prevent a known pitfall, or enable a capability that's genuinely hard to build from scratch?

## Key Decisions

### 1. UI Framework: Stay Vanilla -- Use Web Components for Encapsulation

**Decision:** Do NOT add React, Svelte, or any UI framework.
**Confidence:** HIGH

**Why:**
- The current codebase is 1584 lines of vanilla HTML/JS/CSS in a single file. The v2 UI will be larger (~3000-4000 lines) but is still a single-user, single-page dashboard -- not a multi-route app with forms, auth, and deep component trees.
- Web Components (Custom Elements + Shadow DOM) are fully supported in all target browsers (Chrome/Edge) with zero polyfills needed. They provide the encapsulation benefits of components without a build step or framework runtime.
- Adding React/Svelte would require: a build step (Vite), a bundler, JSX/template compilation, node_modules bloat, and framework-specific patterns the project doesn't currently use. This violates the "no build step" constraint.
- The dashboard complexity is primarily layout + state rendering, not deep component interaction trees. CSS Grid + container queries handle the layout. A lightweight reactive state store handles the data flow.
- Real-world precedent: multiple fintech dashboards have been built with vanilla JS + Web Components at similar complexity levels, and developers report faster onboarding and better performance than framework equivalents.

**What to use instead:**
- **Custom Elements** for encapsulating session cards, activity feed items, and config panels
- **CSS Grid + Container Queries** for the screen-filling layout
- **Proxy-based reactive store** (hand-rolled, ~50 lines) for state management
- Split `index.html` into multiple files served statically: `index.html`, `components/*.js`, `styles/*.css`

**When to reconsider:** If the UI grows beyond ~5000 lines of JS or needs complex form interactions (unlikely for a monitoring dashboard).

### 2. Bidirectional Communication: Add WebSocket Alongside SSE

**Decision:** Add WebSocket for client-to-server commands. Keep SSE for server-to-client events.
**Confidence:** HIGH

**Why:**
- SSE is perfect for the existing notification push (server -> browser). It auto-reconnects, works through proxies, and the current implementation is clean.
- But v2 needs bidirectional communication: the user sends commands FROM the dashboard TO sessions (dismiss, respond to questions, route attention). SSE cannot do this -- you'd need separate POST requests for each action, losing the persistent connection context.
- The hybrid approach (SSE for events, WebSocket for commands) is the best of both worlds. SSE handles the 90% case (server push) efficiently. WebSocket handles the 10% case (user actions) with low latency and connection state.
- Node.js has a built-in `WebSocket` server in the `ws` module -- the most mature WebSocket library for Node.js, zero native dependencies needed.

**Implementation approach:**
- Keep existing SSE on `/events` for all notification events, session state updates, and config changes
- Add WebSocket on the same HTTP server (upgrade handler) for user commands: dismiss session, mark as read, send instruction to Manager AI, acknowledge question
- WebSocket messages use JSON with `{ action: string, payload: object }` format

| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `ws` | ^8.18 | WebSocket server | Most mature Node.js WS lib, zero native deps, works with existing http.createServer, 25M+ weekly downloads |

### 3. Manager AI Layer: Claude Agent SDK (TypeScript)

**Decision:** Use `@anthropic-ai/claude-agent-sdk` for the Manager AI.
**Confidence:** MEDIUM (SDK is pre-1.0, API may change)

**Why:**
- The Manager AI needs to: monitor active sessions, summarize what each session is doing, report status to the user, and relay instructions to sessions.
- The Claude Agent SDK provides exactly this: `listSessions()` discovers sessions by directory, `query()` with `--resume` can send messages to existing sessions, and hooks (`Notification`, `Stop`, `PostToolUse`) provide real-time event streams.
- Key capabilities verified in official docs:
  - `listSessions({ dir })` returns session metadata (sessionId, summary, lastModified, cwd, gitBranch)
  - `query({ prompt, options: { resume: sessionId } })` resumes a specific session
  - `query()` returns an async generator streaming `AssistantMessage`, `ResultMessage`, `ToolUseMessage` etc.
  - Hooks can intercept and log all tool calls, session starts/stops, and notifications
  - `forkSession` option enables branching conversations
- The SDK runs in the same Node.js process as the notification server -- no separate service needed.
- Current version: `0.2.86` (published March 2026). Pre-1.0 but actively developed with weekly releases.

**Risk:** SDK is pre-1.0 and API surface changes between versions. Pin the exact version and wrap SDK calls in an abstraction layer so changes don't ripple through the codebase.

**What the Manager AI can do (phased):**
1. **Phase 1 (Passive):** List active sessions, show summaries, aggregate status across machines
2. **Phase 2 (Active):** Relay instructions to sessions (e.g., "focus on the auth bug"), summarize session activity
3. **Phase 3 (Autonomous):** Monitor sessions for patterns (stuck, looping, waiting), proactively alert

| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | 0.2.86 | Programmatic Claude Code control | Official SDK, session listing, query/resume, hooks, same-process execution |

### 4. Cross-Machine Session Aggregation: Enhanced Hook Protocol

**Decision:** Extend the existing hook HTTP protocol, not new infrastructure.
**Confidence:** HIGH

**Why:**
- The current system already has cross-machine hooks: `notify-trigger.cjs` runs on remote machines and hits the server's `/trigger` endpoint via HTTP. This works.
- What's missing is richer data: session ID, machine name, working directory, and heartbeat/alive signals.
- The fix is protocol evolution, not new technology. The existing POST body already accepts `{ type, project, sessionId, machine, cwd, timestamp }`. The hooks just need to send all these fields consistently.
- Claude Code hooks (configured in `settings.json`) pass `$CLAUDE_SESSION_ID`, `$CLAUDE_PROJECT_DIR`, and `$CLAUDE_CWD` as environment variables. The hook scripts need to forward these.
- For heartbeat/alive signals: add a `/heartbeat` endpoint that hooks call periodically (every 30s) to signal "session still active." This is simpler and more reliable than trying to monitor processes remotely.

**No new dependencies needed.** The existing Node.js HTTP server handles this.

**Enhancement needed on remote hooks:**
- Update `notify-trigger.cjs` to send `sessionId`, `machine` (hostname), `cwd` in every request
- Add periodic heartbeat calls (configurable interval, default 30s)
- Add hook for `session:start` and `session:end` lifecycle events

### 5. State Management: Proxy-Based Reactive Store

**Decision:** Hand-roll a Proxy-based reactive store (~50-80 lines). Do NOT add Redux, MobX, Zustand, or any state library.
**Confidence:** HIGH

**Why:**
- The current client-side state is already a `Map` (`sessions`) and an array (`activityFeed`) with manual `render*()` calls. This works but doesn't scale -- adding session details, command history, and Manager AI state would mean more scattered render calls.
- A Proxy-based store provides automatic reactivity: change a property, subscribers get notified, affected UI re-renders. This is the vanilla JS equivalent of React's useState/useEffect without the framework.
- The pattern is ~50 lines of code, well-understood, and has zero dependencies. It uses `Proxy` (available in all target browsers since 2016) and a simple subscriber pattern.
- The state shape for v2 is moderate complexity: sessions map, activity feed, config, Manager AI state, UI state (selected session, panel visibility). This fits perfectly in a single reactive store.

**Implementation pattern:**
```javascript
// ~50 lines, no dependencies
function createStore(initialState) {
  const listeners = new Set();
  const handler = {
    set(target, prop, value) {
      target[prop] = value;
      listeners.forEach(fn => fn(prop, value));
      return true;
    }
  };
  const state = new Proxy({ ...initialState }, handler);
  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    batch(fn) { /* batch multiple updates, notify once */ }
  };
}
```

### 6. File Serving: Split HTML into Modules

**Decision:** Split the monolithic `public/index.html` into separate files. Use ES modules for JS, separate CSS files, serve statically.
**Confidence:** HIGH

**Why:**
- The current 1584-line single file is already at the edge of maintainability. Adding session detail views, Manager AI panel, and richer session cards would push it to 3000+ lines in one file.
- Modern browsers support ES modules natively (`<script type="module">`). No build step needed.
- CSS can be split into logical files and loaded with `<link>` tags or `@import`.
- The server already serves static files from `public/`. Extend this to serve `public/components/*.js` and `public/styles/*.css`.

**Proposed structure:**
```
public/
  index.html              -- Shell: layout, script/style imports
  styles/
    base.css              -- Variables, resets, typography
    layout.css            -- Grid layout, panels
    components.css        -- Session cards, feed items, toasts
  components/
    store.js              -- Reactive state store
    sse-client.js         -- SSE connection management
    ws-client.js          -- WebSocket command channel
    session-card.js       -- Session card web component
    session-detail.js     -- Expanded session view
    activity-feed.js      -- Activity feed component
    manager-panel.js      -- Manager AI interaction panel
    toast-system.js       -- Toast notification system
    config-panel.js       -- Voice/notification config
  lib/
    utils.js              -- Shared utilities
```

**Server-side change:** Add a static file handler that serves any file under `public/` with correct MIME types. Currently the server only serves `index.html`, `sw.js`, and `wav/` files explicitly.

## Recommended Stack Additions

### New Server Dependencies

| Library | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| `ws` | ^8.18 | WebSocket server | Bidirectional user commands, handles upgrade on existing http.createServer |
| `@anthropic-ai/claude-agent-sdk` | 0.2.86 (pinned) | Manager AI layer | Session listing, programmatic query/resume, hooks integration |

### No New Client Dependencies

The browser side remains dependency-free. All capabilities come from browser APIs:
- `EventSource` for SSE (existing)
- `WebSocket` for commands (browser built-in)
- `Proxy` for reactive state (ES6)
- Custom Elements for component encapsulation (Web Components)
- CSS Grid + Container Queries for layout (CSS native)
- ES Modules for code organization (browser native)

### Existing Dependencies (Unchanged)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `web-push` | ^3.6.7 | Browser push notifications | Keep -- working, validated |
| `edge-tts` (Python) | ^7.2.8 | Text-to-speech synthesis | Keep -- working, validated |
| `playwright` (dev) | ^1.58.2 | E2E testing | Keep -- dev only |

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| React / Svelte / Vue | Build step required, framework runtime overhead, overkill for single-page monitoring dashboard |
| Vite / Webpack / esbuild | No build step needed -- ES modules work natively in Chrome/Edge |
| TypeScript | Project convention is plain JS. Node v24 erasable TS exists but would change every file. Not worth it for this scope. |
| Express / Fastify | Node.js `http` module works fine. Adding a framework for routing would be over-engineering -- there are ~12 routes total. |
| Redis / SQLite | Session state is ephemeral (in-memory maps). Config is a JSON file. No database needed for a single-user tool. |
| Socket.IO | Overkill -- `ws` is lighter and we don't need Socket.IO's room/namespace features or fallback transport negotiation |
| Zustand / MobX / Redux | 50-line Proxy store covers all state management needs |
| Tailwind CSS | Requires build step. The existing CSS custom properties + utility classes approach is working fine. |
| Docker / containers | Single PM2 process on CodeBox. Containerization adds complexity for zero benefit. |

## Unconventional Approaches Worth Considering

### 1. Terminal-in-Browser via xterm.js
For the "actionable sessions" feature, instead of building a custom chat-like interface to interact with Claude sessions, embed an actual terminal view using xterm.js. This would show the real Claude Code terminal output for each session, making the dashboard feel like a terminal multiplexer (tmux for Claude sessions). **Verdict: Defer to phase-specific research.** The complexity/value tradeoff needs validation.

### 2. Agent SDK as an MCP Server
Instead of the Manager AI calling the Agent SDK directly, expose session management as an MCP server that the dashboard's own Claude context can use. This inverts the control -- the user talks to a Claude instance in the dashboard, which has tools to list/query/resume sessions. **Verdict: Interesting for Phase 3 but premature now.**

### 3. OS-Level Process Monitoring
On CodeBox (Linux), you can detect active Claude Code sessions by scanning for `claude` processes via `/proc`. This gives you session detection without relying on hooks at all -- useful as a fallback when hooks fail. **Verdict: Worth adding as a supplementary signal in the heartbeat system.**

```bash
# Detect active Claude Code sessions on CodeBox
ps aux | grep '[c]laude' | awk '{print $2, $11, $12}'
```

### 4. Shared Memory via BroadcastChannel
If the user opens multiple dashboard tabs, use the BroadcastChannel API to sync state between them. One tab holds the SSE connection, others receive forwarded events. Prevents duplicate SSE connections and duplicate audio playback. **Verdict: Add to v2 as it solves a real annoyance.**

## Installation

```bash
# From project root
pnpm add ws@^8.18
pnpm add @anthropic-ai/claude-agent-sdk@0.2.86
```

Total new production dependencies: **2**
Total new dev dependencies: **0**
Combined install size estimate: ~15MB (ws is tiny, agent SDK is larger but tree-shakeable)

## Integration Points with Existing Code

### server.js Changes
1. Import `ws` and create WebSocket server on same `http.createServer`
2. Add static file serving for `public/**/*` (currently only serves `index.html` and specific paths)
3. Add `/heartbeat` POST endpoint for session alive signals
4. Import Agent SDK for Manager AI endpoints (`/api/sessions`, `/api/session/:id`, `/api/manager/query`)

### sse.js Changes
- None. SSE continues to handle all server-to-client events unchanged.

### Hook Protocol Changes
- `notify-trigger.cjs`: Add `sessionId` (from `$CLAUDE_SESSION_ID`), `machine` (from `os.hostname()`), `cwd` (from `$CLAUDE_CWD`) to POST body
- Add heartbeat interval (30s) during active sessions
- Add `session:start` and `session:end` events

### public/index.html Changes
- Refactor from monolithic file to shell + ES module imports
- Replace inline state management with reactive Proxy store
- Add WebSocket client for user commands
- Restructure layout to fill screen with CSS Grid + container queries

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| Stay vanilla JS (no framework) | HIGH | Current codebase is vanilla, complexity is manageable, Web Components provide encapsulation |
| WebSocket via `ws` | HIGH | Mature library, zero native deps, well-understood pattern for bidirectional comms |
| Agent SDK for Manager AI | MEDIUM | SDK is pre-1.0 (v0.2.86), API may change. Pin version, wrap in abstraction layer. |
| Proxy-based state store | HIGH | Browser-native API, well-documented pattern, ~50 lines of code |
| Enhanced hook protocol | HIGH | Extends existing working system, no new infrastructure needed |
| Split files with ES modules | HIGH | Browser-native, zero build step, immediate maintainability benefit |

## Sources

- [Claude Code Headless/Programmatic Docs](https://code.claude.com/docs/en/headless) -- session resume, `--output-format`, `--continue`
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- `query()`, `listSessions()`, hooks, Options type
- [Agent SDK Hooks Guide](https://platform.claude.com/docs/en/agent-sdk/hooks) -- PreToolUse, PostToolUse, Notification, Stop hooks with full callback signatures
- [WebSocket.org: SSE vs WebSocket](https://websocket.org/comparisons/sse/) -- comparison of bidirectional capabilities
- [SSE beats WebSockets for 95% of real-time apps](https://dev.to/polliog/server-sent-events-beat-websockets-for-95-of-real-time-apps-heres-why-a4l) -- SSE advantages, when WebSocket is actually needed
- [@anthropic-ai/claude-agent-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) -- version 0.2.86, published March 2026
- [ws on npm](https://www.npmjs.com/package/ws) -- WebSocket library for Node.js
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) -- Proxy-based reactive patterns
- [CSS Container Queries Guide](https://devtoolbox.dedyn.io/blog/css-container-queries-guide) -- responsive component layouts without media queries
- [Vanilla JS State Management with Proxies](https://dev.to/christosmaris/vanilla-js-state-management-using-proxies-19l5) -- implementation pattern
