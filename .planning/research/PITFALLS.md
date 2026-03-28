# Domain Pitfalls — v2.0 Center Console

**Domain:** Session command center, Manager AI layer, cross-machine aggregation, rich dashboard
**Researched:** 2026-03-28
**Confidence:** HIGH for dashboard/SPA pitfalls, MEDIUM for Manager AI pitfalls (novel domain), HIGH for cross-machine aggregation
**Scope:** NEW risks for v2.0 features only. See git history for v1.0 pitfalls.

---

## Critical Pitfalls

Mistakes that cause rewrites, abandon features, or break the existing system.

### Pitfall 1: Session State Model Designed Around Events Instead of Sessions

**What goes wrong:**
The v1.0 system is event-oriented: a trigger fires, the dashboard reacts. For v2.0, the core entity is a *session* (a Claude Code process with identity, history, and state). Developers bolt session tracking onto an event stream by accumulating events into a "session" object. This produces a fragile, eventually-incorrect model because sessions have no explicit start/end signals in Claude Code hooks.

**Why it happens:**
Claude Code hooks fire for Stop, Notification, PermissionRequest, etc. There is no "SessionStart" hook. The first event from a session IS the session discovery. If the first event is a Stop, the session appears only to immediately disappear. If the user started Claude Code but it never triggered a hook, the session is invisible.

**Consequences:**
- Dashboard shows phantom sessions that never close (no Stop event arrived)
- Dashboard misses sessions that are actively working but haven't triggered a hook yet
- Session history is incomplete — you only see events, not what happened between them
- "Active sessions" count is always wrong

**Prevention:**
- Design sessions with explicit TTL and staleness model. A session is "active" if it sent an event within N minutes; "stale" after N minutes; "gone" after M minutes. Do NOT try to track "session started" and "session ended" as discrete events.
- Use sessionId (from Claude Code hook context) as the session key. If Claude Code does not provide a stable sessionId, derive one from (machine + cwd + PID) and accept it will be approximate.
- Accept that the dashboard shows a *partial* view of reality. Display "Last seen: 2m ago" instead of "Status: Active" to avoid implying omniscience.
- Add a heartbeat hook (low-priority, can be a SubagentStop or periodic PostToolUse) to keep sessions alive in the model.

**Warning signs:**
- You're writing code to "detect when a session started"
- You have a session state machine with states like "starting", "running", "idle"
- Sessions accumulate indefinitely and never get cleaned up

**Phase to address:** Session model design (earliest v2.0 phase)

---

### Pitfall 2: Manager AI Cost Explosion and Rate Limit Catastrophe

**What goes wrong:**
The Manager AI layer calls an LLM API to summarize session activity, generate status reports, or interpret Claude Code output. With 5+ concurrent sessions each firing events every few seconds, the Manager AI processes hundreds of events per hour. API costs reach $50-100/day. Rate limits hit within minutes. The system degrades to being slower than just looking at the terminal.

**Why it happens:**
Developers design the Manager AI to process EVERY event. Each event triggers a prompt like "Summarize what this session is doing." With reasoning models, each call can cost $0.01-0.10 in tokens. 5 sessions x 20 events/hour x $0.05/call = $5/hour = $120/day.

**Consequences:**
- Monthly API bill exceeds the value of the tool
- Rate limits cause the Manager AI to fall behind, reporting stale information
- Latency makes the AI summaries arrive after the user has already context-switched
- If using Claude API, the Manager AI competes with the actual coding sessions for rate limits

**Prevention:**
- DO NOT call an LLM on every event. Batch events and summarize on a schedule (every 30s-60s) or on-demand (user clicks "What's happening?")
- Use the cheapest model that works (Haiku, not Opus) for status summarization
- Implement a token budget: hard cap of N tokens/hour. When exceeded, the Manager AI goes silent and the dashboard shows raw events only
- Consider whether the Manager AI needs an LLM at all for v2.0. Pattern-matching on hook event types + project names may produce 80% of the value at 0% of the cost. "voice_notifications: Claude stopped 30s ago after a question" is just string formatting, not AI
- If using Claude API: use a SEPARATE API key with its own rate limits so the Manager AI cannot starve actual coding sessions

