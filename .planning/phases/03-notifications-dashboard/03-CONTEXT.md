# Phase 3: Notifications Dashboard - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a polished single-page dashboard that delivers voice, browser push, and visual toast notifications for every Claude Code event, alongside a live session status grid and configurable templates. This phase completely replaces the current voice picker UI. No multi-machine deployment (Phase 4), no new hook types.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout & Style
- **D-01:** Premium, industry-leading monitoring dashboard design. Research the best dashboard patterns for this use case — not a simple voice picker, but a proper notification monitoring console.
- **D-02:** Dark monitoring console style (Grafana/Datadog aesthetic). Dark background, neon status indicators, compact data-dense layout. Keeps the current dark + red accent vibe but elevated to professional quality.

### Notification Triple-Fire
- **D-03:** When a trigger fires, all three notification channels activate simultaneously: voice (TTS audio), browser push notification, and visual toast in the dashboard.
- **D-04:** Graceful push fallback — if browser push permission is denied, voice + toast still fire. Show a subtle banner suggesting enabling push. Never block notifications because push is unavailable.
- **D-05:** Visual differentiation between done and question events is Claude's Discretion. Research best practices for monitoring dashboards — color-coding, icons, positioning, or a combination.

### Session Status Grid
- **D-06:** Each session card shows: project name + status indicator, machine name, last activity timestamp, and session duration.
- **D-07:** Session TTL (when sessions disappear from grid) is Claude's Discretion. Research appropriate monitoring dashboard patterns.

### Template & Voice Config UX
- **D-08:** Config UX pattern (sidebar, modal, overlay) is Claude's Discretion. Research the best approach for a monitoring-style dashboard.
- **D-09:** Voice config (voice, rate, pitch) is separate per notification type (done vs question). Currently config.js already stores per-type config — extend with rate and pitch.

### Claude's Discretion
- Overall page structure and component organization
- Toast position, duration, stacking behavior
- Session card visual design and status state machine (working/done/needs attention)
- Whether to use CSS framework or vanilla CSS
- Notification feed/history design (if included)
- How rate/pitch sliders interact with voice preview
- Service worker strategy for push notifications
- Whether to split index.html into multiple JS files or keep as single file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `.planning/codebase/ARCHITECTURE.md` — Current system architecture
- `.planning/codebase/CONCERNS.md` — Known issues and tech debt

### Current Implementation
- `public/index.html` — Current UI to replace (213 lines, voice picker with EventSource client)
- `server.js` — Server entry/routing (160 lines), serves static HTML, has /events SSE endpoint
- `sse.js` — SSE event bus with emit(), addClient(), replay buffer
- `config.js` — Config persistence module (voice + template per type)
- `tts.js` — TTS generation module (edge-tts wrapper)

### Phase 1 & 2 Context
- `.planning/phases/01-hook-reliability-project-identity/01-CONTEXT.md` — Hook payload structure (type, project, sessionId, machine, cwd, timestamp)
- `.planning/phases/02-real-time-connection-server-restructure/02-CONTEXT.md` — SSE event types (trigger, session:alive, config:updated, connection:health)

### Requirements
- `.planning/REQUIREMENTS.md` — VOICE-01 through VOICE-05, PUSH-01 through PUSH-05, VIS-01 through VIS-03, TMPL-01 through TMPL-04, DASH-01 through DASH-05, UI-01 through UI-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sse.js` emit() — already supports trigger, session:alive, config:updated, connection:health event types
- `config.js` — already stores per-type voice + template config, needs rate/pitch extension
- `tts.js` — generateSamples() and generateCached() for voice preview and notification audio
- `public/index.html` — has working EventSource client with auto-reconnect (reuse SSE connection logic)

### Established Patterns
- ES modules throughout (import/export)
- No npm dependencies — all vanilla JS + Node.js built-ins
- Server serves static HTML via readFileSync on startup
- SSE events use named event types with JSON data payloads
- Config persistence via JSON file in data/ directory

### Integration Points
- `/events` SSE endpoint — dashboard subscribes here for real-time updates
- `/trigger` POST endpoint — hooks fire here, dashboard reacts
- `/notify-wav` endpoint — serves generated TTS audio
- `/config` GET endpoint — returns current voice/template config
- `/select` POST endpoint — updates voice/template selection
- `/generate` POST endpoint — generates voice samples for preview
- `/wav/:name` endpoint — serves individual voice sample WAVs

</code_context>

<specifics>
## Specific Ideas

- User wants "full premium and industry leading dashboard" — not a basic utility page
- User wants it to look like professional monitoring tools (Grafana, Datadog)
- This is the main user-facing product — it should feel polished and production-ready
- All session card fields requested: project name, status, machine, last activity, duration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-notifications-dashboard*
*Context gathered: 2026-03-28*
