# Project Research Summary

**Project:** voice_notifications
**Domain:** Real-time developer notification dashboard — Claude Code hooks, SSE, Web Push, voice TTS
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This project is a single-user, self-hosted notification server for Claude Code that already exists as a working prototype (Node.js v24, PM2, edge-tts, ~420-line monolith). The research consensus is clear: the existing architecture is sound, but three structural problems must be fixed before any UI or feature work can succeed — (1) hook reliability, (2) the file-based polling IPC, and (3) the embedded HTML anti-pattern. None of these require a rewrite; they require targeted surgical changes. The recommended approach is to evolve the existing server.js in-place, extract the frontend to a Vite vanilla-ts SPA, and replace polling with SSE. No frameworks, no SaaS dependencies, no databases.

The recommended stack minimizes surface area: native SSE (zero deps) replaces polling, `web-push` (the canonical VAPID library) enables background browser push, Vite + vanilla TypeScript handles the frontend build, and Tailwind v4 via a Vite plugin covers styling. This is strictly additive to the existing system — edge-tts, PM2, and the server.js entry point all stay. The highest-risk technical element is the `web-push` npm package (last published ~2 years ago), but for a single-user tool the fallback (SSE + in-app toasts only) is fully acceptable if push endpoints stop working.

The primary risks are implementation traps rather than design risks. Claude Code has confirmed bugs where hooks fail silently in subdirectories and `AskUserQuestion` fires through `PermissionRequest` (not `PostToolUse`). The `Stop` hook fires for sub-agents, causing notification floods. Caddy kills idle SSE connections without heartbeats. These are all known and avoidable with specific code patterns documented in PITFALLS.md. Building in the wrong order — adding UI before fixing hook reliability — will make every subsequent phase unreliable.

## Key Findings

### Recommended Stack

The existing server (plain Node.js v24, no package.json) stays as-is. The only server-side dependency addition is `web-push@3.6.7` for VAPID-signed browser push. SSE is implemented natively — no library needed (`Content-Type: text/event-stream`, browser `EventSource`). The frontend migrates from an embedded HTML string to a `frontend/` Vite vanilla-ts package, built to `frontend/dist/` and served as static files from the existing server.

**Core technologies:**
- **Node.js v24 (existing):** HTTP server, SSE broadcaster, Web Push sender — no version change needed
- **SSE (native):** Replaces 1s polling — strictly better: lower latency, no missed events, zero deps
- **web-push@3.6.7:** The canonical VAPID library for background browser push — used by tens of millions of sites, self-hosted, no external account required
- **Vite@8.x + vanilla-ts:** Frontend build pipeline — replaces the 190-line embedded HTML string with a maintainable TypeScript SPA; Node.js v24 satisfies Vite's v20.19+ requirement
- **Tailwind CSS v4 (@tailwindcss/vite):** Zero-runtime utility styling via Vite plugin — no PostCSS config, no CDN, no custom CSS required
- **Notyf@3.10.0:** 3KB in-app toast library — zero dependencies, ES module build, works with Vite

### Expected Features

**Must have (table stakes) — v1:**
- Reliable hook firing for `Stop` and `AskUserQuestion` (`PermissionRequest`) events
- Project name from folder basename in every notification — identity is a prerequisite for everything else
- Voice notification on stop + question, differentiated by event type
- SSE real-time connection replacing 1-second polling
- Visual toast in the active tab
- Browser push notification when the tab is backgrounded (Web Push API + service worker)
- Session status dashboard: working / done / needs attention per project

**Should have (competitive) — v1.x:**
- Chronological activity feed across all project sessions
- Multi-machine session aggregation (Lenovo + Mac hooks report to CodeBox)
- Per-event voice configuration (rate, pitch, template per event type)
- Snooze / mute per project

**Defer (v2+):**
- Persistent notification history / SQLite log
- Session duration tracking
- PWA manifest for mobile push
- Notification template editor UI

### Architecture Approach

