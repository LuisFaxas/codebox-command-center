# Phase 3: Notifications Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 03-notifications-dashboard
**Areas discussed:** Dashboard layout & style, Notification triple-fire, Session status grid, Template & voice config UX

---

## Dashboard Layout & Style

| Option | Description | Selected |
|--------|-------------|----------|
| Status-first with sidebar config | Main area shows session grid + feed, config in sidebar | |
| Tabbed sections | Dashboard / Settings / History tabs | |
| Single-scroll page | Everything on one scrolling page | |

**User's choice:** "Full premium and industry leading dashboard — research the best for this"
**Notes:** User rejected the presented options and wants Claude to research the absolute best dashboard pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Dark monitoring console | Grafana/Datadog aesthetic, neon indicators, data-dense | ✓ |
| Clean modern dark | Linear/Vercel style, subtle borders, generous whitespace | |
| You decide | Claude picks based on research | |

**User's choice:** Dark monitoring console

---

## Notification Triple-Fire

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful fallback (Recommended) | Voice + toast fire even if push denied, subtle banner | ✓ |
| Require push permission | Prompt on first load, persistent warning if denied | |
| You decide | Claude picks best UX | |

**User's choice:** Graceful fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded with icons | Green/checkmark for done, amber/question for question | |
| Different toast positions | Done top-right, question center-screen | |
| You decide | Claude picks based on monitoring best practices | ✓ |

**User's choice:** You decide

---

## Session Status Grid

**Card info (multiSelect):** All four selected — Project name + status, Machine name, Last activity timestamp, Session duration

| Option | Description | Selected |
|--------|-------------|----------|
| Fade after 5 minutes idle | Short TTL keeps grid clean | |
| Fade after 30 minutes idle | Longer TTL shows recent activity | |
| Manual clear or you decide | Claude picks reasonable TTL | ✓ |

**User's choice:** You decide

---

## Template & Voice Config UX

| Option | Description | Selected |
|--------|-------------|----------|
| Settings panel in sidebar | Collapsible sidebar, always accessible | |
| Settings modal/overlay | Gear icon opens full settings | |
| You decide | Claude picks best config UX pattern | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Separate per-type (Recommended) | Different voice/rate/pitch for done vs question | ✓ |
| Shared with type override | One default with optional overrides | |

**User's choice:** Separate per-type

---

## Claude's Discretion

- Page layout structure (research best monitoring dashboard patterns)
- Visual differentiation of done vs question events
- Session TTL
- Config UX pattern (sidebar vs modal vs overlay)
- Toast behavior (position, duration, stacking)
- CSS approach (framework vs vanilla)
- Service worker strategy for push notifications
