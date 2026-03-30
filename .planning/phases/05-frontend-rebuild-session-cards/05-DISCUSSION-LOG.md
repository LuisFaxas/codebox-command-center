# Phase 5: Frontend Rebuild + Session Cards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-30
**Phase:** 05-frontend-rebuild-session-cards
**Areas discussed:** SDK scope, Dashboard layout, Session card design, UI architecture, Visual design

---

## SDK Scope in This Phase

| Option | Description | Selected |
|--------|-------------|----------|
| Full integration in Phase 5 | UI + SDK together, cards show real conversations from day one | ✓ |
| UI shell first, SDK in Phase 6 | Build layout first, add SDK depth later | |
| You decide the split | Claude picks boundary | |

**User's choice:** Full integration — go big in Phase 5
**Notes:** User wants the real product ASAP, not incremental shells

---

## Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Session list + conversation panel | Slack-style left sidebar + main content | |
| Grid of session cards | Full grid, click to expand | |
| Hybrid — cards overview + expandable conversation | Status board top, conversation bottom | ✓ |

**User's choice:** Hybrid control room layout
**Notes:** Compact status cards across top, selected session conversation expanded below

---

## Session Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — name + status dot | Max density, 10+ sessions in two rows | |
| Medium — name + status + last action | 5-7 per row | |
| Rich — name + status + preview + reply | Bigger cards, inline reply for questions | ✓ |

**User's choice:** Rich cards with preview and reply

---

## Conversation View

| Option | Description | Selected |
|--------|-------------|----------|
| Full transcript | Everything Claude said | |
| Last N messages | Most recent 10-20 messages | ✓ (default) |
| Smart summary + recent | AI summary + last 5-10 | Deferred to Phase 7 |

**User's choice:** Last N messages as default, smart summary as future upgrade

---

## UI Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| ES modules with import maps | Split into ~8-10 files | |
| Keep single file but reorganize | One file, clear sections | |
| You decide | Claude picks | ✓ |

**User's choice:** Claude's discretion

---

## Visual Design

**User's choice:** Match FAXAS brand identity — extract design system from portfolio site and hub, build dashboard to look consistent with existing projects.

**Source projects audited:**
- `/home/faxas/workspaces/projects/personal/faxas-portfolio-app` — Portfolio site (DM Sans, glassmorphism, purple gradient)
- `/home/faxas/workspaces/projects/personal/faxas_hub` — Hub ops dashboard (Geist, glass components, status system, dark/light)

**Reports saved to:** `.planning/research/design-references/`

---

## Claude's Discretion

- Frontend file architecture
- Conversation message rendering format
- SDK session ID reconciliation with hook session IDs
- Toast behavior in new layout
- Activity feed fate
- Animation approach (no Framer Motion — vanilla JS)

## Deferred Ideas

- AI conversation summaries → Phase 7
- Light mode → future
- PostToolUse tracking → Phase 6
- Cross-machine SDK sessions → Phase 6
