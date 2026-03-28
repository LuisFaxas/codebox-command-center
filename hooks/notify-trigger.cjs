#!/usr/bin/env node
// Unified hook for all machines — sends rich JSON payloads to the notification server
// Usage: node notify-trigger.js <done|question>
// Reads JSON from stdin (Claude Code provides session_id, cwd, hook_event_name)
// Resolves project name from folder basename or .claude/project-display-name override

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const type = process.argv[2] || 'done';
const SERVER_URL = process.env.VOICE_NOTIFY_URL || 'http://100.123.116.23:3099';

// Global error handling — never exit non-zero (Research Pitfall 3)
process.on('uncaughtException', () => process.exit(0));

// --- Project name resolution ---

const CACHE_FILE = path.join(__dirname, '.name-cache.json');
let nameCache = {};
try { nameCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch(e) {}

function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(nameCache, null, 2)); } catch(e) {}
}

function cleanFolderName(name) {
  // camelCase split
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  // underscores/hyphens to spaces
  name = name.replace(/[_-]/g, ' ');
  // strip version suffixes
  name = name.replace(/\s*v?\d+(\.\d+)*\s*$/i, '');
  // title case, max 30 chars
  name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name.substring(0, 30);
}

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    // .git directory means we found the project root
    try {
      if (fs.statSync(path.join(dir, '.git')).isDirectory()) return dir;
    } catch(e) {}
    // .claude directory also indicates project root
    try {
      if (fs.statSync(path.join(dir, '.claude')).isDirectory()) return dir;
    } catch(e) {}
    dir = path.dirname(dir);
  }
  // No marker found — use the original directory
  return path.resolve(startDir);
}

function resolveProjectName(projectDir) {
  if (!projectDir) return 'Unknown';

  // Check cache
  const cached = nameCache[projectDir];
  if (cached) {
    if (cached.source === 'basename') return cached.name;
    const displayNamePath = path.join(projectDir, '.claude', 'project-display-name');
    try {
      const currentMtime = fs.statSync(displayNamePath).mtimeMs;
      if (currentMtime <= cached.mtime) return cached.name;
    } catch(e) {
      // File no longer exists — fall through to re-resolve
    }
  }

  // 1. Display name override file
  const displayNamePath = path.join(projectDir, '.claude', 'project-display-name');
  try {
    const name = fs.readFileSync(displayNamePath, 'utf8').trim();
    if (name) {
      const mtime = fs.statSync(displayNamePath).mtimeMs;
      nameCache[projectDir] = { name, mtime, source: 'file' };
      saveCache();
      return name;
    }
  } catch(e) {}

  // 2. Folder basename (always succeeds)
  const name = cleanFolderName(path.basename(projectDir));
  nameCache[projectDir] = { name, mtime: 0, source: 'basename' };
  saveCache();
  return name || 'Unknown';
}

// --- Stdin parsing and notification ---

let stdinDone = false;

function sendNotification(hookInput) {
  if (stdinDone) return;
  stdinDone = true;

  try {
    const sessionId = hookInput.session_id || 'unknown';
    const cwd = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const hookEventName = hookInput.hook_event_name || '';

    // Guard against infinite loop (Research Pitfall 1)
    if (hookInput.stop_hook_active === true) {
      process.exit(0);
    }

    // Discover project root from cwd
    const projectRoot = findProjectRoot(cwd);
    const project = resolveProjectName(projectRoot);

    const payload = JSON.stringify({
      type,
      project,
      sessionId,
      machine: os.hostname(),
      cwd,
      timestamp: new Date().toISOString()
    });

    const parsed = new URL(SERVER_URL);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: '/trigger',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      res.resume();
      process.exit(0);
    });

    req.on('error', () => process.exit(0));
    req.setTimeout(4000, () => { req.destroy(); process.exit(0); });
    req.write(payload);
    req.end();
  } catch(e) {
    process.exit(0);
  }
}

// Read JSON from stdin with timeout
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let hookInput = {};
  try { hookInput = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}
  sendNotification(hookInput);
});

// Timeout: if stdin never closes, proceed with defaults after 2 seconds
setTimeout(() => {
  process.stdin.destroy();
  let hookInput = {};
  try { hookInput = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}
  sendNotification(hookInput);
}, 2000);