**Warning signs:**
- You're writing prompts that say "Analyze this session's recent activity"
- The Manager AI calls happen synchronously in the event pipeline
- No cost tracking or budget cap exists
- You're using Sonnet/Opus for the Manager AI

**Phase to address:** Manager AI exploration phase (should be late, after core dashboard works)

---

### Pitfall 3: Manager AI Feedback Loop — AI Responding to Its Own Actions

**What goes wrong:**
The Manager AI sends a message to a Claude Code session (e.g., "Continue with the refactoring"). That session processes the message and fires a hook event. The Manager AI sees the event and decides to send another message. This creates an infinite loop of AI-to-AI communication that burns API credits and can corrupt the session's work.

**Why it happens:**
The Manager AI monitors ALL session events. If it can also SEND instructions to sessions, and those instructions trigger hooks, the Manager AI's own actions become inputs to itself. Without explicit loop detection, the system oscillates.

**Consequences:**
- Infinite API call loops
- Claude Code sessions receive nonsensical automated instructions
- The user's actual work is interrupted by Manager AI injections
- Potential for corrupted code if the Manager AI tells Claude to do something the user didn't intend

**Prevention:**
- Tag all Manager AI-originated actions with a source marker. The Manager AI MUST ignore events triggered by its own actions.
- Implement a hard "relay only" mode for v2.0: the Manager AI can OBSERVE and REPORT, but only the HUMAN can send instructions to sessions. Bidirectional AI-to-session communication is a v3.0+ feature.
- If bidirectional is attempted: add a cooldown (Manager AI can only message a session once per N minutes) and require human confirmation for any automated action.
- Rate-limit Manager AI outputs: max N messages per session per hour.

**Warning signs:**
- You're designing "automated responses" or "Manager AI actions"
- The Manager AI has write access to session input
- No concept of "event source" in the event model
- Testing involves "what if the Manager AI decides to..."

**Phase to address:** Manager AI exploration phase (with explicit scope gate: observe-only first)

---

### Pitfall 4: Cross-Machine Clock Skew Makes Event Ordering Nonsensical

**What goes wrong:**
Events from CodeBox, Lenovo, and Mac arrive at the server with timestamps from their respective system clocks. The Lenovo is 3 seconds ahead, the Mac is 1.5 seconds behind. The dashboard sorts events by timestamp. A "Stop" event from Lenovo appears BEFORE a "Question" event from Mac, even though the question happened first. Session timelines are jumbled.

**Why it happens:**
Each machine has its own clock. Even with NTP, clock skew of 1-5 seconds is common. Windows machines are particularly bad at NTP discipline. Tailscale does not synchronize clocks.

**Consequences:**
- Session event timelines are out of order
- "Time since last event" calculations are wrong (negative durations possible)
- Debugging becomes impossible because the dashboard shows a false sequence of events
- If events are deduplicated by timestamp, legitimate events may be dropped

**Prevention:**
- Use server-arrival time as the canonical ordering timestamp, NOT client-reported timestamps. The server assigns monotonically increasing IDs (already implemented in sse.js with `eventId`).
- Store client timestamps as metadata for debugging, but NEVER use them for ordering or dedup.
- In the hook scripts, send the client timestamp but clearly label it as `clientTimestamp`. The server adds `serverTimestamp` on receipt.
- For display: show relative times ("3s ago") not absolute times ("10:42:03.123") — relative times hide small clock skew from the user.

**Warning signs:**
- You're using `event.timestamp` from the client for sorting
- Negative time deltas appear in the dashboard
- Events from one machine always appear "before" events from another regardless of actual order

**Phase to address:** Cross-machine aggregation phase

---

### Pitfall 5: SPA Memory Leak Death Spiral From Long-Running Dashboard

**What goes wrong:**
The dashboard runs for 8+ hours in a browser tab (normal usage for a developer workstation). Memory usage climbs from 50MB to 500MB+. The tab becomes sluggish, then unresponsive. Chrome kills it with "Aw, Snap!" The user loses the dashboard during a critical multi-session coding sprint.

