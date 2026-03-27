# Phase 1: Hook Reliability + Project Identity - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix Claude Code hooks so every event fires exactly once with the correct project name from any machine or directory. This phase delivers reliable hook scripts, consistent project name resolution, and server-side deduplication. No UI work, no dashboard, no real-time transport changes.

</domain>

<decisions>
## Implementation Decisions

### Hook Event Mapping
- **D-01:** Use Stop hook for "done" events and Notification hook for "question" events. Two separate hook event types in `.claude/settings.json`, both calling the same Node script with different type arguments.
- **D-02:** Hook payload is rich context — not just type + project. Includes: machine identifier, session ID, timestamp, and working directory. This data pipeline supports the dashboard in Phase 3.
- **D-03:** Payload sent as POST with JSON body to `/trigger` endpoint (replaces current GET with query params).

### Project Name Strategy
- **D-04:** Default to folder basename, cleaned and title-cased (e.g., `voice_notifications` -> `Voice Notifications`). Current cleaning logic (camelCase split, hyphen/underscore to spaces, title case) is kept.
- **D-05:** Allow `.claude/project-display-name` file to override the folder basename. This is the only override — remove CLAUDE.md parsing and package.json fallbacks from the resolution chain.
- **D-06:** Cache all resolved names in `.name-cache.json` with mtime validation. Even though basename is fast, cache covers the display-name override file read.

### Hook Unification
- **D-07:** Single `notify-trigger.js` Node script used on all machines (CodeBox, Lenovo, Mac). Retire `notify-done.sh` entirely.
- **D-08:** All hooks communicate via HTTP to the server (localhost on CodeBox, Tailscale IP on remote). No more direct file writes to trigger.json from hooks.
- **D-09:** Script distributed via git clone + symlink on each machine. Updates via `git pull`.

### Deduplication
- **D-10:** Server-side debounce window of 3 seconds per unique key.
- **D-11:** Debounce key is `(type, project, sessionId)` — allows two different sessions on the same project to fire simultaneously while preventing same-session duplicates.

### Claude's Discretion
- Server-side implementation of the debounce (in-memory map with TTL cleanup is fine, or any equivalent approach)
- How to extract session ID from Claude Code hook environment variables
- Error handling when server is unreachable from hooks (silent fail with exit 0, matching current behavior, is acceptable)
- Whether trigger.json is still needed or can be replaced entirely by in-memory state + SSE in Phase 2

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `.planning/codebase/ARCHITECTURE.md` -- Current system architecture, data flow, and entry points
- `.planning/codebase/CONCERNS.md` -- Known bugs, tech debt, and fragile areas relevant to hooks

### Existing Hook Scripts
- `hooks/notify-trigger.js` -- Current remote hook with project name resolution (to be refactored)
- `hooks/notify-done.sh` -- Current local hook (to be retired)

### Server Entry Points
- `server.js` lines 399-412 -- Current /trigger endpoint handler
- `server.js` lines 309-327 -- Current /check endpoint (polling-based, will need trigger.json update or in-memory state)

### Requirements
- `.planning/REQUIREMENTS.md` -- HOOK-01 through HOOK-04, PROJ-01 through PROJ-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/notify-trigger.js` -- Project name resolution logic (cleanFolderName, resolveProjectName) can be simplified and reused
- `hooks/notify-trigger.js` -- Name cache with mtime validation pattern is solid, keep approach
- `server.js:78-80` -- `safeName()` function for sanitizing project names in cache keys

### Established Patterns
- Hooks use `process.env.CLAUDE_PROJECT_DIR` for project directory detection
- Server uses `VOICE_NOTIFY_URL` env var for endpoint configuration
- Silent error handling in hooks (catch and exit 0) to not block Claude Code

### Integration Points
- `server.js` `/trigger` endpoint -- needs to accept POST with JSON body instead of GET with query params
- `server.js` trigger.json write -- needs debounce logic before writing
- `.claude/settings.json` on each machine -- hook configuration entry point
- PM2 ecosystem config -- server process management

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants "the best solution no matter how complex" for hook event mapping -- don't over-simplify
- Rich payload now sets up the data pipeline for Phase 3 dashboard without needing to revisit hooks later

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-hook-reliability-project-identity*
*Context gathered: 2026-03-27*
