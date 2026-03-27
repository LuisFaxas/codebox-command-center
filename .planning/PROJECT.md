# Voice Notifications

## What This Is

A polished, all-in-one web app for Claude Code voice and visual notifications with a live coding dashboard. Runs centrally on CodeBox and serves any connected machine (CodeBox, Lenovo, Mac) via a browser tab. When Claude finishes a response or asks a question, the user hears a spoken notification, sees a browser push notification, and gets a visual toast — all identifying which project triggered it. The dashboard shows real-time status of all active Claude Code sessions across machines.

## Core Value

Reliable, immediate awareness of Claude Code activity across all machines and projects — the user never misses a "done" or "question" event, even when running 5+ concurrent sessions.

## Requirements

### Validated

- ✓ HTTP server on CodeBox (port 3099, PM2-managed) — existing
- ✓ Edge-TTS integration for neural voice synthesis — existing
- ✓ Claude Code hook system (Stop + PostToolUse/AskUserQuestion) — existing
- ✓ WAV caching by type and project name — existing
- ✓ Voice selection UI with audition capability — existing
- ✓ Multiple male en-US neural voices available — existing

### Active

- [ ] Notifications fire reliably at the right time (not randomly)
- [ ] Question notifications work (AskUserQuestion hook fires correctly)
- [ ] Project name auto-resolved from project folder name
- [ ] Customizable notification templates with `{project}` placeholder
- [ ] Browser push notifications (works even with tab in background)
- [ ] Visual toast notifications in the web app
- [ ] Voice + push + visual all fire together per event
- [ ] Works from any machine via CodeBox server (Tailscale or LAN)
- [ ] Live coding dashboard showing all active Claude Code sessions
- [ ] Dashboard shows project status: working / done / needs attention
- [ ] Real-time activity feed across all projects
- [ ] Beautiful, polished single-page web app UI
- [ ] Voice configuration panel (voice selection, rate, pitch per notification type)
- [ ] Template editor for notification messages
- [ ] Replace polling with push-based connection (SSE or WebSocket)

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

---
*Last updated: 2026-03-26 after initialization*
