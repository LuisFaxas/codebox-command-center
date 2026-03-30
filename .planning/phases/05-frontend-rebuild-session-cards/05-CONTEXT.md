# Phase 5: Frontend Rebuild + Session Cards - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the entire frontend as a screen-filling command center with Claude Agent SDK V2 integration. Session cards show real conversations, users can respond to Claude's questions directly from the dashboard. This is the main event — UI + SDK together in one phase.

This phase replaces the current 1551-line index.html with a proper command center. Includes SDK integration for reading session conversations and sending responses. Does NOT include PostToolUse hooks (Phase 6), Manager AI (Phase 7), or cross-machine hook installer (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### SDK Integration (NEW — changes everything)
- **D-01:** Claude Agent SDK V2 integrated in this phase, not deferred. The dashboard reads real conversations via `listSessions()` / `getSessionMessages()` and sends responses via `resumeSession()` + `session.send()`.
- **D-02:** SDK runs server-side (Node.js on CodeBox). The browser doesn't call the SDK directly — the server acts as a proxy. New endpoints: GET /sdk/sessions, GET /sdk/sessions/:id/messages, POST /sdk/sessions/:id/send.
- **D-03:** Keep hooks for notifications (fast voice/push/toast). SDK adds session depth (conversation view, response relay). Two complementary systems, not a replacement.
- **D-04:** SDK V2 uses `unstable_v2_` prefix — preview API. Wrap in an abstraction layer so SDK changes don't break the whole system.

### Dashboard Layout
- **D-05:** Hybrid layout — compact status cards across the top (overview board), expanded conversation panel below for the selected session. Like a control room: status board on top, detail view on the bottom.
- **D-06:** Rich session cards in the top bar: project name, status badge, machine name, one-line preview of last message, and inline reply button for question sessions. 3-4 cards per row.
- **D-07:** Clicking a card opens its conversation in the bottom panel — last N messages from SDK, scrollable. Response input at the bottom for sessions waiting for input.

### Conversation View
- **D-08:** Default: show last 10-20 messages from the session. Scroll up for more. No AI summary in this phase (deferred to Phase 7).
- **D-09:** Response input appears only when a session has a pending question. User types, hits Send, SDK relays to the running session.

### Visual Design — Brand Consistency
- **D-10:** Match the FAXAS brand identity from the portfolio site and hub. Same color palette: `#0f0f1e` dark background, `#667eea → #764ba2 → #f093fb` accent gradient, glassmorphism surfaces.
- **D-11:** Font: DM Sans (matching portfolio) for primary text. Geist Mono or JetBrains Mono for conversation/code content.
- **D-12:** Glass card pattern from the hub: `rgba(255,255,255,0.03-0.05)` backgrounds, `blur(10-16px)`, `1px solid rgba(255,255,255,0.10)` borders, `12px` border radius.
- **D-13:** Status colors consistent with hub: `#22c55e` (up/done), `#ef4444` (error), `#f59e0b` (warning/attention), `#6b7280` (unknown/stale).
- **D-14:** Dark mode only for now (matching portfolio). Light mode is a future enhancement.

### Screen Usage
- **D-15:** Fill the entire 16" screen. No wasted whitespace. Session cards use CSS Grid auto-fill. Conversation panel takes remaining height.
- **D-16:** Voice/template configuration in a persistent right sidebar, not hidden behind a gear icon. Sidebar can collapse.

### UI Architecture
- **D-17:** Frontend architecture approach is Claude's Discretion. Pick what makes sense for the complexity — single file with sections, ES modules, or web components.
- **D-18:** No build step, no framework. Vanilla JS served as static files from the Node.js server.

### Claude's Discretion
- Frontend file architecture (single file vs ES modules vs hybrid)
- Conversation message rendering (plain text, markdown, code highlighting)
- How SDK session IDs map to hook session IDs (may need reconciliation)
- Toast position and behavior in the new layout
- Activity feed — keep, remove, or merge into conversation view
- Animation/transition approach (keep it simple, no Framer Motion since no React)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SDK Documentation
- https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview — V2 session API (createSession, resumeSession, send, stream)
- https://platform.claude.com/docs/en/agent-sdk/sessions — Session management (listSessions, getSessionMessages)
- https://github.com/anthropics/claude-agent-sdk-demos/tree/main/hello-world-v2 — Working V2 examples

### Design System References
- `.planning/research/design-references/PORTFOLIO-DESIGN.md` — Portfolio site design tokens (colors, fonts, glass, shadows)
- `.planning/research/design-references/HUB-DESIGN.md` — Hub design tokens (glass components, status colors, layout patterns)

### Current Implementation
- `public/index.html` — Current 1551-line monolith to replace
- `server.js` — Server routes, will need new SDK proxy endpoints
- `sessions.js` — Server-side session store (Phase 4), provides GET /sessions
- `sse.js` — SSE event bus
- `config.js` — Voice/template config persistence

### Research
- `.planning/research/ARCHITECTURE.md` — v2.0 architecture recommendations
- `.planning/research/FEATURES.md` — Feature analysis including SDK feasibility
- `.planning/research/SUMMARY.md` — Synthesized research

### Phase 4 Foundation
- `.planning/phases/04-session-foundation/04-CONTEXT.md` — Session data model decisions
- `tests/notifications.spec.mjs` — Playwright regression tests (MUST still pass)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessions.js` — Server-side session store with CRUD, TTL, persistence. Provides `getAllSessions()`, `upsertSession()`, and SSE events.
- `sse.js` — Event bus with emit/addClient/replay. Already emits session:update and session:remove events.
- `config.js` — JSON persistence pattern for voice/template config.
- Playwright test suite — 10 tests covering notifications and sessions.

### Established Patterns
- ES module imports across all server files
- JSON file persistence in `data/` directory
- SSE for server→client push
- REST + SSE hybrid (GET for snapshots, SSE for deltas)

### Integration Points
- `server.js` route table — where new SDK proxy endpoints go
- `public/` directory — where new frontend files go
- `package.json` — where `@anthropic-ai/claude-agent-sdk` dependency goes
- PM2 process — server restart needed after adding SDK

### Design System Integration Points
- Both portfolio and hub use same `#0f0f1e` background and `#667eea` accent
- Glass patterns from hub are simpler (no Framer Motion) — better fit for vanilla JS
- Hub has dark/light mode but we only need dark for now
- Status colors are identical across both projects

</code_context>

<specifics>
## Specific Ideas

**User's core vision:** "One screen where I can see all my sessions, see what they're working on, see when they need attention, and respond to questions from one place instead of juggling 7+ terminal windows."

**Brand consistency:** The dashboard should feel like it belongs on the same site as the portfolio and hub. Same glassmorphism, same purple accent gradient, same dark background. Not a separate tool — part of the FAXAS ecosystem.

**Layout reference:** Hybrid control room — compact status cards across top (like a TV wall monitoring room), selected session conversation expanded below (like clicking into a Slack channel).

**Conversation UX:** When Claude asks a question, the card pulses/highlights, user clicks it, sees the conversation, types a response, and it goes directly to that Claude session via SDK. This is the killer feature.

</specifics>

<deferred>
## Deferred Ideas

- **AI-generated conversation summaries** — Phase 7 Manager AI scope. For now just show raw messages.
- **Light mode** — Both portfolio and hub support it but not needed for v2.0 launch. Add later.
- **PostToolUse real-time tool tracking** — Phase 6. Cards will show "Editing auth.ts" etc. after hooks are added.
- **Cross-machine session discovery** — SDK `listSessions()` only sees CodeBox sessions. Remote machines need Phase 6 hook installer first.
- **Chat-style message bubbles** — May look better than plain text but adds complexity. Research in Phase 5 planning.

</deferred>

---

*Phase: 05-frontend-rebuild-session-cards*
*Context gathered: 2026-03-30*
