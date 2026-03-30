# Phase 5: Frontend Rebuild + Session Cards - Research

**Researched:** 2026-03-30
**Domain:** Claude Agent SDK V2 integration + Frontend rebuild with FAXAS brand design system
**Confidence:** MEDIUM (SDK V2 is unstable preview; frontend patterns are HIGH confidence)

## Summary

This phase has two major domains: integrating the Claude Agent SDK V2 for session conversation viewing and response relay, and rebuilding the frontend as a branded command center. The SDK research reveals a critical limitation that reshapes the "respond to questions" feature: `resumeSession()` spawns a fresh Claude Code subprocess and replays the transcript -- it cannot inject messages into a running interactive terminal session. This means the SDK can read conversations from any session (including interactively started ones) via `listSessions()` and `getSessionMessages()`, but sending a response via `resumeSession().send()` will create a new turn in a separate subprocess, not feed input to the running terminal. The dashboard can still show conversations and attempt response relay, but with the caveat that the response goes to a resumed copy, not the live session.

The frontend rebuild is straightforward: ES modules served from vanilla Node.js HTTP server, glassmorphism CSS matching the FAXAS brand, and CSS Grid layout for the hybrid control room. Import maps have full browser support. The main challenge is the static file serving -- the current server only serves `index.html` and `sw.js` explicitly; it needs a general static file handler for `public/` with correct MIME types for `.js`, `.css`, and font files.

**Primary recommendation:** Implement SDK integration as a read-heavy feature (session listing + conversation viewing) with experimental write support (response relay via resumeSession). Build the frontend as ES modules with the FAXAS glass design system. Accept that response relay may not reach running interactive sessions -- it starts a new turn on the transcript.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Claude Agent SDK V2 integrated in this phase, not deferred. Dashboard reads real conversations via `listSessions()` / `getSessionMessages()` and sends responses via `resumeSession()` + `session.send()`.
- **D-02:** SDK runs server-side (Node.js on CodeBox). Browser doesn't call SDK directly -- server acts as proxy. New endpoints: GET /sdk/sessions, GET /sdk/sessions/:id/messages, POST /sdk/sessions/:id/send.
- **D-03:** Keep hooks for notifications (fast voice/push/toast). SDK adds session depth (conversation view, response relay). Two complementary systems, not a replacement.
- **D-04:** SDK V2 uses `unstable_v2_` prefix -- preview API. Wrap in an abstraction layer so SDK changes don't break the whole system.
- **D-05:** Hybrid layout -- compact status cards across the top (overview board), expanded conversation panel below for the selected session.
- **D-06:** Rich session cards in the top bar: project name, status badge, machine name, one-line preview of last message, and inline reply button for question sessions. 3-4 cards per row.
- **D-07:** Clicking a card opens its conversation in the bottom panel -- last N messages from SDK, scrollable. Response input at the bottom for sessions waiting for input.
- **D-08:** Default: show last 10-20 messages from the session. Scroll up for more.
- **D-09:** Response input appears only when a session has a pending question. User types, hits Send, SDK relays to the running session.
- **D-10:** Match FAXAS brand identity: `#0f0f1e` dark background, `#667eea -> #764ba2 -> #f093fb` accent gradient, glassmorphism surfaces.
- **D-11:** Font: DM Sans for primary, Geist Mono or JetBrains Mono for code/conversation content.
- **D-12:** Glass card pattern: `rgba(255,255,255,0.03-0.05)` backgrounds, `blur(10-16px)`, `1px solid rgba(255,255,255,0.10)` borders, `12px` border radius.
- **D-13:** Status colors: `#22c55e` (up/done), `#ef4444` (error), `#f59e0b` (warning/attention), `#6b7280` (unknown/stale).
- **D-14:** Dark mode only.
- **D-15:** Fill entire 16" screen. CSS Grid auto-fill. Conversation panel takes remaining height.
- **D-16:** Voice/template configuration in a persistent right sidebar, not hidden behind a gear icon. Sidebar can collapse.
- **D-17:** Frontend architecture approach is Claude's Discretion.
- **D-18:** No build step, no framework. Vanilla JS served as static files.

