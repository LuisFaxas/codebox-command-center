# Voice Notifications

## What This Is

A unified command center for all Claude Code sessions across machines. Runs centrally on CodeBox and serves any connected machine (CodeBox, Lenovo, Mac) via a single browser tab. Sessions are the core entity — the dashboard shows what each Claude session is doing, what it asked, and lets the user route attention and respond. Voice, push, and visual notifications fire when Claude finishes or asks a question. Exploring a Manager AI layer that monitors sessions, reports status, and relays instructions.

## Core Value

Complete awareness and control of all Claude Code sessions from one screen — the user sees everything, misses nothing, and can act on any session instantly.

## Requirements

### Validated (v1.0)

- ✓ HTTP server on CodeBox (port 3099, PM2-managed)
- ✓ Edge-TTS integration for neural voice synthesis
- ✓ Claude Code hook system (Stop + Notification events)
- ✓ WAV caching by type and project name
- ✓ Voice selection UI with audition capability
- ✓ Multiple male en-US neural voices available
- ✓ SSE-based real-time event push (replaced polling)
- ✓ Server-side debounce (3s window, keyed by type:sessionId)
- ✓ Web push notification infrastructure (VAPID keys, service worker)
- ✓ Session state tracking via SSE events
- ✓ Visual toast notification system
- ✓ Project name resolution from folder basename

### Active (v2.0 — Center Console)

- [ ] Session-centric command center — sessions are the core entity with deep context
- [ ] Screen-space-aware UI — fills 16" screen, no wasted space, sidebar config
- [ ] Manager AI exploration — AI that monitors sessions, reports to user, relays instructions
- [ ] Cross-machine session aggregation — CodeBox, Lenovo, Mac unified with working remote hooks
- [ ] Actionable sessions — respond to questions, route attention, see what happened
- [ ] Notification system preserved — voice + push + toast, no regression from v1.0

### Out of Scope

- Offline/local operation — CodeBox is always the hub, network required
- Mobile app — browser-only
- Non-English voices — en-US male neural voices only for now
- Multi-user support — single user (faxas) system
- Integration with non-Claude-Code tools — Claude Code hooks only

## Context

- CodeBox (192.168.1.122 / 100.123.116.23 via Tailscale) is the central server
- All projects live under `~/workspaces/` on CodeBox
- User runs 5+ concurrent Claude Code sessions across CodeBox, Lenovo (Windows), and Mac
- Current system has a working server.js (~420 lines) with embedded HTML, edge-tts integration, and hook scripts
- Hooks exist for both local (CodeBox: shell script writing trigger.json) and remote (Lenovo: node script hitting HTTP endpoint) machines
- edge-tts v7.2.8+ required (older versions get 403 errors)
- Current system fires notifications randomly and question notifications don't work
- Project name resolution exists in notify-trigger.js but isn't working reliably — folder basename should be the primary strategy
- PM2 manages the server process as `claude-notify`
- Caddy available for reverse proxy (`*.codebox.local` domains)

## Constraints

- **Server**: Node.js on CodeBox, no external dependencies beyond edge-tts (Python) — keep it lean
- **Clients**: Browser-only, must work on Chrome/Edge on any OS
- **Network**: Tailscale for remote access, LAN for local — server must be reachable both ways
- **TTS**: edge-tts (Microsoft Edge neural voices) — no paid API keys
- **Stack**: pnpm for package management if dependencies added

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single web app (not separate dashboard) | User wants one polished UI, not multiple pages/servers | — Pending |
| CodeBox as central hub | All coding happens there, always on, reachable via Tailscale | ✓ Good |
| edge-tts for voice synthesis | Free, high-quality neural voices, no API key needed | ✓ Good |
| Folder basename as primary project name | Simple, reliable — projects are named by their folder | — Pending |
| Replace polling with SSE/WebSocket | Current 1s polling is wasteful and may cause timing issues | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current Milestone: v2.0 Center Console

**Goal:** Transform from notification tool into unified session command center — one screen for all Claude Code sessions across machines.

**Target features:**
- Session-centric command center with deep per-session context
- Screen-space-aware UI (16" screen, sidebar config, no wasted space)
- Manager AI exploration (session monitoring, status reporting, instruction relay)
- Cross-machine session aggregation with working remote hooks
- Actionable sessions (respond, route attention, see history)
- Notification system preserved (no regression)

---
*Last updated: 2026-03-28 — v2.0 Center Console milestone started*
