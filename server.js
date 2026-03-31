import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { getSdkSessions, getSdkMessages, sendResponse, findSdkSessionForCwd } from './sdk-bridge.js';
import { load as loadConfig, get as getConfig, update as updateConfig, save as saveConfig, getVoices, DATA_DIR, SAMPLES_DIR } from './config.js';
import { generateSamples, generateCached, getCachePath, clearCache, getSamples, safeName } from './tts.js';
import { emit, addClient, getClientCount } from './sse.js';
import { loadPush, getPublicKey, addSubscription, pushToAll } from './push.js';
import { upsertSession, handleToolUpdate, dismissSession, getAllSessions, loadSessions } from './sessions.js';

const PORT = process.env.PORT || 3099;

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
    return false;
  }
}

// Debounce map: prevents duplicate triggers within window
const debounceMap = new Map();
const DEBOUNCE_MS = 3000;

function isDuplicate(type, project, sessionId) {
  const key = `${type}:${project}:${sessionId}`;
  const now = Date.now();
  const last = debounceMap.get(key);
  if (last && (now - last) < DEBOUNCE_MS) return true;
  debounceMap.set(key, now);
  return false;
}

// Cleanup stale debounce entries every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 30000;
  for (const [key, ts] of debounceMap) {
    if (ts < cutoff) debounceMap.delete(key);
  }
}, 60000);

function extractToolTarget(toolName, rawTarget) {
  if (!rawTarget) return '';
  // For file paths, show last 2 segments
  if (rawTarget.includes('/') || rawTarget.includes('\\')) {
    const parts = rawTarget.replace(/\\/g, '/').split('/');
    return parts.slice(-2).join('/');
  }
  return rawTarget.substring(0, 80);
}

// Initialize config, push, and sessions
loadConfig();
loadPush();
loadSessions();