The architecture centers on a Node.js `EventEmitter` as the internal event bus. All hook sources (local shell writes or remote HTTP POSTs) converge at `/trigger`, which writes to an in-memory session `Map` and emits a `notification` event. The SSE broadcaster and Web Push sender are independent listeners on the event bus — decoupled from each other and from the trigger handler. The frontend is a static Vite SPA served from `public/` (never embedded in JS strings). Push subscriptions are persisted to `data/subscriptions.json` so server restarts do not invalidate them. Config (voice preferences) is disk-backed in `config.json`.

**Major components:**
1. **Event Bus (EventEmitter singleton)** — the single conduit for all notification events; everything else is a listener
2. **Session Store (in-memory Map)** — authoritative state for the session grid; ephemeral by design (stale sessions auto-clear on restart)
3. **SSE Broadcaster** — holds a `Set` of open response streams; fans out to all connected clients on every `notification` event
4. **TTS Engine (edge-tts wrapper)** — caches WAV files by `(type, project)` key; serializes synthesis calls to prevent concurrent 403s
5. **Web Push Sender (web-push)** — sends VAPID-signed notifications to all registered browser endpoints
6. **Service Worker** — registered from `public/sw.js`; handles `push` events and shows OS-level notifications when the tab is not active
7. **Dashboard SPA (Vite frontend)** — session grid, activity feed, config panel; communicates via SSE (live data) and HTTP POST (config changes)

### Critical Pitfalls

1. **Wrong hook event for AskUserQuestion** — Use `PermissionRequest` with `tool: "AskUserQuestion"`, NOT `PreToolUse`. Using `PreToolUse` causes double-triggering; question notifications never fire otherwise. Confirmed via GitHub issue #15872.

