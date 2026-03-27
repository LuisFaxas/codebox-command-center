# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- Kebab-case for script filenames: `notify-trigger.js`, `notify-done.sh`
- No file extensions used for configuration data, only `.json`, `.sh`, `.js` for code
- Descriptive names that indicate purpose: `notify-trigger.js` (trigger notifications), `notify-done.sh` (local hook for completion)

**Functions:**
- camelCase for all function names
- Descriptive names that indicate action: `generateSamples()`, `generateCached()`, `resolveProjectName()`, `cleanFolderName()`
- Verb-first naming convention: `getSamples()`, `saveConfig()`, `selectVoice()`, `playVoice()`, `loadConfig()`

**Variables:**
- camelCase for variable names: `lastTrigger`, `nameCache`, `currentTab`, `serverConfig`
- UPPER_SNAKE_CASE for constants: `PORT`, `DATA_DIR`, `TRIGGER_FILE`, `SAMPLES_DIR`, `CACHE_DIR`, `CONFIG_FILE`, `VOICES`, `SERVER_URL`, `CACHE_FILE`
- Short names for loop/temporary variables: `i`, `f`, `e` for error objects, `cb` for callbacks

**Types:**
- No TypeScript used; plain JavaScript only
- Plain objects used for configuration: `config = { done: {...}, question: {...} }`
- Object property names use camelCase: `voice`, `template`, `project`, `type`, `shortName`, `fullVoice`

## Code Style

**Formatting:**
- No linting tool configured (no `.eslintrc`, `.prettierrc` detected)
- Consistent 2-space indentation throughout codebase
- No trailing semicolons enforced (both with and without present in code)
- Inline styles used extensively in HTML (embedded in `server.js`): `style="property:value;property:value"`

**Linting:**
- Not applicable — no linting configuration present

## Import Organization

**Node.js requires:**
- Standard library imports grouped first:
  ```javascript
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  const url = require('url');
  ```
- Only destructured imports when needed: `const { exec } = require('child_process')`
- All requires at top of file, before any code execution

**Path Aliases:**
- No aliases used; relative and absolute paths only
- Environment variables for paths: `DATA_DIR`, `SAMPLES_DIR`, `CACHE_DIR`
- `path.join()` used consistently for cross-platform compatibility

## Error Handling

**Patterns:**
- Try-catch blocks for file operations: `try { ... } catch(e) { }`
- Silent error swallowing common for non-critical operations (silently catch and return empty array/default value):
  ```javascript
  try {
    return fs.readdirSync(SAMPLES_DIR).filter(...).sort();
  } catch(e) { return []; }
  ```
- Callback-based error passing for async operations:
  ```javascript
  exec(..., (err) => {
    if (err) return cb(err);
    cb(null, result);
  });
  ```
- Boolean flags to indicate success/failure: `notify`, `wav`, `ok` properties in JSON responses
- Error messages passed as `error` property in JSON responses: `{ ok: false, error: e.message }`

## Logging

**Framework:** console (native)

**Patterns:**
- Single `console.log()` on server startup:
  ```javascript
  console.log(`Claude voice notification server running on port ${PORT}`);
  ```
- No other logging present; errors are silently caught and handled
- No debug logs or structured logging

## Comments

**When to Comment:**
- Comments used sparingly, primarily for:
  - File purpose at top of executable scripts: `#!/usr/bin/env node\n// Remote hook for machines...`
  - Complex resolution logic: `// Check cache`, `// Folder basename`, etc.
  - Configuration explanation: `// Config: voice + template per type, persisted to disk`
  - Numbered steps in multi-step processes: `// 1. Display name override file`, `// 2. CLAUDE.md parsing`, etc.

**JSDoc/TSDoc:**
- Not used; no TypeScript present

## Function Design

**Size:**
- Functions kept relatively compact (5-25 lines typical)
- Longest functions are in request handlers and initialization (~20-30 lines)

**Parameters:**
- Prefer positional parameters over objects for simple functions
- Callback pattern: final parameter is callback function: `generateSamples(text, cb)`, `generateCached(type, project, cb)`
- Query parameters extracted from URL and passed individually: `const type = parsed.query.type || 'done'`

**Return Values:**
- Synchronous functions return values directly: `return fs.readdirSync(...)`
- Async operations use callbacks (Node.js pre-Promise style): `cb(null, result)` or `cb(err)`
- Callback functions follow Node.js convention: `(err, result) => {}`

## Module Design

**Exports:**
- No module exports; all files are either executable scripts or server entry point
- `server.js` is main entry point, creates HTTP server but doesn't export
- `notify-trigger.js` is executable script with `#!/usr/bin/env node` shebang
- `notify-done.sh` is bash script

**Barrel Files:**
- Not applicable; no index files or barrel exports used

## Request/Response Patterns

**REST Endpoints:**
- Query parameters for GET requests: `/trigger?type=done&project=MyProject`
- JSON body for POST requests using manual parsing: `req.on('data', c => body += c)`
- Consistent JSON response format: `{ ok: true, ... }` or `{ ok: false, error: ... }`
- Content-Type headers set explicitly for all responses: `application/json`, `audio/wav`, `text/html`

**Client-Side (Embedded in HTML):**
- Async/await used for fetch API calls in browser JavaScript
- Minimal error handling (errors swallowed with try-catch in poll loop)
- Query string params used for cache-busting: `?t=' + Date.now()`

---

*Convention analysis: 2026-03-26*
