# Phase 1: Hook Reliability + Project Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-hook-reliability-project-identity
**Areas discussed:** Hook event mapping, Project name strategy, Hook unification, Deduplication approach

---

## Hook Event Mapping

### Q1: How should we detect 'question' events from Claude Code?

| Option | Description | Selected |
|--------|-------------|----------|
| Stop hook only | Single Stop hook, inspect output to classify done vs question | |
| Stop + Notification hook | Stop for done, Notification for question. Clean separation. | |
| Stop + SubagentStop | Stop for main, SubagentStop for subagents. Covers concurrent agents. | |

**User's choice:** "IMPLEMENT THE BEST SOLUTION NO MATTER HOW COMPLEX IT MIGHT BE"
**Notes:** User wants the most robust approach. Interpreted as Stop + Notification hooks for clean event separation.

### Q2: Should the hook pass rich context or just type + project?

| Option | Description | Selected |
|--------|-------------|----------|
| Type + project only | Minimal payload -- event type and project name | |
| Rich context | Event type, project, machine, session ID, duration, working directory | ✓ |

**User's choice:** Rich context
**Notes:** Sets up data pipeline for Phase 3 dashboard.

### Q3: What metadata should the hook capture?

| Option | Description | Selected |
|--------|-------------|----------|
| Machine identifier | Hostname or configured machine name | ✓ |
| Session ID | Unique identifier for Claude Code session | ✓ |
| Timestamp | Server-side timestamp of event reception | ✓ |
| Working directory | Directory Claude was working in | ✓ |

**User's choice:** All four selected
**Notes:** None

---

## Project Name Strategy

### Q1: How should the project name be resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Folder basename only | Just folder name, cleaned and title-cased | |
| Folder basename + display override | Default to basename, allow .claude/project-display-name override | ✓ |
| Keep current 4-step chain | Full fallback: display-name, CLAUDE.md, package.json, basename | |

**User's choice:** Folder basename + display override
**Notes:** Simple default with escape hatch for projects where folder name isn't ideal.

### Q2: How should folder basenames be cleaned?

| Option | Description | Selected |
|--------|-------------|----------|
| Title case + split | Split on hyphens/underscores/camelCase, title-case each word | ✓ |
| As-is (no cleaning) | Raw folder name, no transformation | |
| Custom cleaning rules | Specific rules for edge cases | |

**User's choice:** Title case + split (current behavior)
**Notes:** None

### Q3: Should resolved names be cached?

| Option | Description | Selected |
|--------|-------------|----------|
| No cache needed | Basename is instant, no file reads needed | |
| Cache everything | Keep .name-cache.json with mtime validation | ✓ |

**User's choice:** Cache everything
**Notes:** Belt and suspenders approach.

---

## Hook Unification

### Q1: Should we unify into one hook script?

| Option | Description | Selected |
|--------|-------------|----------|
| One Node script everywhere | Single notify-trigger.js on all machines, always HTTP | ✓ |
| Keep separate scripts | Shell for CodeBox, Node for remote | |
| One script + local shortcut | One script, detect localhost and write file directly | |

**User's choice:** One Node script everywhere
**Notes:** Clean, consistent, one codebase to maintain.

### Q2: How should the hook script be distributed?

| Option | Description | Selected |
|--------|-------------|----------|
| Git clone + symlink | Clone repo, symlink hook, update via git pull | ✓ |
| Copy via SCP | Manual copy when changed | |
| Serve from server | Curl script from server before running | |

**User's choice:** Git clone + symlink
**Notes:** Matches existing workflow.

---

## Deduplication Approach

### Q1: How should the server prevent duplicate notifications?

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side debounce window | Ignore triggers for same key within time window | ✓ |
| Event ID dedup | Hook generates UUID, server tracks seen IDs | |
| Both combined | Event IDs + debounce as safety net | |

**User's choice:** Server-side debounce window
**Notes:** None

### Q2: How long should the debounce window be?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 seconds | Per (type, project) pair | ✓ |
| 5 seconds | More conservative | |
| 1 second | Minimal window | |

**User's choice:** 3 seconds
**Notes:** None

### Q3: Should debounce key include session ID?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include session ID | Key is (type, project, sessionId) -- two sessions can fire simultaneously | ✓ |
| No, just type + project | Simpler but could suppress cross-session events | |

**User's choice:** Yes, include session ID
**Notes:** Prevents cross-session suppression when running multiple Claude sessions on the same project.

---

## Claude's Discretion

- Server-side debounce implementation details
- Session ID extraction from Claude Code hook env vars
- Error handling for unreachable server
- Whether trigger.json is still needed or replaced in Phase 2

## Deferred Ideas

None -- discussion stayed within phase scope