// Load HTML from disk
const htmlPath = join(import.meta.dirname, 'public', 'index.html');
let indexHtml = readFileSync(htmlPath, 'utf8');

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  if (pathname === '/events') {
    const lastEventId = req.headers['last-event-id'] || null;
    addClient(req, res, lastEventId);
    return;

  } else if (pathname === '/config') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getConfig()));

  } else if (pathname === '/samples') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getSamples()));

  } else if (pathname === '/notify-wav') {
    const type = params.get('type') || 'done';
    const project = params.get('project') || 'project';
    generateCached(type, project, (err, wavPath) => {
      if (err || !wavPath || !existsSync(wavPath)) {
        res.writeHead(404); res.end('Not generated');
        return;
      }
      try {
        const data = readFileSync(wavPath);
        res.writeHead(200, {'Content-Type': 'audio/mpeg', 'Content-Length': data.length, 'Cache-Control': 'no-cache'});
        res.end(data);
      } catch(e) {
        res.writeHead(500); res.end('Read error');
      }
    });

  } else if (pathname.startsWith('/wav/')) {
    const file = basename(pathname.replace('/wav/', ''));
    const filePath = join(SAMPLES_DIR, file);
    try {
      const data = readFileSync(filePath);
      res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': data.length});
      res.end(data);
    } catch(e) {
      res.writeHead(404); res.end('Not found');
    }

  } else if (pathname === '/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        generateSamples(text || 'Done', () => {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ ok: true }));
        });
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });

  } else if (pathname === '/select' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { voice, template, type, rate, pitch } = JSON.parse(body);
        const t = type || 'done';
        updateConfig(t, voice, template, rate, pitch);
        clearCache(t);
        emit('config:updated', getConfig());
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: true, voice, template, type: t }));
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });

  } else if (pathname === '/trigger' && req.method === 'POST') {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 4096) { req.destroy(); return; }
    });
    req.on('end', () => {
      try {
        const { type: rawType, project: rawProject, sessionId, machine, cwd, timestamp, toolName, toolTarget, questionText, source } = JSON.parse(body);
        const type = rawType || 'done';
        const project = rawProject || '';

        // Route by event type
        if (type === 'tool') {
          // Silent state update — no notifications, no debounce check
          handleToolUpdate(sessionId || 'unknown', toolName || '', extractToolTarget(toolName, toolTarget));
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ ok: true, type: 'tool' }));
          return;
        }

        if (type === 'session-start') {
          // Register session immediately — no notifications, skip debounce
          upsertSession({
            sessionId: sessionId || 'unknown',
            project,
            machine: machine || 'unknown',
            cwd: cwd || '',
            type: 'session-start',
            source: source || 'startup'
          });
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ ok: true, type: 'session-start' }));
          return;
        }

        // done and question — full notification flow
        if (isDuplicate(type, project, sessionId || 'unknown')) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ ok: true, deduplicated: true }));
          return;
        }

        // Create/update server-side session
        upsertSession({
          sessionId: sessionId || 'unknown',
          project,
          machine: machine || 'unknown',
          cwd: cwd || '',
          type,
          questionText: type === 'question' ? (questionText || null) : null
        });

        // Emit to SSE event bus
        emit('trigger', { type, project, machine, sessionId, timestamp });

        // Fire-and-forget push to all subscribed browsers
        pushToAll(type, project).catch(() => {});

        // Pre-generate cached WAV in background
        if (project) {
          generateCached(type, project, () => {});
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: true, type, project, deduplicated: false }));
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });

  } else if (pathname === '/sw.js') {
    try {
      const swPath = join(import.meta.dirname, 'public', 'sw.js');
      const sw = readFileSync(swPath, 'utf8');
      res.writeHead(200, {'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/'});
      res.end(sw);
    } catch(e) {
      res.writeHead(404); res.end('Not found');
    }

  } else if (pathname === '/vapid-public-key') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ publicKey: getPublicKey() }));

  } else if (pathname === '/subscribe' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const sub = JSON.parse(body);
        addSubscription(sub);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });

  } else if (pathname === '/sessions') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getAllSessions()));

  } else if (/^\/sessions\/([^/]+)\/dismiss$/.test(pathname) && req.method === 'POST') {
    const id = decodeURIComponent(pathname.match(/^\/sessions\/([^/]+)\/dismiss$/)[1]);
    dismissSession(id);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: true }));

  } else if (pathname === '/sdk/match-session' && req.method === 'GET') {
    const cwd = params.get('cwd') || '';
    findSdkSessionForCwd(cwd).then(match => {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(match));
    });

  } else if (pathname === '/sdk/sessions' && req.method === 'GET') {
    getSdkSessions().then(sessions => {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(sessions));
    });

  } else if (/^\/sdk\/sessions\/([^/]+)\/messages$/.test(pathname) && req.method === 'GET') {
    const id = pathname.match(/^\/sdk\/sessions\/([^/]+)\/messages$/)[1];
    const limit = parseInt(params.get('limit')) || 20;
    const offset = parseInt(params.get('offset')) || 0;
    getSdkMessages(decodeURIComponent(id), limit, offset).then(messages => {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(messages));
    });

  } else if (/^\/sdk\/sessions\/([^/]+)\/send$/.test(pathname) && req.method === 'POST') {
    const id = pathname.match(/^\/sdk\/sessions\/([^/]+)\/send$/)[1];
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 4096) { req.destroy(); return; }
    });
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        sendResponse(decodeURIComponent(id), text).then(result => {
          const status = result.ok ? 200 : 500;
          res.writeHead(status, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(result));
        });
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });

  } else if (pathname === '/hooks/install') {
    const installPath = join(import.meta.dirname, 'public', 'hooks-install.html');
    try {
      const data = readFileSync(installPath, 'utf8');
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    } catch(e) {
      res.writeHead(404); res.end('Not found');
    }

  } else if (pathname === '/hooks/script') {
    const scriptPath = join(import.meta.dirname, 'hooks', 'notify-trigger.cjs');
    try {
      const data = readFileSync(scriptPath);
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Content-Disposition': 'attachment; filename="notify-trigger.cjs"'
      });
      res.end(data);
    } catch(e) {
      res.writeHead(404); res.end('Not found');
    }

  } else if (pathname === '/hooks/test' && req.method === 'POST') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: true, server: 'voice-notifications', timestamp: new Date().toISOString() }));

  } else {
    // Try static file first (for .js, .css, etc.)
    if (pathname !== '/' && serveStatic(pathname, res)) return;
    // Fall through to index.html for SPA
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(indexHtml);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Voice notification server running on port ' + PORT);
});
