# Roadmap: Voice Notifications

## Overview

The existing working prototype needs three structural problems fixed before any UI work can succeed: hook reliability, file-based polling IPC, and the embedded HTML anti-pattern. The roadmap delivers these in strict dependency order — reliable hooks first, real-time transport second, full notifications dashboard third, multi-machine aggregation last. Each phase leaves a testable, usable system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Hook Reliability + Project Identity** - Fix hooks so every event fires exactly once with the correct project name (completed 2026-03-28)
- [ ] **Phase 2: Real-Time Connection + Server Restructure** - Replace polling with SSE and extract HTML from server.js
- [ ] **Phase 3: Notifications Dashboard** - Build the full Vite SPA with voice, push, visual toasts, session grid, and template editor
- [ ] **Phase 4: Multi-Machine + Polish** - Extend to Lenovo and Mac, add snooze/mute, harden edge-tts

## Phase Details

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
**Plans:** 2 plans
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

### Phase 4: Multi-Machine + Polish
**Goal**: Lenovo and Mac hooks report to CodeBox, the dashboard aggregates all machines, and the system handles edge cases gracefully
**Depends on**: Phase 3
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04, MUTE-01, MUTE-02, MUTE-03
**Success Criteria** (what must be TRUE):
  1. A Claude Code session on Lenovo or Mac fires a notification on CodeBox within 2 seconds of the event
  2. The dashboard shows sessions from all machines in one unified view, each labeled with its source machine
  3. The user can mute a noisy project from the dashboard and its notifications stop immediately; the mute state is visible and reversible
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hook Reliability + Project Identity | 2/2 | Complete   | 2026-03-28 |
| 2. Real-Time Connection + Server Restructure | 0/2 | Not started | - |
| 3. Notifications Dashboard | 0/4 | Not started | - |
| 4. Multi-Machine + Polish | 0/? | Not started | - |