### Claude's Discretion
- Frontend file architecture (single file vs ES modules vs hybrid)
- Conversation message rendering (plain text, markdown, code highlighting)
- How SDK session IDs map to hook session IDs (may need reconciliation)
- Toast position and behavior in the new layout
- Activity feed -- keep, remove, or merge into conversation view
- Animation/transition approach

### Deferred Ideas (OUT OF SCOPE)
- AI-generated conversation summaries -- Phase 7 Manager AI scope
- Light mode -- future enhancement
- PostToolUse real-time tool tracking -- Phase 6
- Cross-machine session discovery -- Phase 6 hook installer
- Chat-style message bubbles -- may add complexity
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-05 | Dashboard uses full screen with CSS Grid layout optimized for 16" displays | CSS Grid with `grid-template-rows` for hybrid layout; `auto-fill` for session cards. See Architecture Patterns. |
| UI-06 | Voice and template configuration in persistent sidebar panel | Collapsible sidebar via CSS Grid column + transform. Existing config panel code can be adapted. |
| UI-07 | Frontend split into ES modules loaded via import maps (no build step) | Import maps fully supported in all modern browsers. Server needs static file handler with `application/javascript` MIME. See Don't Hand-Roll. |
| UI-08 | Session grid uses progressive disclosure -- overview cards expand to show detail | Cards in top grid; clicking sets selected session ID and renders conversation in bottom panel. |
| UI-09 | Dashboard answers "Is anything waiting?" and "What is each session doing?" | Attention count prominently displayed; status badges on all cards; conversation preview in each card. |
| SESS-03 | Session cards display project name, machine, status badge, duration, current tool, last message | Hook data provides project/machine/status/duration. SDK `getSessionMessages()` provides last message text. Current tool requires Phase 6 PostToolUse hooks -- show placeholder for now. |
| SESS-04 | User can click session card to expand full event history timeline | Bottom panel shows SDK conversation messages. Event history from `session.events[]` array in sessions.js. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | 0.2.87 | Session listing, message reading, response relay | Official SDK for Claude Code integration; only way to access session transcripts |
| DM Sans | Google Fonts | Primary UI font | FAXAS brand consistency (matching portfolio site) |
| JetBrains Mono | Google Fonts | Monospace font for code/conversation content | FAXAS brand consistency (matching portfolio site) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | All other functionality uses Node.js built-ins and vanilla browser APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ES modules + import maps | Single monolith file | Monolith is simpler but 4000+ lines becomes unmaintainable |
| Vanilla JS DOM | Lit/Web Components | Web Components add shadow DOM isolation but unnecessary complexity for single-user app |
| DM Sans via Google Fonts CDN | Self-hosted fonts | CDN is simpler; self-hosting avoids external dependency but adds build complexity |

**Installation:**
```bash
pnpm add @anthropic-ai/claude-agent-sdk
```

**Version verification:** `@anthropic-ai/claude-agent-sdk` is at version 0.2.87 on npm (verified 2026-03-30).

## Architecture Patterns

### Recommended Project Structure
```
public/
  index.html              # HTML shell + CSS custom properties + layout
  css/
    design-tokens.css     # FAXAS brand colors, fonts, glass, shadows
    layout.css            # Grid layout, responsive breakpoints
    components.css        # Session cards, sidebar, conversation panel
  modules/
    app.js                # Entry point, imports all modules, bootstraps
    state.js              # Shared state (sessions Map, selectedSession, config)
    sse.js                # SSE connection, event routing to state
    sessions.js           # Session card rendering, grid management
    conversation.js       # Conversation panel rendering, message display
    sidebar.js            # Config sidebar (voice, template, collapsible)
    toasts.js             # Toast notification system
    audio.js              # Voice playback
    sdk-client.js         # Fetch wrapper for /sdk/* endpoints
    utils.js              # escapeHtml, formatDuration, formatRelativeTime
```

