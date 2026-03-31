# Requirements: Voice Notifications

**Defined:** 2026-03-27
**Core Value:** Reliable, immediate awareness of Claude Code activity across all machines and projects

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Hook Reliability

- [x] **HOOK-01**: Stop hook fires exactly once per Claude response completion, not randomly
- [x] **HOOK-02**: AskUserQuestion hook fires when Claude asks a question (via PermissionRequest, not PostToolUse)
- [x] **HOOK-03**: Hooks work correctly from subdirectories using absolute paths for `$CLAUDE_PROJECT_DIR`
- [x] **HOOK-04**: Local CodeBox hook resolves project name (not empty string)

### Project Identity

- [x] **PROJ-01**: Project name auto-resolved from folder basename (cleaned, title-cased)
- [x] **PROJ-02**: Project name included in every notification (voice, push, toast)
- [x] **PROJ-03**: Project name resolution works from CodeBox, Lenovo, and Mac

### Real-Time Connection

- [x] **RT-01**: SSE replaces HTTP polling for server-to-client push
- [x] **RT-02**: SSE connection auto-reconnects on disconnect
- [x] **RT-03**: SSE heartbeat prevents Caddy/proxy timeout (30s interval)
- [x] **RT-04**: Server uses module-scoped event bus (decouples trigger from consumers)

### Voice Notifications

- [x] **VOICE-01**: Voice notification plays on Stop event with project name
- [x] **VOICE-02**: Voice notification plays on AskUserQuestion event with project name
- [x] **VOICE-03**: Stop and question events use different voice configurations
- [ ] **VOICE-04**: Voice selection panel with audition per notification type
- [x] **VOICE-05**: Rate and pitch configurable per notification type

### Browser Push Notifications

- [x] **PUSH-01**: Browser push notification fires when tab is in background
- [x] **PUSH-02**: Push notification includes project name and event type
- [x] **PUSH-03**: Service worker registered for background push delivery
- [x] **PUSH-04**: VAPID keys generated and persisted to disk (survive PM2 restarts)
- [x] **PUSH-05**: User prompted for notification permission on first visit

### Visual Notifications

- [x] **VIS-01**: Toast notification appears in-app for each event
- [x] **VIS-02**: Toast differentiates between done and question events (color/icon)
- [x] **VIS-03**: Toast includes project name

### Template Editor

- [ ] **TMPL-01**: User can customize notification message templates per event type
- [ ] **TMPL-02**: Templates support `{project}` placeholder for project name
- [ ] **TMPL-03**: Template changes apply to voice, push, and toast notifications
- [x] **TMPL-04**: Templates persist across server restarts (saved to config)

### Dashboard

- [x] **DASH-01**: Session status board shows all active Claude Code projects
- [x] **DASH-02**: Each session displays status: working / done / needs attention
- [x] **DASH-03**: Status updates in real-time via SSE
- [x] **DASH-04**: Activity feed shows chronological event stream across all projects
- [x] **DASH-05**: Activity feed shows project name, event type, and timestamp per entry

### Multi-Machine

- [ ] **MULTI-01**: Remote machines (Lenovo, Mac) push events to CodeBox server via HTTP
- [ ] **MULTI-02**: Dashboard aggregates sessions from all connected machines
- [ ] **MULTI-03**: Each session shows which machine it's running on
- [ ] **MULTI-04**: Remote hook scripts work on Windows (Lenovo) and macOS (Mac)

### Snooze/Mute

- [ ] **MUTE-01**: User can mute notifications for a specific project
- [ ] **MUTE-02**: Mute state visible on dashboard (muted projects clearly indicated)
- [ ] **MUTE-03**: User can unmute from dashboard

### UI/UX

- [x] **UI-01**: Single polished web app served from CodeBox
- [x] **UI-02**: Beautiful, modern design (not generic/utilitarian)
- [x] **UI-03**: Accessible via LAN (192.168.1.122) and Tailscale (100.123.116.23)
- [x] **UI-04**: Embedded HTML extracted from server.js to separate frontend

## v2.0 Requirements — Center Console

Requirements for v2.0 milestone. Transforms notification tool into unified session command center.

### Sessions

- [x] **SESS-01**: Server tracks all active sessions with project, machine, status, cwd, and last activity timestamp
- [x] **SESS-02**: Session state persists across server restarts via JSON file storage
- [ ] **SESS-03**: Session cards display project name, machine, status badge, duration, current tool, and last message
- [ ] **SESS-04**: User can click a session card to expand full event history timeline
- [x] **SESS-05**: Sessions transition through working/done/attention/stale states based on hook events
- [x] **SESS-06**: Stale sessions auto-dim after 5 minutes and auto-remove after 30 minutes

### Hooks (v2)

- [x] **HOOK-05**: PostToolUse hooks fire for tool activity tracking (which tool, file being edited)
- [x] **HOOK-06**: SessionStart hooks register new sessions with the server
- [x] **HOOK-07**: Server provides a `/hooks/install` endpoint that generates ready-to-paste config for any machine
- [x] **HOOK-08**: Question events display the actual question text in the session card

### UI/Layout (v2)

- [x] **UI-05**: Dashboard uses full screen with CSS Grid layout optimized for 16" displays
- [ ] **UI-06**: Voice and template configuration lives in a persistent sidebar panel (not hidden behind icon)
- [x] **UI-07**: Frontend split into ES modules loaded via import maps (no build step, no framework)
- [ ] **UI-08**: Session grid uses progressive disclosure — overview cards expand to show detail
- [ ] **UI-09**: Dashboard answers two questions at a glance: "Is anything waiting for me?" and "What is each session doing?"

### Manager AI