2. **Hooks non-functional in subdirectories** — Confirmed bugs (#10367, #8810, #9039) where hooks silently fail when Claude Code is launched from a project directory. Fix: use global `~/.claude/settings.json` (not project-local), and prefix all hook command paths with `$CLAUDE_PROJECT_DIR`. Smoke-test by touching a temp file from the actual project directory.

3. **Stop hook fires for every sub-agent, not just session end** — Results in 3-4 "Claude is done" voices mid-task. Fix: add server-side debounce — ignore Stop events from the same project within a 10-second cooldown window.

4. **Caddy proxy kills idle SSE connections** — Caddy's default keepalive timeout is 2 minutes. Without a 30-second SSE heartbeat (`:\n\n`) and `flush_interval -1` in Caddy config, the dashboard disconnects every ~2 minutes. Must be built into SSE from the start.

5. **SSE connection leak** — If `req.on('close', () => clients.delete(res))` is not wired on every SSE connection, the client Set grows indefinitely. After 24+ hours, this degrades the server. Always log `clients.size` in periodic heartbeats so leaks are visible.

6. **Web Push requires a service worker, not just the Notifications API** — `new Notification()` only works when the tab is focused. Background notifications require a registered service worker with `PushManager.subscribe()`. Using the wrong API produces zero errors but background notifications never appear.

7. **edge-tts 403 errors fail silently** — Microsoft periodically changes auth for the unofficial Edge TTS endpoint. Versions below v7.2.8 break silently (server returns 200, no audio plays). Fix: pin `edge-tts>=7.2.8`, capture stderr from the Python subprocess, and run a startup self-test that synthesizes a short phrase.

## Implications for Roadmap

Based on the dependency graph and pitfall phase mappings, four phases are recommended in strict dependency order:

### Phase 1: Hook Reliability + Project Identity

**Rationale:** Everything downstream — voice, push, SSE, dashboard — depends on hook events actually firing with correct project names. This is the load-bearing foundation. Building Phase 2 before this is confirmed working produces unreliable testing conditions for all subsequent phases.

**Delivers:** All hook events (Stop, AskUserQuestion via PermissionRequest) fire reliably from any project directory on CodeBox and Lenovo; every event carries the correct project basename.

**Addresses (from FEATURES.md):** Reliable hook firing (P1), project name resolution (P1)

**Avoids (from PITFALLS.md):** Wrong hook event (#1), subdirectory non-function (#2), sub-agent flood (#3), remote path resolution (#9)

**Implementation notes:** Switch local hook from file write to HTTP POST (same code path as remote); add server-side debounce; add smoke-test hook; fix `notify-trigger.js` to handle Windows path separators with `path.basename()`.

### Phase 2: SSE Real-Time Connection + Server Restructure

**Rationale:** SSE must replace polling before any UI or push work begins. The polling race condition loses events and will produce unreliable test results for every subsequent feature. Server restructure (extract HTML to `public/`, introduce `src/` modules) happens here because it is the prerequisite for building a maintainable dashboard in Phase 3.

**Delivers:** Zero-latency server-to-client event delivery; server restructured into `src/events.js`, `src/sessions.js`, `src/sse.js`; HTML extracted to `public/`; polling eliminated.

**Uses (from STACK.md):** Native SSE, Node.js EventEmitter, Vite vanilla-ts (scaffold, not yet built out)

**Implements (from ARCHITECTURE.md):** Event Bus, SSE Broadcaster, Session Store, static file serving

**Avoids (from PITFALLS.md):** Polling race (#4), SSE connection leak (#5), Caddy proxy timeout (#6)

**Implementation notes:** Add `X-Accel-Buffering: no` header and 30-second heartbeat from the start. Test exclusively through Caddy URL during development.

### Phase 3: Dashboard UI + Browser Push Notifications

**Rationale:** With reliable events (Phase 1) and real-time transport (Phase 2) in place, the frontend can be built with confidence that events actually arrive. Web Push is grouped here because it shares the service worker registration step with the frontend SPA and requires HTTPS (already provided by Caddy).

**Delivers:** Vite SPA with session grid (working/done/needs attention), activity feed, visual toasts (Notyf), browser push notifications for backgrounded tabs.

**Uses (from STACK.md):** Vite@8.x, Tailwind CSS v4, Notyf@3.10.0, web-push@3.6.7, Service Worker API

**Implements (from ARCHITECTURE.md):** Dashboard UI, Service Worker, Web Push Sender, VAPID key setup

**Avoids (from PITFALLS.md):** Wrong notification API (#7), VAPID key rotation (#8 — persist keys to disk), browser push permission UX anti-pattern (request only on explicit user action)

**Implementation notes:** Persist VAPID keys to `data/vapid-keys.json` on first run. Handle 410 Gone from push services by removing stale subscription. Persist subscriptions to `data/subscriptions.json`.

### Phase 4: Multi-Machine Aggregation + Polish

**Rationale:** Multi-machine (Lenovo + Mac reporting to CodeBox) is architecturally independent — the server already accepts remote HTTP POSTs. It is deferred because it requires reliable CodeBox-local delivery first, and remote machine hook scripts add operational complexity that should not be introduced while core reliability is being established.

**Delivers:** Remote hook scripts for Lenovo and Mac; per-event voice configuration UI; snooze/mute per project; edge-tts startup health check; server hardening.

**Addresses (from FEATURES.md):** Multi-machine aggregation (P2), per-event voice config (P2), snooze/mute (P2)

**Avoids (from PITFALLS.md):** edge-tts silent 403 (#8), audio volume UX, notification fatigue from unfiltered sub-agent events

**Implementation notes:** Remote hook scripts must use `path.basename()` for cross-platform project name resolution. Add startup health check that synthesizes a test phrase and verifies the output file.

### Phase Ordering Rationale

- **Dependency-driven order:** The feature dependency graph in FEATURES.md is unambiguous — hook reliability is a prerequisite for every other feature. SSE is a prerequisite for visual toast, session dashboard, and activity feed. Both must exist before the frontend SPA is worth building.
- **Test validity:** Each phase produces a reliably testable baseline. Building out of order means testing Phase 3 features against an unreliable event source.
- **Pitfall phase mapping:** PITFALLS.md maps pitfalls to phases explicitly. Phases 1-2 address all Critical pitfalls. Phase 3 addresses Web Push-specific issues. Phase 4 addresses operational hardening.
- **Structural debt first:** The server restructure (extract HTML, introduce `src/` modules) happens in Phase 2 — early enough to prevent the 600-800 line monolith problem but after the hook foundation is solid.

### Research Flags

Phases with well-documented patterns — skip `/gsd:research-phase`:
- **Phase 1 (Hook Reliability):** Pitfalls are documented against specific GitHub issues; implementation approach is clear and specific. No additional research needed.
- **Phase 2 (SSE):** SSE is a stable browser standard with established Node.js patterns. ARCHITECTURE.md includes working code snippets. No additional research needed.
- **Phase 4 (Polish):** Low complexity; patterns are extensions of Phase 2-3 work.

Phases that may benefit from targeted research:
- **Phase 3 (Web Push):** The service worker registration flow and VAPID subscription lifecycle have several failure modes. Consider reviewing the `web-push` GitHub README and MDN Push API docs during planning to verify the exact subscription/unsubscription flow before implementation. Not a full research-phase, but a targeted 30-minute doc review.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core decisions verified against official docs (Vite, Tailwind v4, MDN Push API). web-push version is MEDIUM — confirmed via npm search, not direct package.json read. |
| Features | HIGH | Domain is concrete and fully specified by PROJECT.md. Feature dependencies are clear. No ambiguity about user needs. |
| Architecture | HIGH | Standard Node.js event-driven patterns, directly verified against multiple authoritative sources. Code snippets in ARCHITECTURE.md are production-tested patterns. |
| Pitfalls | HIGH | Most pitfalls verified against specific GitHub issues with issue numbers. edge-tts 403 fix confirmed in issue #290. Claude Code hook bugs confirmed in issues #10367, #8810, #9039. |

**Overall confidence:** HIGH

### Gaps to Address

- **web-push maintenance status:** The package was last published ~2 years ago. If the VAPID implementation breaks due to push service endpoint changes, the fallback is SSE + in-app toasts only (the primary use case is covered). Validate that `web-push@3.6.7` generates valid push notifications during Phase 3 before building any UI that depends on background push.
- **Windows hook path resolution (Lenovo):** `$CLAUDE_PROJECT_DIR` availability and format on Windows Claude Code has not been verified against a live Lenovo session. Build in a logging step to capture the raw `cwd` value on first run before assuming `path.basename()` is sufficient.
- **Caddy version on CodeBox:** The `flush_interval` directive syntax may vary by Caddy version. Verify the exact Caddy version running on CodeBox during Phase 2 before configuring SSE routing.

## Sources

### Primary (HIGH confidence)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — browser push support, service worker requirement
- [Vite Getting Started](https://vite.dev/guide/) — v8.0.2, Node.js v20.19+ requirement confirmed
- [Tailwind CSS v4 Play CDN docs](https://tailwindcss.com/docs/installation/play-cdn) — CDN is dev-only; use @tailwindcss/vite
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks) — PermissionRequest, Stop, SubagentStop event types
- [RxDB SSE vs WebSocket comparison](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html) — SSE appropriate for unidirectional push

### Secondary (MEDIUM confidence)
- [web-push GitHub (web-push-libs/web-push)](https://github.com/web-push-libs/web-push) — v3.6.7, VAPID key generation
- [Notyf npm (carlosroso1222/notyf)](https://github.com/carlosroso1222/notyf) — v3.10.0, 2.99KB gzipped
- [web.dev — Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol) — VAPID signing flow
- [ksred.com — Real-Time Claude Code Dashboard](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/) — comparable system, WebSocket approach

### Tertiary (confirmed via GitHub issues)
- [GitHub #15872 — AskUserQuestion hook event](https://github.com/anthropics/claude-code/issues/15872) — PermissionRequest is correct event
- [GitHub #10367 — Hooks non-functional in subdirectories](https://github.com/anthropics/claude-code/issues/10367) — confirmed bug
- [GitHub #8810 — UserPromptSubmit hooks in subdirectories](https://github.com/anthropics/claude-code/issues/8810) — confirmed bug
- [edge-tts #290 — 403 / Sec-MS-GEC token](https://github.com/rany2/edge-tts/issues/290) — v7.2.8 fix confirmed

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
