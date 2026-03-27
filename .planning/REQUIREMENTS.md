# Requirements: Voice Notifications

**Defined:** 2026-03-27
**Core Value:** Reliable, immediate awareness of Claude Code activity across all machines and projects

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Hook Reliability

- [ ] **HOOK-01**: Stop hook fires exactly once per Claude response completion, not randomly
- [ ] **HOOK-02**: AskUserQuestion hook fires when Claude asks a question (via PermissionRequest, not PostToolUse)
- [ ] **HOOK-03**: Hooks work correctly from subdirectories using absolute paths for `$CLAUDE_PROJECT_DIR`
- [ ] **HOOK-04**: Local CodeBox hook resolves project name (not empty string)

### Project Identity

- [ ] **PROJ-01**: Project name auto-resolved from folder basename (cleaned, title-cased)
- [ ] **PROJ-02**: Project name included in every notification (voice, push, toast)
- [ ] **PROJ-03**: Project name resolution works from CodeBox, Lenovo, and Mac

### Real-Time Connection

- [ ] **RT-01**: SSE replaces HTTP polling for server-to-client push
- [ ] **RT-02**: SSE connection auto-reconnects on disconnect
- [ ] **RT-03**: SSE heartbeat prevents Caddy/proxy timeout (30s interval)
- [ ] **RT-04**: Server uses EventEmitter as internal event bus (decouples trigger from consumers)

### Voice Notifications

- [ ] **VOICE-01**: Voice notification plays on Stop event with project name
- [ ] **VOICE-02**: Voice notification plays on AskUserQuestion event with project name
- [ ] **VOICE-03**: Stop and question events use different voice configurations
- [ ] **VOICE-04**: Voice selection panel with audition per notification type
- [ ] **VOICE-05**: Rate and pitch configurable per notification type

### Browser Push Notifications

- [ ] **PUSH-01**: Browser push notification fires when tab is in background
- [ ] **PUSH-02**: Push notification includes project name and event type
- [ ] **PUSH-03**: Service worker registered for background push delivery
- [ ] **PUSH-04**: VAPID keys generated and persisted to disk (survive PM2 restarts)
- [ ] **PUSH-05**: User prompted for notification permission on first visit

### Visual Notifications

- [ ] **VIS-01**: Toast notification appears in-app for each event
- [ ] **VIS-02**: Toast differentiates between done and question events (color/icon)
- [ ] **VIS-03**: Toast includes project name

### Template Editor

- [ ] **TMPL-01**: User can customize notification message templates per event type
- [ ] **TMPL-02**: Templates support `{project}` placeholder for project name
- [ ] **TMPL-03**: Template changes apply to voice, push, and toast notifications
- [ ] **TMPL-04**: Templates persist across server restarts (saved to config)

### Dashboard

- [ ] **DASH-01**: Session status board shows all active Claude Code projects
- [ ] **DASH-02**: Each session displays status: working / done / needs attention
- [ ] **DASH-03**: Status updates in real-time via SSE
- [ ] **DASH-04**: Activity feed shows chronological event stream across all projects
- [ ] **DASH-05**: Activity feed shows project name, event type, and timestamp per entry

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

- [ ] **UI-01**: Single polished web app served from CodeBox
- [ ] **UI-02**: Beautiful, modern design (not generic/utilitarian)
- [ ] **UI-03**: Accessible via LAN (192.168.1.122) and Tailscale (100.123.116.23)
- [ ] **UI-04**: Embedded HTML extracted from server.js to separate frontend

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extended Features

- **HIST-01**: Notification history with persistent log (queryable by project/type/time)
- **DUR-01**: Session duration tracking ("project-x working for 47 minutes")
- **PWA-01**: PWA manifest for mobile push notification support
- **VOICE-06**: Additional voice languages beyond en-US

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Email / Slack / SMS notifications | Single-user, always-near-browser premise; adds external dependencies |
| Real-time code diff viewer | Outside notification scope; massive complexity |
| Session control (pause/stop Claude) | Claude Code control plane not exposed via HTTP |
| Multi-user / team support | Single-user system by design |
| Native mobile app | Browser push sufficient; separate project lifecycle |
| AI-generated notification summaries | Overkill for status pings; adds LLM API dependency |
| Cloud-synced settings | CodeBox is the hub; server-side config is single source of truth |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOOK-01 | Pending | Pending |
| HOOK-02 | Pending | Pending |
| HOOK-03 | Pending | Pending |
| HOOK-04 | Pending | Pending |
| PROJ-01 | Pending | Pending |
| PROJ-02 | Pending | Pending |
| PROJ-03 | Pending | Pending |
| RT-01 | Pending | Pending |
| RT-02 | Pending | Pending |
| RT-03 | Pending | Pending |
| RT-04 | Pending | Pending |
| VOICE-01 | Pending | Pending |
| VOICE-02 | Pending | Pending |
| VOICE-03 | Pending | Pending |
| VOICE-04 | Pending | Pending |
| VOICE-05 | Pending | Pending |
| PUSH-01 | Pending | Pending |
| PUSH-02 | Pending | Pending |
| PUSH-03 | Pending | Pending |
| PUSH-04 | Pending | Pending |
| PUSH-05 | Pending | Pending |
| VIS-01 | Pending | Pending |
| VIS-02 | Pending | Pending |
| VIS-03 | Pending | Pending |
| TMPL-01 | Pending | Pending |
| TMPL-02 | Pending | Pending |
| TMPL-03 | Pending | Pending |
| TMPL-04 | Pending | Pending |
| DASH-01 | Pending | Pending |
| DASH-02 | Pending | Pending |
| DASH-03 | Pending | Pending |
| DASH-04 | Pending | Pending |
| DASH-05 | Pending | Pending |
| MULTI-01 | Pending | Pending |
| MULTI-02 | Pending | Pending |
| MULTI-03 | Pending | Pending |
| MULTI-04 | Pending | Pending |
| MUTE-01 | Pending | Pending |
| MUTE-02 | Pending | Pending |
| MUTE-03 | Pending | Pending |
| UI-01 | Pending | Pending |
| UI-02 | Pending | Pending |
| UI-03 | Pending | Pending |
| UI-04 | Pending | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 0
- Unmapped: 44

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*