### Pattern 1: Hybrid Control Room Layout
**What:** CSS Grid with fixed-height top row (session cards) and flex-grow bottom row (conversation panel), plus collapsible right sidebar.
**When to use:** Always -- this is the primary layout.
**Example:**
```css
/* Source: FAXAS brand design system + CSS Grid spec */
.command-center {
  display: grid;
  grid-template-columns: 1fr auto;        /* main + sidebar */
  grid-template-rows: auto 1fr;           /* cards + conversation */
  height: 100vh;
  background: #0f0f1e;
}

.session-overview {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 16px;
  max-height: 40vh;
  overflow-y: auto;
}

.conversation-panel {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-height: 0;  /* critical for flex overflow scroll */
}

.sidebar {
  grid-column: 2;
  grid-row: 1 / -1;
  width: 340px;
  transition: width 0.3s ease, opacity 0.3s ease;
}

.sidebar.collapsed {
  width: 48px;
  overflow: hidden;
}
```

### Pattern 2: Glass Card Component
**What:** Glassmorphism card matching FAXAS brand with status indicator.
**When to use:** Session cards, stat cards, conversation panel.
**Example:**
```css
/* Source: PORTFOLIO-DESIGN.md + HUB-DESIGN.md */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.glass-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.15);
}

.glass-card.selected {
  border-color: #667eea;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.2);
}

.glass-card.status-attention {
  border-left: 3px solid #f59e0b;
  animation: pulse-attention 2s ease-in-out infinite;
}
```

