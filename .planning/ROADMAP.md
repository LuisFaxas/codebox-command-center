# Roadmap: Voice Notifications

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-03-28)
- 🚧 **v2.0 Center Console** - Phases 4-7 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED 2026-03-28</summary>

- [x] **Phase 1: Hook Reliability + Project Identity** - Fix hooks so every event fires exactly once with the correct project name (completed 2026-03-28)
- [x] **Phase 2: Real-Time Connection + Server Restructure** - Replace polling with SSE and extract HTML from server.js (completed 2026-03-28)
- [x] **Phase 3: Notifications Dashboard** - Build the full SPA with voice, push, visual toasts, session grid, and template editor (completed 2026-03-28)

### Phase 1: Hook Reliability + Project Identity
**Goal**: Every Claude Code event fires exactly once with the correct project name from any machine or directory
**Depends on**: Nothing (first phase)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, PROJ-01, PROJ-02, PROJ-03
**Success Criteria** (what must be TRUE):
  1. When Claude finishes a response, exactly one "done" notification fires — not zero, not multiple
  2. When Claude asks a question, exactly one "question" notification fires
  3. The notification payload always includes the correct project folder basename (never empty string)
  4. Hooks work when Claude Code is launched from any subdirectory of a project
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — Rewrite hook script + update server /trigger endpoint with POST and debounce
- [x] 01-02-PLAN.md — Configure hooks in settings.json + integration test + human verification

### Phase 2: Real-Time Connection + Server Restructure
**Goal**: Server delivers events to the browser instantly via SSE with no polling, and codebase is structured for maintainability
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-04, UI-04
**Success Criteria** (what must be TRUE):
  1. A notification trigger appears in the browser within 1 second via SSE (not polling)
  2. The browser dashboard auto-reconnects after a network interruption without user action
  3. The SSE connection stays alive through Caddy without disconnecting every 2 minutes
  4. The server HTML is served from a static file, not embedded in a JS string
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — ES module migration + server module split + SSE event bus
- [x] 02-02-PLAN.md — Frontend extraction with EventSource client + Caddy SSE config

### Phase 3: Notifications Dashboard
**Goal**: A polished single-page app delivers voice, browser push, and visual toasts for every event alongside a live session status grid and configurable templates
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, VIS-01, VIS-02, VIS-03, TMPL-01, TMPL-02, TMPL-03, TMPL-04, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. When Claude finishes or asks a question, the user hears a spoken notification, sees a browser push notification (even with tab backgrounded), and sees a toast in the app — all three fire together
  2. Each notification names the project and visually differentiates done vs. question events
  3. The dashboard shows real-time status (working / done / needs attention) for every active Claude Code session
  4. The user can edit notification message templates with `{project}` placeholder and changes take effect immediately across voice, push, and toast
  5. The user can configure voice selection, rate, and pitch separately for done and question events
**Plans:** 4 plans
Plans:
- [x] 03-01-PLAN.md — Server-side extensions: web-push module, config rate/pitch, TTS params, service worker
- [x] 03-02-PLAN.md — Dashboard UI: Grafana-style layout, session grid, activity feed, toast system
- [x] 03-03-PLAN.md — Push notification subscription flow with permission banner and graceful fallback
- [ ] 03-04-PLAN.md — Config slide-out panel: voice selection, template editor, rate/pitch controls

</details>

### 🚧 v2.0 Center Console (In Progress)

**Milestone Goal:** Transform from notification tool into unified session command center — one screen for all Claude Code sessions across machines.

- [x] **Phase 4: Session Foundation** - Server-side session state with persistence, lifecycle management, and notification preservation (completed 2026-03-30)
- [x] **Phase 5: Frontend Rebuild + Session Cards** - ES module split, screen-filling layout, rich session cards with progressive disclosure (completed 2026-03-30)
- [ ] **Phase 6: Rich Hooks + Interaction** - PostToolUse tracking, session registration, question display, and user actions
- [ ] **Phase 7: Manager AI** - Passive AI observer that summarizes sessions and flags attention-needed states

## Phase Details

### Phase 4: Session Foundation
**Goal**: Server tracks all Claude Code sessions as first-class entities with persistent state that survives restarts
**Depends on**: Phase 3 (working notification system as baseline)
**Requirements**: SESS-01, SESS-02, SESS-05, SESS-06, NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. When a hook fires, the server creates or updates a session record with project, machine, status, cwd, and last activity timestamp — visible via GET /sessions
  2. After restarting the server (PM2 restart claude-notify), all sessions from the last 30 minutes are still present with correct state
  3. Sessions transition through working/done/attention/stale states: a session with no activity for 5 minutes shows as stale, and after 30 minutes it disappears
  4. Voice notifications, browser push, and visual toasts continue to fire exactly as they did in v1.0 — no regression
