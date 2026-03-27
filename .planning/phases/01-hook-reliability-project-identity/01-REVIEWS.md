---
phase: 1
reviewers: [codex]
reviewed_at: 2026-03-27T00:00:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Codex Review

**Key Findings**
- [HIGH] Plan `01-01` does not explicitly solve project-root detection from subdirectories, so it can still produce the wrong project name.
- [HIGH] The planned debounce key `type:project:sessionId` is coarse enough to suppress legitimate rapid events, which turns "exactly once" into "at most once."
- [HIGH] Plan `01-02` does not verify the full phase goal across CodeBox, Lenovo, and Mac, and it omits explicit end-to-end validation of the `question` path.

### Plan 01-01

#### Summary
This is the right implementation wave to centralize hook behavior and move dedupe to the server. The split between hook payload generation and server-side suppression is sensible, but the plan as written still leaves the two hardest requirements underspecified: correct project identity from subdirectories and true exactly-once behavior.

#### Strengths
- Consolidates hook logic into one Node script, which matches the single-script decision and reduces drift across machines.
- Moves hooks to HTTP `POST` with JSON, which is cleaner and easier to validate than mixed file writes.
- Keeps backward compatibility via `GET /trigger` and `trigger.json`, which lowers rollout risk.
- Includes `stop_hook_active` handling and `exit 0`, which protects Claude Code from hook failures.
- Keeps `/check` untouched, which limits regression surface.

#### Concerns
- [HIGH] Project-name resolution is underspecified. If this is `basename(cwd)`, then running from `/repo/subdir` yields `subdir`, not the project root, so `HOOK-03`, `PROJ-01`, and `PROJ-03` can still fail.
- [HIGH] The known empty-`cwd` case on CodeBox is not explicitly handled. `HOOK-04` is a stated requirement, so the plan needs a fallback chain.
- [HIGH] Debouncing on `(type, project, sessionId)` can drop legitimate events if two real responses complete within 3 seconds in the same session. That is not "exactly once."
- [MEDIUM] Decision `D-06` (`.name-cache.json` with mtime validation) is missing. Either the plan is incomplete or that decision is being silently deferred.
- [MEDIUM] The debounce map has no cleanup strategy. On a long-lived server, stale keys will accumulate.
- [MEDIUM] Network timeout/abort behavior for the hook `POST` is not explicit. A slow or unreachable server can stall hooks.
- [MEDIUM] Security/input validation is not addressed. On Tailscale/LAN this may be acceptable, but any reachable client can still inject notifications unless the endpoint validates size/schema or uses a shared secret.
- [LOW] Replacing `url.parse` with `new URL()` is unrelated to the phase goal and adds avoidable regression risk.

#### Suggestions
- Define project-root discovery explicitly: walk up from `cwd` to find `.claude/project-display-name`, `.claude`, or `.git`, then derive the display name from that root.
- Add a `cwd` fallback chain such as `stdin cwd -> process.env.PWD -> process.cwd()`, and normalize to an absolute path before resolution.
- Either implement `.name-cache.json` now or mark it as an explicit defer with rationale.
- Revisit the debounce key. If no event-specific identifier exists, at minimum add a test for two legitimate `done` events within 3 seconds and document the tradeoff.
- Add an explicit HTTP timeout/abort and bounded cleanup for stale debounce entries.
- Keep unrelated parser modernization out of this wave unless it is required by the touched code path.

#### Risk Assessment
**HIGH**. The plan is directionally correct, but as written it can still miss the core success criteria: correct project naming from any directory and exactly-once event delivery.

### Plan 01-02

#### Summary
This is a reasonable rollout and verification wave after the code changes land. The main problem is coverage: it validates some mechanics, but it does not yet prove the phase goals across all machines or fully exercise the `question` notification path.

#### Strengths
- Uses absolute hook paths, which is the correct fix for subdirectory execution issues.
- Separates config/verification from the implementation wave, which is a clean dependency boundary.
- Includes both automated checks and human verification.
- Covers backward compatibility and the `stop_hook_active` guard.

#### Concerns
- [HIGH] The plan updates `~/.claude/settings.json` but does not include rollout and verification on CodeBox, Lenovo, and Mac, even though cross-machine behavior is an explicit requirement.
- [HIGH] Human verification does not explicitly test the `question` flow. `HOOK-02` is core, and `idle_prompt` has timing behavior that needs deliberate validation.
- [HIGH] The automated tests do not cover subdirectory launches, `.claude/project-display-name` override, or empty/missing `cwd`.
- [HIGH] There is no test for false-positive debounce suppression, such as two legitimate events in the same session within the 3-second window.
- [MEDIUM] Editing global Claude settings is risky if hooks already exist. The plan does not mention idempotent merge behavior or a backup.
- [MEDIUM] Absolute command paths may break on spaces or different Node install locations across machines.
- [LOW] `Restart PM2` is too implementation-specific unless PM2 is guaranteed everywhere this runs.

#### Suggestions
- Expand this wave into a per-machine rollout checklist for CodeBox, Lenovo, and Mac: script path, symlink/path validation, hook registration, and smoke test results.
- Add an explicit end-to-end test for `question` notifications with the expected `idle_prompt` delay and single-fire confirmation.
- Add automated cases for subdirectory `cwd`, override-file resolution, empty-`cwd` fallback, and two real events inside the debounce window.
- Update `~/.claude/settings.json` idempotently and preserve existing hooks rather than assuming exclusive ownership.
- Treat the restart step as "restart the running server process" unless PM2 is guaranteed.

#### Risk Assessment
**HIGH**. The rollout/test structure is fine, but it does not yet prove that the phase goals are met, especially for cross-machine correctness and exactly-once behavior.

---

## Consensus Summary

*Single reviewer (Codex) — consensus analysis not applicable. Key themes below.*

### Top Concerns (by severity)

1. **Project-root detection from subdirectories** — Using `basename(cwd)` when launched from a subdirectory yields the subdirectory name, not the project name. The plan needs explicit project-root discovery (walk up to find `.git` or `.claude/`).

2. **Debounce design may suppress legitimate events** — The 3-second window on `(type, project, sessionId)` can drop real events if Claude responds twice quickly in the same session. This violates "exactly once" by making it "at most once."

3. **Cross-machine verification missing** — Phase 1 only configures/tests on CodeBox. PROJ-03 requires Lenovo and Mac, but the verification plan doesn't cover remote machines.

4. **Question notification path untested** — `idle_prompt` has known timing quirks (60s delay). No automated or human test specifically validates the question notification flow end-to-end.

5. **Name cache (D-06) implementation unclear** — `.name-cache.json` with mtime validation is a locked decision but the plan's implementation details are vague on this point.

### Acknowledged Strengths
- Clean two-wave split (implement → verify)
- Backward compatibility preserved (GET fallback, trigger.json)
- Stop hook loop prevention with stop_hook_active guard
- Single unified script approach

### Divergent Views
N/A — single reviewer

---

*Review completed: 2026-03-27*
*Reviewers: Codex (OpenAI)*