### Pattern 3: SDK Abstraction Layer
**What:** Server-side wrapper around unstable SDK V2 that isolates the rest of the system from API changes.
**When to use:** All SDK interactions.
**Example:**
```javascript
// sdk-bridge.js — server-side module
import { listSessions, getSessionMessages, unstable_v2_resumeSession } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_DIR = process.cwd();

export async function getSdkSessions() {
  try {
    const sessions = await listSessions({ dir: PROJECT_DIR, limit: 50 });
    return sessions.map(s => ({
      sessionId: s.sessionId,
      summary: s.summary,
      lastModified: s.lastModified,
      cwd: s.cwd,
      firstPrompt: s.firstPrompt,
      tag: s.tag,
      createdAt: s.createdAt,
    }));
  } catch (e) {
    return [];
  }
}

export async function getSdkMessages(sessionId, limit = 20, offset = 0) {
  try {
    const messages = await getSessionMessages(sessionId, {
      dir: PROJECT_DIR,
      limit,
      offset,
    });
    return messages.map(m => ({
      type: m.type,
      uuid: m.uuid,
      sessionId: m.session_id,
      content: extractTextContent(m.message),
    }));
  } catch (e) {
    return [];
  }
}

function extractTextContent(message) {
  // message.content is an array of content blocks
  if (!message || !message.content) return '';
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}

export async function sendResponse(sessionId, text) {
  try {
    const session = unstable_v2_resumeSession(sessionId, {
      model: 'claude-sonnet-4-20250514',
    });
    await session.send(text);
    const messages = [];
    for await (const msg of session.stream()) {
      if (msg.type === 'assistant') {
        const textContent = msg.message.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('');
        messages.push(textContent);
      }
    }
    session.close();
    return { ok: true, response: messages.join('\n') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

### Pattern 4: ES Module Static File Server
**What:** General static file handler for `public/` directory with correct MIME types.
**When to use:** Must be added to server.js before the catch-all route.
**Example:**
```javascript
// Add to server.js — static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function serveStatic(pathname, res) {
  const publicDir = join(import.meta.dirname, 'public');
  const filePath = join(publicDir, pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(data);
    return true;
  } catch (e) {
    return false;  // File not found, fall through
  }
}
```

### Pattern 5: Session ID Reconciliation
**What:** Mapping between hook-generated session IDs and SDK session IDs.
**When to use:** When displaying session cards that merge hook state (live status) with SDK data (conversation history).

The hook session IDs (from Claude Code's `session_id` field in hook stdin) are the SAME UUIDs used by the SDK's `listSessions()`. Session files are stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. The hook provides the session UUID, and the SDK reads from the same file.

**Reconciliation strategy:** Match by session ID directly. The server's `sessions.js` store already tracks `sessionId` from hooks. When the frontend requests conversation messages, it passes the same `sessionId` to `GET /sdk/sessions/:id/messages`, which calls `getSessionMessages(sessionId)` in the SDK.

**Edge case:** The SDK's `listSessions()` may return sessions the hook system has never seen (e.g., sessions started before the notification server was running, or sessions from other projects). These can be shown as "untracked" sessions in the UI.

### Anti-Patterns to Avoid
- **Calling SDK from browser:** The SDK spawns Claude Code subprocesses. It must run server-side only. The browser hits proxy endpoints.
- **Polling SDK endpoints:** Do NOT poll `/sdk/sessions` from the browser. Use the existing SSE event bus for real-time updates. Only fetch SDK data on demand (card click to load conversation).
- **Storing SDK messages server-side:** Do NOT cache conversation messages on the server. They are already persisted in JSONL files on disk. Fetch them from the SDK on each request.
- **Animating backdrop-filter:** GPU-intensive. Keep glass effects static. Animate transform/opacity instead for hover/transition effects.
- **Huge blur values:** Keep blur at 10-16px. Values above 24px are exponentially more expensive with no visual benefit on dark backgrounds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session transcript reading | Custom JSONL parser | `getSessionMessages()` from SDK | SDK handles pagination, parallel tool calls, format changes |
| Session discovery | Filesystem walk of `~/.claude/projects/` | `listSessions()` from SDK | SDK handles encoded paths, metadata extraction, sorting |
| Static file serving MIME types | Hardcoded per-route handlers | MIME_TYPES lookup table (see pattern above) | Extensible, handles new file types without code changes |
| HTML escaping | Regex-based escaping | Dedicated `escapeHtml()` utility with all 5 entities | XSS prevention; regex approaches miss edge cases |
| Relative time formatting | Custom date math | Reuse existing `formatRelativeTime()` from current index.html | Already tested and working in production |

**Key insight:** The SDK does the heavy lifting for session data. The server is a thin proxy. The frontend is the complex part -- layout, state management, and responsive rendering.

## Common Pitfalls

### Pitfall 1: resumeSession Creates a New Subprocess, Not IPC to Running Session
**What goes wrong:** Developer assumes `resumeSession(id).send("answer")` delivers the message to the user's running interactive Claude Code terminal session. Instead, it spawns a NEW Claude Code process that replays the transcript and processes the new message independently.
**Why it happens:** Session "resume" means "continue the conversation from the transcript file." The running interactive session and the SDK-resumed session are two separate processes reading the same JSONL file.
**How to avoid:** Document this limitation clearly in the UI. Show a warning like "Response will be added to the session transcript" rather than "Reply to Claude." Consider this experimental/beta.
**Warning signs:** User sends a response, the running terminal shows no reaction, but a new entry appears in the JSONL transcript.

### Pitfall 2: SDK listSessions Only Sees Local Machine Sessions
**What goes wrong:** Dashboard shows no sessions from Lenovo or Mac because `listSessions()` reads from `~/.claude/projects/` on CodeBox only.
**Why it happens:** Session JSONL files are local to the machine that created them. Remote machines have their own `~/.claude/projects/` directories.
**How to avoid:** In this phase, SDK session discovery only shows CodeBox sessions. Remote sessions are visible through hooks (which already POST to CodeBox). The conversation view is CodeBox-only until Phase 6 adds cross-machine hooks.
**Warning signs:** Session cards appear (from hooks) but "View Conversation" fails for remote sessions.

### Pitfall 3: Module Script MIME Type Rejection
**What goes wrong:** Browser refuses to execute ES modules served with wrong Content-Type. Error: "Failed to load module script: The server responded with a non-JavaScript MIME type."
**Why it happens:** ES modules enforce strict MIME checking. The current server's catch-all route serves everything as `text/html`.
**How to avoid:** Add the static file handler BEFORE the catch-all HTML route. Ensure all `.js` files are served as `application/javascript`.
**Warning signs:** Blank page, console shows MIME type error on first module import.

### Pitfall 4: CSS Grid Height Overflow
**What goes wrong:** Conversation panel doesn't scroll -- content overflows or the page gets a scrollbar.
**Why it happens:** Nested flex/grid containers need explicit `min-height: 0` to allow children to shrink below their content size. Without it, the grid row expands to fit all content.
**How to avoid:** Set `min-height: 0` on the conversation panel container and `overflow-y: auto` on the scrollable message list inside it.
**Warning signs:** Page scrollbar appears, conversation messages push the layout taller than viewport.

### Pitfall 5: Backdrop-filter Performance with Many Cards
**What goes wrong:** UI becomes sluggish when 10+ session cards all have `backdrop-filter: blur()`.
**Why it happens:** Each backdrop-filter composites separately on the GPU. Many overlapping blurred elements compound the cost.
**How to avoid:** Limit blur to the conversation panel and selected card. Use solid semi-transparent backgrounds (`rgba(255,255,255,0.05)` without blur) for most cards. Add blur only to focused/hovered elements.
**Warning signs:** Janky scroll in the session grid, high GPU usage in DevTools.

### Pitfall 6: Existing Playwright Tests Break
**What goes wrong:** The 10 existing notification tests in `tests/notifications.spec.mjs` fail because the HTML structure changed.
**Why it happens:** Tests likely rely on specific CSS selectors, element IDs, or DOM structure from the current index.html.
**How to avoid:** Read the existing tests before rebuilding. Preserve element IDs used by tests (`toast-container`, `connectionDot`, etc.) or update tests alongside the rebuild. Run tests after each major change.
**Warning signs:** `pnpm test` fails after the first frontend file change.

### Pitfall 7: SDK Package Requires TypeScript or Node.js 20+
**What goes wrong:** Import fails or SDK functions throw unexpected errors.
**Why it happens:** The SDK package may use modern JS features or have peer dependencies not met by the project.
**How to avoid:** The project uses Node.js v24 (verified from CLAUDE.md) and ES modules (`"type": "module"` in package.json). The SDK exports should work with plain JS imports. Test the import immediately after installation: `node -e "import { listSessions } from '@anthropic-ai/claude-agent-sdk'; console.log(typeof listSessions)"`.
**Warning signs:** SyntaxError or ERR_MODULE_NOT_FOUND on server startup after adding the dependency.

## Code Examples

### Loading SDK Sessions (Server-side)
```javascript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { listSessions } from '@anthropic-ai/claude-agent-sdk';

