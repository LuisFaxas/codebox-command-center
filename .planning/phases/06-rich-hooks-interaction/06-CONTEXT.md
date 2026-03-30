# Phase 6: Rich Hooks + Interaction - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make sessions show what Claude is doing in real-time (PostToolUse tracking), register sessions on launch (SessionStart), display actual question text, let users respond to Claude from the dashboard via SDK, provide easy cross-machine hook setup, and add session action controls (dismiss, copy, focus terminal).

This phase wires the SDK conversation reading and response relay into the live dashboard. Does NOT include Manager AI (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### SDK Conversation Loading
- **D-01:** Match dashboard sessions to SDK transcripts automatically by project directory path (cwd). SDK `listSessions()` returns sessions with cwd — find the most recent SDK session matching the hook session's project directory.
- **D-02:** When SessionStart hooks ship (HOOK-06), capture the exact SDK session_id for precise matching. Auto-match by directory is the fallback.
- **D-03:** If no SDK transcript is found for a session, show a clean empty state: "No conversation available — session may be remote or just started."

### Response Relay
- **D-04:** Full send capability — user sees conversation, types answer, hits Send, SDK resumes the session with the response. This works especially well for GSD wizard questions (AskUserQuestion prompts).
- **D-05:** SDK `resumeSession().send()` resumes the session with the user's reply. The response appears in the conversation panel. No disclaimers needed — just make it work.
- **D-06:** Response input appears when a session has a pending question. After sending, show a loading state until the SDK response comes back.

### Hook Installer
- **D-07:** Must be dead-simple "just works" setup for Lenovo (Windows) and Mac. Research the best cross-platform approach during planning.
- **D-08:** Installing hooks on a remote machine must NOT affect CodeBox's existing configuration. Each machine has its own settings.json.
- **D-09:** The installer should handle: copying/downloading the hook script, configuring settings.json with the correct CodeBox server URL, and testing the connection.

### Session Actions
- **D-10:** Progressive disclosure — card gets a dismiss/X button (always visible). Conversation panel header gets the full toolbar: copy question, focus terminal, dismiss.
- **D-11:** Copy question copies the question text to clipboard with one click.
- **D-12:** Focus Terminal navigates to the right tmux window/pane. Research the best approach for mapping sessions to tmux during planning.

### New Hooks
- **D-13:** PostToolUse hooks send tool name and target (e.g., "Edit: src/auth.ts", "Bash: npm test") to the server. Server updates the session with `currentTool` and `currentTarget` fields. Card renders these in real-time.
- **D-14:** SessionStart hooks register new sessions immediately when Claude Code launches. Card appears within 1 second.
- **D-15:** Question events (Notification hooks) include the actual question text in the payload when available. Server stores in session's `questionText` field.

### Claude's Discretion
- PostToolUse debounce strategy (hooks fire frequently — may need throttling)
- How to detect tmux session/window for "Focus Terminal"
- Hook installer technical approach (web page vs CLI vs hybrid)
- SessionStart hook implementation details (which Claude Code event to use)
- How to handle SDK session reading for remote machines (Lenovo/Mac sessions won't have local JSONL files)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SDK Documentation
- https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview — V2 session API
- https://platform.claude.com/docs/en/agent-sdk/sessions — listSessions, getSessionMessages
- https://code.claude.com/docs/en/headless — Headless/programmatic Claude Code

### Hook System
- https://platform.claude.com/docs/en/agent-sdk/hooks — Hook events and payloads
- `~/.claude/settings.json` — Current hook configuration on CodeBox
- `hooks/notify-trigger.cjs` — Current hook script

### Current Implementation
- `sdk-bridge.js` — Server-side SDK abstraction (getSdkSessions, getSdkMessages, sendSdkResponse)
- `public/modules/sdk-client.js` — Browser SDK client (fetchSessions, fetchMessages, sendResponse)
- `public/modules/conversation.js` — Conversation panel with response input
- `public/modules/sessions.js` — Embla carousel session cards
- `server.js` — SDK proxy routes (/sdk/sessions, /sdk/sessions/:id/messages, /sdk/sessions/:id/send)
- `sessions.js` — Server-side session store with upsertSession

### Phase 5 Context
- `.planning/phases/05-frontend-rebuild-session-cards/05-CONTEXT.md` — SDK integration decisions
- `.planning/phases/05-frontend-rebuild-session-cards/05-RESEARCH.md` — SDK V2 findings and limitations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sdk-bridge.js` — Already wraps SDK V2 with getSdkSessions(), getSdkMessages(), sendSdkResponse(). Needs enhancement for session matching by cwd.
- `conversation.js` (265 lines) — Has response input UI, message rendering, empty states. Needs SDK message loading wired in.
- `sessions.js` (236 lines) — Embla carousel with session cards. Needs currentTool/currentTarget rendering and dismiss button.
- `notify-trigger.cjs` (166 lines) — Hook script template. Base for PostToolUse and SessionStart hooks.

### Established Patterns
- Server proxy pattern: browser → server endpoint → SDK call → JSON response
- SSE for real-time push, REST for snapshots
- Session upsert pattern in sessions.js (create or update by sessionId)

### Integration Points
- `server.js` routes — new hook endpoints, enhanced /trigger payload
- `~/.claude/settings.json` — new PostToolUse and SessionStart hook entries
- `sessions.js` upsertSession — new fields (currentTool, currentTarget, questionText)
- `public/modules/sessions.js` renderCard — new card content (tool activity, dismiss button)
- `public/modules/conversation.js` — wire SDK message loading to selectSession

</code_context>

<specifics>
## Specific Ideas

**User's core need:** "I should be able to click each card and see the conversation, reply, and answer the questions when GSD asks me wizard questions — all from one dashboard."

**Hook installer:** Must be dead-simple. User emphasized "software that just works." Research the latest best practices for cross-platform Claude Code hook deployment.

**Response relay for GSD questions:** The primary use case is answering AskUserQuestion prompts from GSD workflows running in other sessions. SDK resumeSession().send() should handle this — user types answer, Claude picks up where it left off.

</specifics>

<deferred>
## Deferred Ideas

- **Manager AI summaries** — Phase 7 scope
- **Remote machine SDK session reading** — SDK only reads local JSONL files. Remote sessions need SSH or file sync. Future enhancement.
- **Multi-response threading** — Having a full back-and-forth conversation from the dashboard (not just one reply). Future if SDK supports it well.

</deferred>

---

*Phase: 06-rich-hooks-interaction*
*Context gathered: 2026-03-30*
