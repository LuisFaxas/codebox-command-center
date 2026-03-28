# Feature Landscape: v2.0 Center Console

**Domain:** AI coding session command center, multi-session monitoring, Manager AI orchestration
**Researched:** 2026-03-28
**Overall confidence:** MEDIUM (some features are novel with no direct precedent; Claude Code APIs are experimental and changing)

## Context

This research covers NEW features for v2.0 only. The following are already built and working in v1.0:
- Voice notifications (edge-tts, per-type config)
- Browser push notifications (VAPID, service worker)
- Visual toast notifications
- Session status tracking (working/done/attention/stale via SSE)
- Activity feed (chronological events)
- Voice configuration panel

The v2.0 goal: transform from notification tool into a unified session command center.

---

## Table Stakes

Features the "command center" concept requires to be credible. Without these, it is just a fancier notification panel.

| Feature | Why Expected | Complexity | Dependencies | Feasibility |
|---------|--------------|------------|--------------|-------------|
| **Rich session cards** | A "command center" with blank cards is useless -- each session needs identity, state, project, machine, and duration | MEDIUM | Hook data: session_id, cwd, machine (hostname), hook_event_name | HIGH -- all data available from existing hooks |
| **Session timeline / history** | Users need to see what happened in a session, not just current state -- "what did it do while I was away?" | MEDIUM | Store events per session_id server-side; replay from SSE buffer | HIGH -- already have event data, need per-session indexing |
| **Cross-machine aggregation** | Running sessions on CodeBox + Lenovo + Mac; seeing only local sessions defeats the purpose | LOW | Remote hooks already exist (notify-trigger.cjs sends machine hostname) | HIGH -- architecture already supports this, need to verify remote hooks work |
| **Machine identity labels** | "codebox session" vs "lenovo session" vs "mac session" must be instantly distinguishable | LOW | os.hostname() already sent in hook payload | HIGH -- trivial UI work |
| **Session lifecycle states** | Need clear states: spawning, working, waiting-for-input, done, stale, error | MEDIUM | Derive from hook events: SessionStart, Stop, Notification, StopFailure; timeout-based stale detection | HIGH -- mostly inference from existing events |
| **Screen-filling layout** | 16" screen should be used, not a narrow centered column | MEDIUM | CSS Grid redesign; responsive breakpoints for different screen sizes | HIGH -- standard CSS work |
| **Notification preservation** | Voice + push + toast must continue working exactly as v1.0 | LOW | No new work -- just don't break it during refactor | HIGH -- regression testing needed |

### Session Card Deep Dive

What makes a session card actually useful? Based on available hook data and transcript analysis:

**Available directly from hooks (HIGH confidence):**
- `session_id` -- unique identifier, correlate all events
- `cwd` -- working directory, derive project name
- `hook_event_name` -- what just happened (Stop, Notification, PostToolUse, etc.)
- `machine` -- hostname of source machine (os.hostname())
- `timestamp` -- when each event fired
- `permission_mode` -- current permission level (default, auto, plan, etc.)
- `transcript_path` -- path to full session JSONL on that machine
- `stop_hook_active` -- whether a stop hook is running (prevents infinite loops)
- `last_assistant_message` -- Claude's last response text (from Stop event)
- `source` -- session origin: startup, resume, clear, compact (from SessionStart)
- `model` -- which model the session is using (from SessionStart)

**Available from tool events (HIGH confidence, requires PostToolUse hooks):**
- `tool_name` -- what tool was just used (Bash, Edit, Write, Read, Grep, etc.)
- `tool_input` -- what arguments were passed (command text, file paths, etc.)
- `tool_response` -- tool output (truncated for dashboard display)

**Derivable (MEDIUM confidence):**
- Session duration -- difference between first and last event timestamps
- Activity rate -- events per minute, indicates busy vs idle
- Files touched -- accumulate file paths from Edit/Write/Read tool events
- Current task summary -- extract from `last_assistant_message` on Stop events
- Error state -- detect from StopFailure events (rate_limit, billing_error, etc.)
- Tool usage pattern -- count of Bash vs Edit vs Read gives "character" of session