// List sessions for this project directory
const sessions = await listSessions({
  dir: '/home/faxas/workspaces/projects/personal/voice_notifications',
  limit: 50,
});

// Returns SDKSessionInfo[]
// { sessionId, summary, lastModified, cwd, firstPrompt, tag, createdAt }
```

### Reading Session Messages (Server-side)
```javascript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';

const messages = await getSessionMessages(sessionId, {
  dir: '/home/faxas/workspaces/projects/personal/voice_notifications',
  limit: 20,
  offset: 0,
});

// Returns SessionMessage[]
// { type: "user" | "assistant", uuid, session_id, message (raw payload), parent_tool_use_id }
// message.content is array of content blocks: { type: "text", text: "..." }
```

### Resuming Session and Sending Response (Server-side, V2 Preview)
```javascript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
import { unstable_v2_resumeSession } from '@anthropic-ai/claude-agent-sdk';

const session = unstable_v2_resumeSession(sessionId, {
  model: 'claude-sonnet-4-20250514',
});

await session.send("Yes, proceed with the refactor.");

for await (const msg of session.stream()) {
  if (msg.type === 'assistant') {
    const text = msg.message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    console.log(text);
  }
}

session.close();
```

### Glassmorphism Design Tokens (CSS)
```css
/* Source: PORTFOLIO-DESIGN.md + HUB-DESIGN.md */
:root {
  /* Brand colors */
  --bg-primary: #0f0f1e;
  --bg-surface: rgba(255, 255, 255, 0.03);
  --bg-elevated: rgba(255, 255, 255, 0.06);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Accent gradient */
  --accent-primary: #667eea;
  --accent-via: #764ba2;
  --accent-to: #f093fb;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);

  /* Status */
  --status-done: #22c55e;
  --status-error: #ef4444;
  --status-attention: #f59e0b;
  --status-stale: #6b7280;
  --status-working: #667eea;

  /* Glass */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-blur: blur(16px);
  --glass-border: 1px solid rgba(255, 255, 255, 0.10);
  --glass-radius: 12px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 20px rgba(200, 210, 225, 0.15);

  /* Typography */
  --font-primary: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Layout */
  --header-height: 52px;
  --sidebar-width: 340px;
  --sidebar-collapsed: 48px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### ES Module Import Map
```html
<!-- Source: MDN Web Docs - JavaScript modules -->
<script type="importmap">
{
  "imports": {
    "#state": "./modules/state.js",
    "#sse": "./modules/sse.js",
    "#sessions": "./modules/sessions.js",
    "#conversation": "./modules/conversation.js",
    "#sidebar": "./modules/sidebar.js",
    "#toasts": "./modules/toasts.js",
    "#audio": "./modules/audio.js",
    "#sdk": "./modules/sdk-client.js",
    "#utils": "./modules/utils.js"
  }
}
</script>
<script type="module" src="./modules/app.js"></script>
```

### Conversation Message Rendering
```javascript
// Rendering SDK messages as plain text with code block detection
function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = `message message-${msg.type}`;

  const content = msg.content || '';
  // Simple code block detection: lines between ``` markers
  const parts = content.split(/(```[\s\S]*?```)/g);

  for (const part of parts) {
    if (part.startsWith('```')) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      // Strip the ``` markers and optional language hint
      const lines = part.split('\n');
      code.textContent = lines.slice(1, -1).join('\n');
      pre.appendChild(code);
      div.appendChild(pre);
    } else {
      const p = document.createElement('p');
      p.textContent = part.trim();
      if (p.textContent) div.appendChild(p);
    }
  }

  return div;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP polling for session state | SSE push + REST snapshot | Phase 2 (2026-03-28) | Already implemented; keep it |
