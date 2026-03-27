#!/usr/bin/env node
// Remote hook for machines that connect to the notification server over HTTP
// Usage: node notify-trigger.js <done|question>
// Reads CLAUDE_PROJECT_DIR to resolve project name, then hits the server's /trigger endpoint

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const type = process.argv[2] || 'done';
const SERVER_URL = process.env.VOICE_NOTIFY_URL || 'http://100.123.116.23:3099';

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

function resolveProjectName(projectDir) {
  if (!projectDir) return '';

  // Check cache
  const cached = nameCache[projectDir];
  if (cached) {
    try {
      const sources = [
        path.join(projectDir, '.claude', 'project-display-name'),
        path.join(projectDir, 'CLAUDE.md'),
        path.join(projectDir, 'package.json'),
      ];
      const currentMtime = Math.max(...sources.map(f => {
        try { return fs.statSync(f).mtimeMs; } catch(e) { return 0; }
      }));
      if (currentMtime <= cached.mtime) return cached.name;
    } catch(e) {}
  }

  let name = '';
  const mtime = Date.now();

  // 1. Display name override file
  try {
    name = fs.readFileSync(path.join(projectDir, '.claude', 'project-display-name'), 'utf8').trim();
    if (name) { nameCache[projectDir] = { name, mtime }; saveCache(); return name; }
  } catch(e) {}

  // 2. CLAUDE.md parsing
  try {
    const md = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8').substring(0, 8192);

    // ## Project bold title
    const boldMatch = md.match(/^##\s+Project\s*\n+\*\*([^*]+)\*\*/m);
    if (boldMatch) {
      name = boldMatch[1].split(/[—–-]/)[0].trim();
      if (name) { nameCache[projectDir] = { name, mtime }; saveCache(); return name; }
    }

    // **Project:** pattern
    const projMatch = md.match(/\*\*Project:\*\*\s*(.+)/i);
    if (projMatch) {
      name = projMatch[1].trim();
      if (name) { nameCache[projectDir] = { name, mtime }; saveCache(); return name; }
    }
  } catch(e) {}

  // 3. package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    name = pkg.productName || pkg.name || '';
    if (name) {
      name = cleanFolderName(name);
      nameCache[projectDir] = { name, mtime }; saveCache(); return name;
    }
  } catch(e) {}

  // 4. Folder basename
  name = cleanFolderName(path.basename(projectDir));
  nameCache[projectDir] = { name, mtime }; saveCache();
  return name;
}

// --- Trigger ---

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const project = resolveProjectName(projectDir);

const triggerUrl = `${SERVER_URL}/trigger?type=${encodeURIComponent(type)}&project=${encodeURIComponent(project)}`;
const client = triggerUrl.startsWith('https') ? https : http;

const req = client.get(triggerUrl, (res) => {
  res.resume();
  process.exit(0);
});

req.on('error', () => process.exit(0));
req.setTimeout(4000, () => { req.destroy(); process.exit(0); });