**Requires transcript parsing (LOW-MEDIUM confidence, only works for local sessions):**
- Full conversation summary -- parse JSONL, extract assistant messages
- Token usage -- available in transcript metadata
- Thinking blocks -- Claude's reasoning (if extended thinking enabled)
- Subagent activity -- nested agent spawns visible in transcript

---

## Differentiators

Features that make this genuinely powerful rather than just adequate.

### Tier 1: High Value, Achievable

| Feature | Value Proposition | Complexity | Dependencies | Feasibility |
|---------|-------------------|------------|--------------|-------------|
| **Last message preview** | See Claude's last response without switching terminals -- the single most useful piece of context | LOW | `last_assistant_message` from Stop hook | HIGH -- data already in payload |
| **Question display with context** | When Claude asks a question, show the actual question text so user can decide priority | LOW | `message` field from Notification hook (notification_type: "permission_prompt") | HIGH -- data available |
| **Tool activity stream per session** | Live feed of what tools a session is using: "Bash: npm test", "Edit: src/auth.ts" -- like watching over Claude's shoulder | MEDIUM | PostToolUse hooks sending tool_name + abbreviated tool_input | HIGH -- requires adding PostToolUse hook, straightforward |
| **Session grouping by project** | Multiple sessions on the same project (e.g., main + test runner) should be visually grouped | LOW | Group by resolved project name from cwd | HIGH -- client-side grouping |
| **Stale session detection** | Auto-detect sessions that haven't sent events in N minutes; mark as stale/possibly dead | LOW | Server-side timeout tracking per session_id | HIGH -- timer logic |
| **Compact vs expanded card toggle** | Overview mode (all sessions as small tiles) vs detail mode (one session expanded with full history) | MEDIUM | CSS state management, no new data needed | HIGH -- pure UI |
| **Sidebar config panel** | Move voice/push configuration into a collapsible sidebar instead of occupying main screen space | LOW | Restructure existing HTML/CSS | HIGH |

### Tier 2: Ambitious, Technically Novel

| Feature | Value Proposition | Complexity | Dependencies | Feasibility |
|---------|-------------------|------------|--------------|-------------|
| **AI-generated session summaries** | "This session is building auth middleware, has run tests 3 times, last test passed" -- synthesized from event stream | HIGH | Run Claude API call (or local LLM) on accumulated events per session; needs API key or headless Claude invocation | MEDIUM -- cost and latency concerns; could use cheap model |
| **Session transcript viewer** | Read the full JSONL transcript of a local (CodeBox) session from the dashboard | HIGH | Parse `~/.claude/projects/*/SESSION_ID.jsonl`, render in UI | MEDIUM -- only works for CodeBox sessions (transcript_path is local); need file system access from server |
| **Respond to questions via dashboard** | Type a response in the dashboard and have it reach the Claude Code session | HIGH | See detailed analysis below | LOW -- significant technical barriers |
| **Cross-session dependency detection** | Detect when Session A edits a file that Session B is also working on -- flag potential conflicts | HIGH | Track file paths from Edit/Write tool events across all sessions; compute overlaps | MEDIUM -- data available from PostToolUse hooks, but noise-to-signal ratio is high |
| **Session recording / playback** | Record all events for a session, replay later to understand what happened | MEDIUM | Already storing events in SSE buffer; extend to persistent storage per session | HIGH -- mostly a storage and UI problem |
| **Resource monitoring** | CPU/memory of CodeBox visible alongside sessions, so user knows when machine is overloaded | MEDIUM | Server-side process monitoring (os module or /proc parsing) | HIGH for CodeBox; LOW for remote machines |
| **Error pattern detection** | Flag sessions that are repeatedly hitting errors, rate limits, or stuck in loops | MEDIUM | Analyze StopFailure events and repeated tool failures per session | MEDIUM -- heuristics needed |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full IDE integration / code viewer** | Scope explosion; the dashboard shows status, it does not replace the terminal | Show file names and tool summaries, link to project directory |
| **Session creation from dashboard** | Starting Claude Code sessions requires terminal context, project selection, permission mode -- too complex for a web UI | Show how to start sessions, but let users start them in terminals |
| **Multi-user support** | Single user system; adding auth/permissions adds complexity for zero value | Hardcode for faxas, no login |
| **Mobile-optimized layout** | This is a 16" screen command center; mobile layout compromises desktop density | Responsive down to laptop (13"), but no phone layout |
| **Chat interface in dashboard** | Trying to build a chat UI for Claude sessions creates a poor copy of the terminal | Show last messages read-only; interact via terminal |
| **Persistent session database** | SQLite or Postgres for session data adds operational complexity for a personal tool | In-memory session state with event log files for replay; sessions are ephemeral |
| **Custom notification sounds per project** | Over-engineering; type-based (done/question) distinction is sufficient | Keep per-type voice config, not per-project |
| **Real-time token/cost tracking per session** | Requires parsing JSONL transcripts continuously, which is expensive and only works locally | Show token summary on session end (from transcript) if feasible; don't track live |