| Client-only session state | Server-side session store | Phase 4 (2026-03-29) | Already implemented; sessions.js is the foundation |
| Single monolith HTML file | ES modules + import maps | Phase 5 (this phase) | Enables modular development without build step |
| Hook-only session info | SDK transcript access | Phase 5 (this phase) | Dashboard can show actual conversation content |
| `query()` V1 async generators | V2 `send()/stream()` pattern | SDK 0.2.x (2026) | Simpler multi-turn API; still unstable preview |

**Deprecated/outdated:**
- V1 `query()` with async generators for multi-turn: Still stable but more complex than V2 `send()/stream()`. V2 is preview but simpler for the response relay use case.
- The ARCHITECTURE.md research (2026-03-28) recommended "copy-to-clipboard + terminal focus" for session responses. The SDK V2 discovery changes this -- actual response relay is now possible (with caveats).

## Open Questions

1. **Does resumeSession actually work for responding to AskUserQuestion in a running session?**
   - What we know: `resumeSession()` spawns a new subprocess and replays the transcript. `AskUserQuestion` prompts are handled in-loop within a single `query()` call. A resumed session starts a new turn, it does not inject input into the running session's stdin.
   - What's unclear: Whether the running interactive session detects that its JSONL file was modified by another process and picks up the response. Unlikely but worth testing.
   - Recommendation: Implement response relay but mark it as experimental/beta in the UI. If the resumed session's response is useful on its own (it processes the user's answer and continues), that has value even if the terminal session is unaware.

2. **Will SDK functions work from a different cwd than the session?**
   - What we know: Sessions are stored in `~/.claude/projects/<encoded-cwd>/`. The `dir` parameter in `listSessions()` and `getSessionMessages()` specifies which project directory to search.
   - What's unclear: If the server process is started from `/home/faxas/workspaces/projects/personal/voice_notifications`, can it access sessions from other project directories by passing different `dir` values?
   - Recommendation: Start with `dir: undefined` (searches all projects) for `listSessions()`, then use session-specific `dir` from the session's `cwd` field for `getSessionMessages()`. Test this immediately after SDK installation.