**Plans:** 2 plans
Plans:
- [x] 04-01-PLAN.md — Create sessions.js module with lifecycle, persistence, TTL + Playwright regression suite
- [x] 04-02-PLAN.md — Integrate sessions.js into server.js, update browser client to consume server-side sessions

### Phase 5: Frontend Rebuild + Session Cards
**Goal**: Users see a screen-filling command center with rich session cards that answer "Is anything waiting for me?" and "What is each session doing?" at a glance
**Depends on**: Phase 4
**Requirements**: UI-05, UI-06, UI-07, UI-08, UI-09, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. The dashboard fills a 16" screen with a CSS Grid layout — no wasted whitespace, no scrolling for the primary session view
  2. Session cards display project name, machine, status badge, duration, current tool, and last message — the user can identify which session needs attention from across the room
  3. Clicking a session card expands it to reveal the full event history timeline for that session
  4. Voice and template configuration lives in a persistent sidebar panel that does not obscure the session grid
  5. The frontend is split into ES modules loaded via import maps — no build step, no framework
**Plans:** 4 plans
Plans:
- [x] 05-01-PLAN.md — Install SDK, create sdk-bridge.js abstraction, add proxy endpoints and static file serving
- [x] 05-02-PLAN.md — CSS design system (FAXAS brand tokens), HTML shell with import map, core modules (state, SSE, utils)
- [x] 05-03-PLAN.md — Session card renderer with status badges, conversation panel with SDK message loading
- [x] 05-04-PLAN.md — Sidebar config panel, toast system, audio playback, final wiring and human verification

### Phase 6: Rich Hooks + Interaction
**Goal**: Sessions show what Claude is actively doing (which tool, which file) and users can act on sessions directly from the dashboard
**Depends on**: Phase 5
**Requirements**: HOOK-05, HOOK-06, HOOK-07, HOOK-08, INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. PostToolUse events update the session card with the current tool name and target (e.g., "Bash: npm test", "Edit: src/auth.ts")
  2. SessionStart hooks register new sessions immediately — the card appears within 1 second of launching Claude Code
  3. When Claude asks a question, the session card displays the actual question text and a "Focus Terminal" button that jumps to the right tmux window
  4. User can dismiss/acknowledge sessions and copy question text to clipboard directly from the dashboard
  5. Server provides a /hooks/install endpoint that generates ready-to-paste hook config for any machine (CodeBox, Lenovo, Mac)
**Plans:** 3 plans
Plans:
- [x] 06-01-PLAN.md — Extend hook script for 4 event types, enhance session store and server trigger routing
- [ ] 06-02-PLAN.md — Frontend session cards with tool activity, conversation toolbar, SDK matching, clipboard actions
- [ ] 06-03-PLAN.md — Hook installer page with platform-specific setup instructions

### Phase 06.1: Conversation Panel Fix (INSERTED)

**Goal:** Fix SDK message content parsing and conversation panel wiring so clicking a session card loads and displays conversation history
**Requirements**: SESS-04
**Depends on:** Phase 6
**Plans:** 0/1 plans executed

Plans:
- [ ] 06.1-01-PLAN.md — Fix extractTextContent for string/array content + remove dead error check in conversation panel

### Phase 06.2: Session Deduplication and Multi-Tab (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 06.2 to break down)

### Phase 7: Manager AI
**Goal**: An AI observer provides on-demand summaries of what all sessions are doing and flags sessions that may need attention
**Depends on**: Phase 6
**Requirements**: MGRAI-01, MGRAI-02, MGRAI-03, MGRAI-04
**Success Criteria** (what must be TRUE):
  1. User clicks a "Summarize" button and receives a plain-language summary of what each active session is doing, generated within 5 seconds
  2. The AI flags sessions that appear stuck, long-running, or errored — these are highlighted in the manager panel
  3. Manager AI is behind a feature flag and completely off by default — enabling it requires explicit user action
  4. AI uses Haiku model with session snapshots (not per-event calls) and respects a 30-second cooldown between requests
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hook Reliability + Project Identity | v1.0 | 2/2 | Complete | 2026-03-28 |
| 2. Real-Time Connection + Server Restructure | v1.0 | 2/2 | Complete | 2026-03-28 |
| 3. Notifications Dashboard | v1.0 | 3/4 | Complete | 2026-03-28 |
| 4. Session Foundation | v2.0 | 2/2 | Complete | 2026-03-30 |
| 5. Frontend Rebuild + Session Cards | v2.0 | 4/4 | Complete | 2026-03-30 |
| 6. Rich Hooks + Interaction | v2.0 | 0/3 | Planning | - |
| 06.1. Conversation Panel Fix | v2.0 | 0/1 | Planned    |  |
| 7. Manager AI | v2.0 | 0/? | Not started | - |