**Why it happens:**
Every SSE event creates DOM elements for session cards, event history, toast notifications, etc. Old DOM nodes are "removed" from the page but retained in memory because:
- Event listeners still reference them
- A session history array keeps growing unboundedly
- Toast notification elements are appended to the DOM and never cleaned up
- ResizeObserver/IntersectionObserver instances are not disconnected on component teardown
- Closure references in SSE event handlers keep old data alive

**Consequences:**
- Dashboard crashes during extended use (the exact time the user needs it most)
- Browser becomes sluggish, affecting other tabs
- User develops a habit of refreshing the dashboard hourly, defeating the purpose of real-time monitoring

**Prevention:**
- Cap session event history: keep only the last N events per session in memory (N=50 is generous). Older events are dropped, not archived client-side.
- Use a fixed-size ring buffer for toast notifications. Max 5-10 visible, max 20 in DOM. Remove oldest when adding new.
- Use event delegation instead of per-element listeners. One click handler on the session container, not one per session card.
- Set up a periodic memory audit: `performance.memory.usedJSHeapSize` logged to console every 5 minutes. If it crosses a threshold, force a state trim.
- Test by running the dashboard for 2+ hours with simulated rapid events. If memory exceeds 200MB, investigate before shipping.

**Warning signs:**
- Session history arrays grow without bounds
- `document.querySelectorAll('.toast').length` returns hundreds
- No cleanup logic exists for removed sessions
- Chrome DevTools memory snapshot shows thousands of detached DOM nodes

**Phase to address:** Dashboard UI phase (must be addressed in initial implementation, not retrofitted)

---

### Pitfall 6: "Dashboard of Everything" — Information Overload Kills Utility

**What goes wrong:**
The dashboard shows per-session: current status, last event, event history, machine name, project name, working directory, file being edited, git branch, token count, cost estimate, Manager AI summary, response time, uptime, error count... The user's eyes glaze over. They can't find the ONE thing they need: "Which session is waiting for me?" The dashboard becomes a wall of data that nobody reads.

**Why it happens:**
Each piece of information is individually useful. The developer adds it because "why not, we have the data." No one steps back to ask "what decision does this information support?" The v1.0 project context explicitly warns about this: the "Grafana-style dashboard aesthetic led to useless UI (pretty but no depth)."

**Consequences:**
- The user ignores the dashboard and goes back to checking terminals manually
- Critical events (questions waiting for answers) are buried in noise
- The dashboard looks impressive in screenshots but fails in daily use
- Development time is wasted building features nobody uses

**Prevention:**
- The dashboard answers exactly TWO questions at glance: (1) "Is any session waiting for me?" and (2) "What is each session doing?"
- Design the default view to show: session name, status badge (idle/working/waiting/done/error), and time-since-last-event. NOTHING ELSE at the top level.
- Use progressive disclosure: click a session to see details. Details expand in-place or in a sidebar. Do not show details for all sessions simultaneously.
- Apply the "5 elements" rule: no more than 5 visible data points per session card in the default view.
- Test by squinting at the dashboard from 3 feet away. If you cannot identify which session needs attention, the design has failed.

**Warning signs:**
- Session cards have more than 3 lines of text
- You're adding a "show more" toggle to session cards (means the card already shows too much)
- The dashboard requires horizontal scrolling
- You're debating what font size to use (means too much text)

**Phase to address:** Dashboard UI phase (design principle, not a fix)

---

## Moderate Pitfalls

### Pitfall 7: Notification Regression During v1.0-to-v2.0 Migration

**What goes wrong:**
Voice notifications, push notifications, and toast notifications stop working during the v2.0 refactor. The user rebuilds the UI but breaks the notification playback path. The new session-centric model changes how triggers flow through the system, and the audio playback code that depended on the old event structure silently fails.