---

## "Respond to a Question" -- Deep Analysis

This is the most requested feature and the hardest to implement. Here is an honest assessment:

### What "respond to a question" means in practice

When Claude Code asks a question (permission prompt, AskUserQuestion, or Elicitation), it is waiting for keyboard input in a terminal. The Notification hook fires, but the session is blocked until the user types a response in that terminal.

### Technical approaches and their feasibility

**Approach 1: Send keystrokes to terminal (tmux/screen)**
- If Claude Code sessions run in tmux, you can `tmux send-keys -t SESSION "yes" Enter`
- Feasibility: HIGH for CodeBox sessions in tmux, ZERO for remote machines
- Limitation: Brittle; depends on tmux session naming; can send wrong input if session state changed

**Approach 2: Claude Code SDK / headless mode follow-up**
- Use `claude -p "response" --resume SESSION_ID` to send a follow-up
- Feasibility: LOW -- this starts a new CLI process that resumes the conversation from transcript, it does not inject into the running interactive session
- The running session and the headless resume are separate processes

**Approach 3: File-based signaling**
- Write a response file; configure a Claude Code hook (FileChanged or custom) to read it
- Feasibility: LOW -- no hook exists for "inject user input"; hooks fire on Claude actions, not user actions

**Approach 4: Notification-only with smart routing**
- Don't try to send input. Instead: show which terminal/tmux pane needs attention, with a "Go to session" action
- For tmux: `tmux select-window -t SESSION` can focus the right pane
- Feasibility: HIGH -- pragmatic, doesn't fight the architecture

### Recommendation

**Do NOT try to build input injection.** The terminal is the interaction surface for Claude Code, and fighting that creates a brittle, unreliable experience.

**Instead, build "smart attention routing":**
1. When a question/permission event fires, show it prominently with the actual question text
2. Provide a "Focus" button that runs `tmux select-window -t PANE` (for CodeBox sessions in tmux)
3. For remote sessions, show which machine and terminal to switch to
4. Prioritize question sessions visually (sort to top, glow, sound)

This is honest, reliable, and actually useful. Confidence: HIGH.

---

## Manager AI -- Deep Analysis

### What this means

An AI layer that monitors all active sessions, summarizes what is happening across them, and could relay high-level instructions.

### Precedent

Claude Code Agent Teams (experimental, v2.1.32+) already implement a team lead that coordinates multiple Claude instances. The lead:
- Spawns teammates and assigns tasks
- Receives automatic messages when teammates finish or go idle
- Maintains a shared task list with states (pending, in progress, completed)
- Can message individual teammates or broadcast

This is the closest precedent, but it is an active orchestration tool, not a passive monitor.

Other tools in the ecosystem:
- **Overstory** -- multi-agent orchestrator with tiered watchdog system (mechanical daemon + AI triage + monitor agent)
- **Mission Control by Builderz** -- open-source agent orchestration dashboard with task dispatch, cost tracking, WebSocket/SSE
- **Ruflo** -- comprehensive agent orchestration framework for Claude Code

### What a Manager AI could realistically do

**Passive monitoring (HIGH feasibility):**
- Consume the same SSE event stream the dashboard already provides
- Summarize activity across sessions: "3 sessions active, 1 needs attention, 2 are building"
- Generate periodic status reports: "In the last hour: voice_notifications had 5 events, auth-service had 12, testing completed"
- Detect anomalies: "Session X has been stuck on the same error for 10 minutes"

