# Phase 6: Rich Hooks + Interaction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-30
**Phase:** 06-rich-hooks-interaction
**Areas discussed:** SDK conversation loading, Response relay UX, Hook installer, Session actions

---

## SDK Conversation Loading

**User's choice:** Auto-match by project directory (user didn't understand the technical difference — Claude decided the approach)
**Notes:** Match SDK sessions to hook sessions by cwd path. Use most recent SDK session for the project directory.

## Response Relay UX

**User's choice:** Full send capability
**Notes:** User specifically wants to answer GSD wizard questions (AskUserQuestion prompts) from the dashboard. No disclaimers needed.

## Hook Installer

**User's choice:** Must be dead-simple "just works" — needs research
**Notes:** User emphasized ease of setup. Must not affect CodeBox's existing config. Research best cross-platform approach.

## Session Actions

**User's choice:** Both — dismiss on card, full toolbar in conversation panel header
**Notes:** Progressive disclosure pattern.

## Claude's Discretion

- PostToolUse debounce strategy
- tmux session detection for Focus Terminal
- Hook installer technical approach
- SessionStart hook implementation
- Remote machine SDK session handling