3. **How large are SDK message payloads?**
   - What we know: `getSessionMessages()` returns `SessionMessage[]` where `message` is the raw payload (includes tool_use, tool_result, text blocks). For a 20-message slice, this could be 50-200KB depending on tool usage.
   - What's unclear: Whether returning full raw messages to the browser is practical, or if server-side extraction of text content only is necessary.
   - Recommendation: Extract text content server-side (see `extractTextContent()` in the code examples). Only send human-readable text to the browser, not raw tool_use/tool_result blocks.

4. **Font loading strategy for DM Sans and JetBrains Mono**
   - What we know: Both fonts are available on Google Fonts CDN. The portfolio site loads DM Sans via Google Fonts.
   - What's unclear: Whether Google Fonts CDN is accessible from all machines on the network (Tailscale, LAN).
   - Recommendation: Use Google Fonts CDN with a `font-display: swap` fallback. If CDN is unreachable (air-gapped network), system fonts (`-apple-system, sans-serif`) are the fallback and still look good.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server + SDK | Yes | v24 | -- |
| pnpm | Package install | Yes | (global) | -- |
| @anthropic-ai/claude-agent-sdk | SDK integration | Not yet installed | 0.2.87 (npm) | -- |
| Python 3 + edge-tts | TTS (existing) | Yes | (existing) | -- |
| Google Fonts CDN | DM Sans, JetBrains Mono | Yes (network) | -- | System fonts |
| Playwright | Tests | Yes | 1.58.2 | -- |

**Missing dependencies with no fallback:**
- `@anthropic-ai/claude-agent-sdk` must be installed via `pnpm add @anthropic-ai/claude-agent-sdk`

**Missing dependencies with fallback:**
- Google Fonts: Falls back to system fonts if CDN unreachable

## Project Constraints (from CLAUDE.md)

- Use **pnpm** for package management (never npm or yarn)
- No build step required -- direct Node.js execution
- Plain JavaScript only, no TypeScript
- ES module imports (`"type": "module"` in package.json)
- 2-space indentation throughout
- camelCase for function/variable names
- UPPER_SNAKE_CASE for constants
- Node.js callback pattern for existing async operations (but SDK uses Promises/async-await)
- Console.log only at server startup
- Try-catch with silent error swallowing for non-critical operations
- JSON responses use `{ ok: true/false }` pattern
- Content-Type headers set explicitly for all responses
- GSD workflow enforcement -- use `/gsd:execute-phase` for planned work

## Sources

### Primary (HIGH confidence)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) - listSessions, getSessionMessages API signatures, return types
- [TypeScript SDK V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) - createSession, resumeSession, send/stream API
- [Work with Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) - Session persistence, resume semantics, cross-host limitations
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Version 0.2.87 verified
- PORTFOLIO-DESIGN.md - FAXAS brand colors, typography, glassmorphism tokens
- HUB-DESIGN.md - Glass components, status system, layout patterns

### Secondary (MEDIUM confidence)
- [MDN: JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) - ES module browser support, MIME requirements
- [CSS Glassmorphism performance](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) - 3-5 elements fine, 10+ causes lag, keep blur 8-16px
- [GitHub: claude-agent-sdk-typescript CHANGELOG](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md) - Recent fixes including getSessionMessages parallel tool calls

### Tertiary (LOW confidence)
- resumeSession behavior with running interactive sessions: Based on documentation inference (sessions are file-based, resume spawns new process). Needs practical validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK API is well-documented, version verified on npm
- Architecture: HIGH - CSS Grid, ES modules, glassmorphism are all well-established patterns
- SDK session reading: HIGH - listSessions/getSessionMessages are stable V1 functions with clear docs
- SDK response relay: LOW - unstable_v2_ prefix, unclear if it reaches running sessions, needs testing
- Pitfalls: MEDIUM - Based on documentation analysis and glassmorphism community experience

**Research date:** 2026-03-30
**Valid until:** 2026-04-15 (SDK is fast-moving; V2 API may change)