- [ ] **MGRAI-01**: Passive AI observer summarizes what active sessions are doing on user request
- [ ] **MGRAI-02**: AI flags sessions that may need attention (long-running, errored, stuck)
- [ ] **MGRAI-03**: Manager AI is behind a feature flag and off by default
- [ ] **MGRAI-04**: AI uses cheap model (Haiku) with session snapshots, not per-event calls

### Interaction

- [x] **INT-01**: Question session cards show a "Focus Terminal" button to jump to the right tmux window
- [x] **INT-02**: User can dismiss/acknowledge sessions from the dashboard
- [x] **INT-03**: User can copy question text to clipboard from the dashboard

### Notifications (preserved from v1)

- [x] **NOTIF-01**: Voice notifications fire on done and question events (no regression from v1.0)
- [x] **NOTIF-02**: Browser push notifications work when tab is backgrounded
- [x] **NOTIF-03**: Visual toast notifications appear with auto-dismiss (8s done, 15s question)

## Future Requirements

Deferred beyond v2.0.

- **PWA-01**: PWA manifest for mobile push notification support
- **VOICE-06**: Additional voice languages beyond en-US
- **MGRAI-05**: Manager AI actively relays instructions to sessions (blocked on Claude Code input injection API)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email / Slack / SMS notifications | Single-user, always-near-browser; adds external dependencies |
| Real-time code diff viewer | Massive complexity, outside core value |
| Session control (pause/stop Claude) | Claude Code control plane not exposed via HTTP |
| Multi-user / team support | Single-user system by design |
| Native mobile app | Browser push sufficient; separate project lifecycle |
| Cloud-synced settings | CodeBox is the hub; server-side config is single source of truth |
| Manager AI making decisions | v2.0 is observe-only — AI reports, user decides |
| Per-event LLM calls | Cost explosion risk ($100+/day); use snapshots with cooldown |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 (Phases 1-3)

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOOK-01 | Phase 1 | Complete |
| HOOK-02 | Phase 1 | Complete |
| HOOK-03 | Phase 1 | Complete |
| HOOK-04 | Phase 1 | Complete |
| PROJ-01 | Phase 1 | Complete |
| PROJ-02 | Phase 1 | Complete |
| PROJ-03 | Phase 1 | Complete |
| RT-01 | Phase 2 | Complete |
| RT-02 | Phase 2 | Complete |
| RT-03 | Phase 2 | Complete |
| RT-04 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Complete |
| VOICE-02 | Phase 3 | Complete |
| VOICE-03 | Phase 3 | Complete |
| VOICE-04 | Phase 3 | Pending |
| VOICE-05 | Phase 3 | Complete |
| PUSH-01 | Phase 3 | Complete |
| PUSH-02 | Phase 3 | Complete |
| PUSH-03 | Phase 3 | Complete |
| PUSH-04 | Phase 3 | Complete |
| PUSH-05 | Phase 3 | Complete |
| VIS-01 | Phase 3 | Complete |
| VIS-02 | Phase 3 | Complete |
| VIS-03 | Phase 3 | Complete |
| TMPL-01 | Phase 3 | Pending |
| TMPL-02 | Phase 3 | Pending |
| TMPL-03 | Phase 3 | Pending |
| TMPL-04 | Phase 3 | Complete |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| MULTI-01 | v1 Phase 4 | Deferred to v2.0 |
| MULTI-02 | v1 Phase 4 | Deferred to v2.0 |
| MULTI-03 | v1 Phase 4 | Deferred to v2.0 |
| MULTI-04 | v1 Phase 4 | Deferred to v2.0 |
| MUTE-01 | v1 Phase 4 | Deferred to v2.0 |
| MUTE-02 | v1 Phase 4 | Deferred to v2.0 |
| MUTE-03 | v1 Phase 4 | Deferred to v2.0 |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 2 | Complete |

### v2.0 Center Console (Phases 4-7)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 4 | Complete |
| SESS-02 | Phase 4 | Complete |
| SESS-05 | Phase 4 | Complete |
| SESS-06 | Phase 4 | Complete |
| NOTIF-01 | Phase 4 | Complete |
| NOTIF-02 | Phase 4 | Complete |
| NOTIF-03 | Phase 4 | Complete |
| SESS-03 | Phase 5 | Pending |
| SESS-04 | Phase 5 | Pending |
| UI-05 | Phase 5 | Complete |
| UI-06 | Phase 5 | Pending |
| UI-07 | Phase 5 | Complete |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 5 | Pending |
| HOOK-05 | Phase 6 | Complete |
| HOOK-06 | Phase 6 | Complete |
| HOOK-07 | Phase 6 | Complete |
| HOOK-08 | Phase 6 | Complete |
| INT-01 | Phase 6 | Complete |
| INT-02 | Phase 6 | Complete |
| INT-03 | Phase 6 | Complete |
| MGRAI-01 | Phase 7 | Pending |
| MGRAI-02 | Phase 7 | Pending |
| MGRAI-03 | Phase 7 | Pending |
| MGRAI-04 | Phase 7 | Pending |

**v1 Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

**v2.0 Coverage:**
- v2.0 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

| Category | Count | Phase |
|----------|-------|-------|
| Sessions (SESS) | 6 | Phase 4 (4), Phase 5 (2) |
| Hooks v2 (HOOK) | 4 | Phase 6 |
| UI/Layout v2 (UI) | 5 | Phase 5 |
| Manager AI (MGRAI) | 4 | Phase 7 |
| Interaction (INT) | 3 | Phase 6 |
| Notifications (NOTIF) | 3 | Phase 4 |

---
*Requirements defined: 2026-03-27*
*v2.0 requirements added: 2026-03-28*
*v2.0 traceability mapped: 2026-03-28*