**Active summarization (MEDIUM feasibility):**
- Parse `last_assistant_message` from Stop events to understand what each session accomplished
- Use a cheap/fast model (Haiku, or even local LLM) to synthesize multi-session summaries
- Cost: ~$0.01 per summary if using Haiku on accumulated event text

**Instruction relay (LOW feasibility for v2.0):**
- Requires solving the "send input to running session" problem (see above -- it is hard)
- Agent Teams solve this within their own framework (shared task list, messaging)
- For independent sessions started by the user, there is no injection mechanism
- Possible future: if Claude Code adds an API for sending messages to running sessions

### Recommendation for v2.0

**Build the passive monitor first.** A Manager AI that watches the event stream and generates natural-language summaries is achievable and valuable. It does not need to control sessions -- it reports to the user, who then decides what to do.

Implementation: A server-side module that accumulates events, and periodically (or on demand) calls a Claude API endpoint to generate a summary. Display the summary in a dedicated panel on the dashboard.

Start with: "What is happening across all my sessions right now?" -- answerable from event data alone.

Defer: instruction relay, active task management, cross-session coordination. These require deeper Claude Code API integration that does not exist yet.

---

## Screen Layout -- Research Findings

### NOC / Mission Control patterns that apply

From NOC and trading floor dashboard research:

1. **Grid of equals** -- 5-10 panels of equal size, each monitoring one entity. Works when entities are peers (sessions are peers).
2. **Focus + context** -- One large panel for the "active" item, surrounded by smaller panels for the rest. Works when user is primarily watching one session.
3. **Status wall** -- Compact status indicators (green/yellow/red) with drill-down on click. Works for overview when many sessions are running.
4. **Sidebar config** -- Configuration panels slide in from the side, don't take permanent screen space. Voice/push settings belong here.

### Recommended layout

**Primary: Responsive grid of session cards**
- CSS Grid with `auto-fill` and `minmax(350px, 1fr)` -- cards flow to fill available space
- On 16" screen at 1920px: 4-5 cards per row, showing 8-10 sessions without scrolling
- Each card shows: project name, machine, state indicator (color), last event, duration, last message preview

**Secondary: Focus mode**
- Click a card to expand it into a detail view
- Detail view shows full event timeline, tool activity, last messages, transcript link
- Other cards shrink to compact status indicators (name + color dot)

**Tertiary: Manager AI panel**
- Fixed-position panel (bottom or side) showing the AI summary
- Collapsible to not waste space when not needed
- "Refresh summary" button or auto-refresh on significant events

**Config: Sidebar**
- Voice selection, push notification toggle, and other settings in a right-side drawer
- Triggered by a gear icon in the header
- Does not compete with session cards for screen space

---

## Feature Dependencies

```
Session card basics
  -> Session timeline (needs per-session event storage)
  -> Tool activity stream (needs PostToolUse hook)
  -> Last message preview (needs Stop hook last_assistant_message)
  -> Session grouping (needs project name resolution)

Cross-machine aggregation
  -> Machine identity labels (needs hostname in events)
  -> Verify remote hooks work (CodeBox, Lenovo, Mac)

Screen layout redesign
  -> Sidebar config (moves existing config panel)
  -> Compact vs expanded cards (layout modes)
  -> Focus mode (detail expansion)

Manager AI (passive)
  -> AI-generated summaries (needs Claude API key or headless invocation)
  -> Anomaly detection (needs event pattern analysis)

Session recordings
  -> Session transcript viewer (needs JSONL parsing)
  -> Playback UI (needs timeline component)
```

---

## MVP Recommendation

**Phase 1: Session command center foundation**
1. Rich session cards with all available hook data (session_id, project, machine, state, duration, last message)
2. Screen-filling CSS Grid layout
3. Session lifecycle state machine (working/done/attention/stale/error)
4. Cross-machine aggregation verification (ensure remote hooks work)
5. Sidebar config panel (move existing voice/push settings)

**Phase 2: Deep session context**
1. PostToolUse hook integration for tool activity stream
2. Session timeline (per-session event history)
3. Question display with context and "focus" button (tmux integration)
4. Compact vs expanded card toggle
5. Session grouping by project