**Prevention:**
- Write an integration test before starting v2.0: POST to `/trigger`, verify SSE event received, verify audio endpoint returns valid audio. This test must pass at every commit.
- Do NOT refactor the notification pipeline (tts.js, push.js, sse.js) while building the new UI. These modules are working and modular. Only change them if a v2.0 feature requires it.
- The `/trigger` POST format is the contract. Do not change its shape. Add new fields, but never remove `type` and `project`.
- If adding sessionId/machine to the trigger, make them optional with backward-compatible defaults.

**Phase to address:** Every phase (continuous regression gate)

---

### Pitfall 8: SSE Event Bus Becomes a Bottleneck With Rich Session State

**What goes wrong:**
v1.0 sends small trigger events via SSE (~100 bytes each). v2.0 wants to send full session state (event history, status, metadata) via SSE. With 10 sessions each broadcasting full state on every update, each SSE write is 5-10KB. With multiple browser tabs connected, the server spends all its time serializing JSON and writing to sockets.

**Prevention:**
- Send deltas, not full state. An SSE event should contain ONLY what changed: `{sessionId, field, value}` not `{sessionId, ...entireSessionObject}`.
- The client maintains its own session state map and applies deltas. A full state sync happens only on initial connection (via the replay buffer) or explicit refresh.
- Keep the SSE buffer at 100 events (already set in sse.js). Do not increase it for "richer" events.
- If session state becomes complex, consider a separate `/sessions` REST endpoint for full state and use SSE only for change notifications.

**Phase to address:** Session model design phase

---

### Pitfall 9: Cross-Machine Hooks Silently Fail With No Visibility

**What goes wrong:**
The Lenovo hook script fails because the CodeBox server is temporarily unreachable (Tailscale reconnecting, PM2 restart, network blip). The hook fires, the HTTP request times out, no notification is sent. The user does not know the hook failed because there is no feedback channel from the hook script to the user.

**Prevention:**
- Hook scripts must have a configurable timeout (3-5 seconds) and log failures to a local file (`~/.voice-notify-errors.log`).
- Add a `/heartbeat` endpoint on the server. Hook scripts can optionally ping it on startup or periodically. If the server is unreachable, the script can show a system notification ("Voice Notify server unreachable") using the OS native notification mechanism (PowerShell on Windows, osascript on Mac).
- Dashboard should show "Last seen from [machine]: Xm ago" so the user can detect when a machine has gone silent.
- Do NOT retry failed hooks in a loop. Fire-and-forget with a single attempt is correct for hooks (they fire frequently enough that the next event will succeed).

**Phase to address:** Cross-machine aggregation phase

---

### Pitfall 10: CSS Layout Nightmare on Different Screen Sizes

**What goes wrong:**
The dashboard is designed for a 16" screen (the primary use case). On the Lenovo (15.6") it looks fine. On the Mac (14") some session cards are clipped. On a secondary monitor (24" ultrawide) there is a huge empty space. On a half-screen split (common when coding), the dashboard is completely unusable.

