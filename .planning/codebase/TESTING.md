# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**
- Not detected — no test framework configured (no `jest.config.*`, `vitest.config.*`, or test dependencies)

**Assertion Library:**
- Not applicable

**Run Commands:**
- No test runner configured

## Test File Organization

**Location:**
- Not applicable — no test files present

**Naming:**
- No test files found

**Structure:**
- Not applicable

## Testing Status

**Current State:**
- Zero test coverage detected
- No test files present (no `*.test.js`, `*.spec.js`, or test directory)
- No testing framework dependencies in project
- All code is untested

## Critical Untested Areas

These areas have zero coverage and present risk when modified:

**Core Server Logic (`server.js`):**
- HTTP request routing and endpoint handling
- Configuration persistence (`saveConfig()`)
- Sample generation and caching (`generateSamples()`, `generateCached()`)
- File system operations and cache management
- Request body parsing and JSON handling
- Error handling for edge cases (malformed JSON, missing files, etc.)

**Project Name Resolution (`hooks/notify-trigger.js`):**
- Name cache lookup and invalidation logic
- Project name resolution from multiple sources (display name file, CLAUDE.md, package.json)
- Folder name cleaning and formatting
- Cache TTL detection via modification time comparison
- Title case conversion and substring limiting

**Request Handlers:**
- `/trigger` endpoint — state management and WAV pre-generation
- `/check` endpoint — file modification time comparison and state detection
- `/select` endpoint — configuration updates and cache clearing
- `/generate` endpoint — voice sample generation from user input
- `/notify-wav` endpoint — cached WAV serving with error handling
- `/wav/` endpoint — static sample file serving

**Error Conditions:**
- Network failures in HTTP requests
- File system errors (permission denied, disk full, etc.)
- Malformed JSON in requests and config files
- Missing or corrupted WAV files
- Edge cases in safe name generation (special characters, length limits)

## Mocking

**Framework:** Not applicable

**Patterns:**
- Not used — no mocking infrastructure

**What to Mock (if tests are added):**
- `fs` module for file operations
- `child_process.exec` for edge-tts CLI calls
- `http` module for server and client requests
- Time functions (`Date.now()`) for timestamp-dependent logic

**What NOT to Mock (if tests are added):**
- HTTP routing logic (test real request paths and methods)
- Configuration persistence (test actual JSON serialization)
- URL parsing and query parameter extraction

## Fixtures and Factories

**Test Data:**
- Not present

**Location:**
- Would logically go in `test/fixtures/` or `data/test/` if tests are added

## Coverage

**Requirements:** None enforced

**Current Coverage:** 0% — no tests present

## Suggested Testing Strategy

If tests are to be added, prioritize:

1. **Server endpoint tests** (`server.js` — lines 306-422):
   - Mock fs and exec for unit tests
   - Test request routing and JSON response formatting
   - Test cache hit/miss logic in `/notify-wav`
   - Test safe name sanitization edge cases

2. **Project name resolution** (`hooks/notify-trigger.js` — lines 24-97):
   - Test name cleaning function with various input formats
   - Test cache invalidation logic with mocked file stats
   - Test fallback behavior when files don't exist

3. **Integration tests**:
   - Full flow: trigger → server writes file → browser detects change → serves WAV
   - Config persistence: select voice → config written → retrieved on next request
   - Cache behavior: multiple requests for same project → single WAV file used

## Test File Recommendations

If implementing tests:

**Structure:**
```
test/
├── unit/
│  ├── server.test.js           # Endpoint routing and logic
│  ├── notify-trigger.test.js   # Project name resolution
│  └── helpers.test.js          # Utility functions
├── integration/
│  ├── notification-flow.test.js # Full trigger → play flow
│  └── config-persistence.test.js # Config save/load
└── fixtures/
   ├── sample-config.json
   ├── mock-trigger.json
   └── test-voices.json
```

**Framework suggestion:** Jest or Vitest for consistency with Node.js ecosystem.

---

*Testing analysis: 2026-03-26*