**Phase 3: Manager AI and advanced features**
1. Passive Manager AI (event summarization via Claude API)
2. Session transcript viewer (local sessions only)
3. Error pattern detection
4. Session recording / replay

**Defer indefinitely:**
- Input injection to running sessions (wait for Claude Code API support)
- Active instruction relay (same blocker)
- Token/cost tracking (parse on session end, not live)

---

## Outside-the-Box Ideas

Features nobody has built yet, ranging from practical to ambitious:

### 1. Session "Heartbeat Map" (Practical)
A visual representation of all sessions as pulsing dots on a grid. Pulse speed = activity rate. Color = state. Size = session age. Gives an instant gestalt of "how busy are my agents?" without reading any text. Like a heart monitor for your coding fleet.

### 2. "What Did I Miss?" Digest (Practical)
When you return to the dashboard after being away, generate a natural-language summary of everything that happened: "While you were gone: auth-service completed refactoring (3 commits), voice_notifications hit a rate limit and is waiting, testing passed all 47 tests." This is the killer feature of a Manager AI -- not real-time monitoring, but catch-up.

### 3. Session Dependency Graph (Ambitious)
Track which files each session touches. Build a live graph showing session overlap. When Session A edits `src/auth.ts` and Session B reads `src/auth.ts`, draw a connection. This surfaces hidden conflicts that even the user might not realize exist.

### 4. "Hot Seat" Mode (Practical)
When the user sits down at the dashboard, they often need to triage: which session needs me most urgently? Auto-sort sessions by urgency: questions first, errors second, recently completed third, working last. One-click to cycle through sessions that need attention. Like a doctor doing rounds.

### 5. Session Cost Heatmap (Moderate)
After sessions end, parse their transcripts and compute token usage. Show a heatmap over time: "Tuesday afternoon you burned through $40 on the auth refactor." Useful for understanding spending patterns without needing real-time tracking.

### 6. Cross-Session Knowledge Transfer (Ambitious, future)
When one session discovers something relevant to another (e.g., "found a bug in the shared utils"), surface it as a notification to the other session's card. Currently impossible without input injection, but the detection part is feasible from PostToolUse events.

### 7. "Replay My Day" (Moderate)
A timeline view of the entire day's coding activity across all sessions and machines. Scrub through time to see what was happening at any moment. Useful for daily standup preparation, time tracking, and understanding your own workflow patterns.

### 8. Smart Notification Batching (Practical)
When 3 sessions complete within 10 seconds of each other, don't fire 3 separate voice notifications. Instead: "Three sessions completed: auth, testing, and dashboard." Requires notification aggregation with a short delay window.

---

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- HIGH confidence, official documentation
- [Claude Code Headless Mode / Agent SDK](https://code.claude.com/docs/en/headless) -- HIGH confidence, official documentation
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) -- HIGH confidence, official documentation (experimental feature)
- [Feature Request: Expose Session Metadata](https://github.com/anthropics/claude-code/issues/17188) -- MEDIUM confidence, community issue
- [Feature Request: Programmatic Input in Interactive Mode](https://github.com/anthropics/claude-code/issues/15553) -- HIGH confidence, confirms input injection limitation
- [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) -- HIGH confidence, working tool for JSONL parsing
- [ccusage](https://ccusage.com/) -- HIGH confidence, working tool for token/cost analysis
- [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) -- MEDIUM confidence, community tool
- [Mission Control by Builderz](https://mc.builderz.dev) -- MEDIUM confidence, open-source agent orchestration dashboard
- [Overstory multi-agent orchestration](https://github.com/jayminwest/overstory) -- MEDIUM confidence, community project
- [NOC Dashboard Design](https://alertops.com/noc-dashboard-examples/) -- MEDIUM confidence, general dashboard patterns
- [Gridstack.js](https://gridstackjs.com/) -- HIGH confidence, dashboard grid library
- [CSS Grid Dashboard Layouts](https://blog.pixelfreestudio.com/how-to-use-css-grid-for-customizable-dashboard-layouts/) -- MEDIUM confidence, tutorial