**Prevention:**
- Design for the SMALLEST expected viewport first: a half-screen split at 1920x1080 (960px wide). If it works there, it works everywhere.
- Use CSS Grid with `auto-fill` and `minmax()` for session cards. Cards should reflow, not clip.
- The sidebar (voice config) should be collapsible to zero width. When collapsed, it is a thin icon strip. Config is accessed rarely; it should not consume permanent screen space.
- Test at exactly 3 sizes: 960px (half-screen), 1440px (14" laptop), 1920px (full HD). These cover all real usage.
- Do NOT use `position: fixed` or `position: absolute` for any content area. Scrolling should be natural. Only the header (if any) can be fixed.

**Phase to address:** Dashboard UI phase

---

### Pitfall 11: Bidirectional Session Interaction Creates Security and Race Condition Risks

**What goes wrong:**
The dashboard has a "send message to session" feature. The user types a response to a Claude Code question. But the message is sent to the wrong session (race condition: the user was looking at session A, but session B came into focus). Or the message is injected into a session that already moved past the question, causing Claude to misinterpret it.

**Prevention:**
- For v2.0, limit bidirectional interaction to "copy the response to clipboard" + "navigate to the terminal." Do NOT attempt to programmatically inject text into a Claude Code session via stdin or API — Claude Code does not have a public input API.
- If implementing any form of response relay: require the user to explicitly select the target session AND confirm the action. No auto-routing.
- Every action must include the sessionId AND the eventId it is responding to. The server validates that the event is still the "current" pending question for that session before relaying.
- Add a "this question was already answered" guard. If the session moved past the PermissionRequest, the dashboard should show "Question expired" and block the response.

**Phase to address:** Actionable sessions phase (with scope limited to copy/navigate for v2.0)

---

## Minor Pitfalls

### Pitfall 12: Over-Engineering the Session ID

**What goes wrong:**
The developer tries to create a globally unique, persistent session ID that survives Claude Code restarts, terminal closes, and machine reboots. This requires correlating process PIDs, terminal session IDs, and working directories across machines. It is fragile and never fully works.

**Prevention:**
Use whatever sessionId Claude Code provides in hook context. If it does not provide one, use `machine:cwd` as a "session key" and accept that it is approximate. A session that restarts in the same directory gets the same key — this is acceptable behavior, not a bug.

---

### Pitfall 13: Building a Log Viewer Instead of a Dashboard

**What goes wrong:**
The session detail view becomes a scrolling log of every event, looking like a terminal output viewer. Users do not want to read logs — they want to see status and take action. A log viewer is the wrong abstraction for a command center.

**Prevention:**
Session detail should show: current status (large, prominent), last meaningful event (one line), and a BRIEF timeline (last 5-10 events, not all events). If the user wants full logs, they should go to the terminal.

---

### Pitfall 14: Premature Database Addition

**What goes wrong:**
The developer adds SQLite or a JSON database to persist session history, event logs, and analytics. This adds complexity (migrations, backup, corruption recovery) for data that is inherently ephemeral. Sessions are transient. Historical data has near-zero value for a personal notification tool.

**Prevention:**
All session state lives in server memory. On server restart, state resets to empty. This is correct behavior — if the server restarts, sessions reconnect and re-establish themselves. Do NOT add persistence for session state. The only persisted data should remain: voice config (config.json), VAPID keys, and TTS cache.

---

## Scope Creep — DO NOT List for v2.0

These features look valuable but will kill the project if attempted in v2.0.

| Feature | Why It Looks Appealing | Why It Kills the Project |
|---------|----------------------|--------------------------|
| **Session replay / time travel** | "See what happened while I was away" | Requires full event persistence, playback UI, timeline scrubber. 3x the complexity of the entire dashboard. |
| **Token/cost tracking per session** | "Know how much each session costs" | Claude Code hooks do not expose token counts. Would require parsing Claude API responses or scraping terminal output — both fragile and invasive. |
| **Git integration per session** | "See what branch each session is on" | Requires running git commands on remote machines via the hook. Hooks should be lightweight fire-and-forget, not query tools. |
| **Multi-user support** | "My teammate could use this too" | Adds auth, user isolation, permission model. The system is explicitly single-user. |
| **Mobile responsive layout** | "Check sessions from my phone" | The phone is not a coding device. Notifications reach the phone via push. The dashboard is a 16" screen tool. |
| **Custom notification sounds per project** | "Different sound for each project" | Already has per-type voice selection. Per-project adds a matrix of N projects x M types. Config UI becomes unmanageable. |
| **AI-generated session summaries in natural language** | "Manager AI writes a paragraph about each session" | LLM call per session, continuous cost, latency, hallucination risk. Pattern-matched status strings ("Working on voice_notifications, last event 2m ago") are faster, cheaper, and more accurate. |
| **Plugin/extension system** | "Let users add custom integrations" | This is a personal tool with one user. Abstraction layers for extensibility are pure overhead. |
| **Terminal embedding in dashboard** | "See the actual Claude output in the browser" | Would require terminal multiplexer integration (tmux/screen), WebSocket-based terminal emulation, and security hardening. This is a separate product, not a feature. |
| **Automated session management** | "Manager AI restarts failed sessions" | Requires process control over Claude Code, which has no management API. Also extremely dangerous — automated restart of an AI coding agent with no human supervision. |

---

## UX Anti-Patterns for Monitoring Dashboards

Real lessons from dashboard design literature and v1.0 experience.

### What Users Actually Look At

| What designers think users look at | What users actually look at |
|-----------------------------------|---------------------------|
| Pretty session cards with icons | The red/yellow dot that means "needs attention" |
| Detailed event timelines | The number next to "waiting" |
| Machine-by-machine breakdown | "Is anything broken right now?" (single glance) |
| Historical trends and graphs | Nothing — they close the tab if nothing is red |
| Manager AI summaries | The first 3 words, then they click the terminal |

### What Makes Dashboards Fail in Practice

1. **No visual hierarchy of urgency.** All sessions look the same. A session waiting for user input looks identical to a session that finished 5 minutes ago. The user scans all 8 sessions to find the one that matters.

2. **Stale data without indication.** The SSE connection drops. The dashboard shows the last known state. The user trusts it. They ignore a session that has been waiting for 10 minutes because the dashboard still shows it as "working." ALWAYS show connection status and data freshness prominently.

3. **Alert fatigue from over-notification.** v1.0 already hit this with sub-agent Stop events. v2.0 risks it again with Manager AI observations, session state changes, and cross-machine events. The threshold for a notification must be HIGH: only "question waiting" and "session done" deserve audio/push. Everything else is visual-only.

4. **Layout shifts when data updates.** A new session appears, pushing all other cards down. The user was about to click session C, but it moved. This is infuriating. Session card positions must be STABLE. New sessions append at the end. Finished sessions stay in place (grayed out), not removed.

5. **Modal dialogs for configuration.** The user is monitoring sessions. A modal blocks the entire view to change a voice setting. Use a sidebar or inline editing, never modals.

---

## Integration Pitfalls Specific to This System

| Integration Point | v2.0 Risk | Prevention |
|--------------------|-----------|------------|
| `/trigger` POST body format | Adding new required fields breaks existing hooks on Lenovo/Mac | New fields must be optional with defaults |
| sse.js event buffer | Growing event payloads exceed buffer memory | Keep buffer at 100 events; send deltas not full state |
| tts.js generateCached | More sessions = more concurrent edge-tts processes | Queue TTS generation; max 2 concurrent processes |
| config.js | New config fields for Manager AI/dashboard preferences | Add new config sections, never restructure existing voice config |
| public/index.html | Currently loaded once via readFileSync at startup | For active development, switch to re-reading on request (dev mode) or use a proper static file server |
| Hook scripts on remote machines | Must be updated for new fields (sessionId, machine) | Backward-compatible: if hook sends old format, server fills defaults |
| PM2 process management | Server memory grows with session state in memory | Monitor with `pm2 monit`; set `max_memory_restart` in ecosystem config |
| Caddy reverse proxy | New endpoints (e.g., `/sessions`, `/manager-ai`) need proxy rules | Use catch-all route (already in place); no Caddy changes needed if all routes are on same port |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Session model design | Trying to track session lifecycle (start/end) | Use TTL-based staleness; no start/end events exist |
| Dashboard UI | Information overload; Grafana syndrome returns | 5-element rule per card; progressive disclosure; squint test |
| Dashboard UI | Memory leaks from long-running tab | Ring buffers; event delegation; periodic memory audit |
| Dashboard UI | Layout instability from dynamic sessions | Stable card positions; append-only; no removal on completion |
| Cross-machine aggregation | Clock skew breaks event ordering | Server-assigned IDs for ordering; client timestamps as metadata only |
| Cross-machine aggregation | Remote hooks silently fail | Local error logging; "last seen" display per machine |
| Manager AI | Cost explosion from per-event LLM calls | Batch processing; token budget; cheapest model; consider no-LLM alternative |
| Manager AI | Feedback loops (AI responding to AI) | Observe-only for v2.0; source tagging on all events |
| Actionable sessions | Sending response to wrong/expired session | Target validation with sessionId + eventId; "expired" guard |
| Notification preservation | v1.0 audio/push breaks during refactor | Integration test gate; do not refactor working modules |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Session state model wrong | HIGH | Redesign requires changing server, SSE events, and client — do it right first |
| Manager AI cost explosion | LOW | Disable Manager AI feature; dashboard works without it |
| Memory leaks in dashboard | MEDIUM | Add ring buffers and cleanup; may require rewriting event rendering |
| Information overload UI | MEDIUM | Redesign session cards to minimal; progressive disclosure retrofit |
| Clock skew ordering issues | LOW | Switch to server-assigned ordering; client change only |
| Notification regression | LOW | Revert to last working commit; modules are separate files |
| Remote hook failures | LOW | Add error logging to hook scripts; no server change needed |

---

## "Looks Done But Isn't" Checklist for v2.0

- [ ] **Session model:** Leave dashboard open for 2 hours with 5 active sessions. Are all sessions still tracked correctly? Any phantom sessions?
- [ ] **Memory:** After 2 hours, is browser memory under 200MB? Check with DevTools Memory tab.
- [ ] **Notification regression:** Trigger a `done` and `question` event. Does voice play? Does push arrive? Does toast appear?
- [ ] **Cross-machine:** Trigger events from CodeBox and Lenovo within 1 second of each other. Do they appear in the correct order?
- [ ] **Clock skew:** Set Lenovo clock 5 seconds ahead. Do events still sort correctly on the dashboard?
- [ ] **Screen sizes:** View dashboard at 960px wide (half-screen split). Can you see which session needs attention?
- [ ] **Layout stability:** While watching the dashboard, trigger a new session. Do existing session cards move?
- [ ] **SSE reconnect:** Kill the server, wait 5 seconds, restart. Does the dashboard reconnect and show current state?
- [ ] **Manager AI budget:** If Manager AI is active, check API cost after 1 hour with 5 sessions. Is it under $0.50/hour?
- [ ] **Hook backward compatibility:** Use an OLD hook script (pre-v2.0 format). Does the server still process it correctly?

---

## Sources

- [From Data To Decisions: UX Strategies For Real-Time Dashboards — Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Dashboard UX Best Practices — DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-ux)
- [9 Dashboard Design Principles — DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Memory Leaks in SPA: Prevention, Detection, and Remediation — SciUp](https://sciup.org/memory-leaks-in-spaprevention-detection-and-remediation-methods-14131720)
- [The "Aw, Snap!" Crash: Detecting SPA Memory Leaks in Production — Medium](https://medium.com/frontend-simplified/the-aw-snap-crash-detecting-spa-memory-leaks-in-production-3186fcca42ac)
- [Mastering Memory Management in Single Page Applications — InfiniteJS](https://infinitejs.com/posts/mastering-memory-management-spa/)
- [Clock Synchronization Is a Nightmare — Arpit Bhayani](https://arpitbhayani.me/blogs/clock-sync-nightmare/)
- [When Logs Lie: How Clock Drift Skews Reality — Scalar Dynamic](https://scalardynamic.com/resources/articles/21-when-logs-lie-how-clock-drift-skews-reality-and-breaks-systems)
- [How to Resolve Clock Skew in OpenTelemetry Distributed Traces — OneUptime](https://oneuptime.com/blog/post/2026-02-06-resolve-clock-skew-opentelemetry-distributed-traces/view)
- [AI Agent ROI in 2026: Avoiding the 40% Failure Rate — Company of Agents](https://www.companyofagents.ai/blog/en/ai-agent-roi-failure-2026-guide)
- [Why AI Agent Pilots Fail in Production — Composio](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap)
- [Causes of Memory Leaks in JavaScript — Ditdot](https://www.ditdot.hr/en/causes-of-memory-leaks-in-javascript-and-how-to-avoid-them)

---
*Pitfalls research for: v2.0 Center Console — session command center, Manager AI, cross-machine aggregation*
*Researched: 2026-03-28*
