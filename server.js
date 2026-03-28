import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { load as loadConfig, get as getConfig, update as updateConfig, save as saveConfig, getVoices, DATA_DIR, SAMPLES_DIR } from './config.js';
import { generateSamples, generateCached, getCachePath, clearCache, getSamples, safeName } from './tts.js';
import { emit, addClient, getClientCount } from './sse.js';

const PORT = process.env.PORT || 3099;

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

// Initialize config
loadConfig();

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
        const { voice, template, type } = JSON.parse(body);
        const t = type || 'done';
        updateConfig(t, voice, template);
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
        const { type: rawType, project: rawProject, sessionId, machine, cwd, timestamp } = JSON.parse(body);
        const type = rawType || 'done';
        const project = rawProject || '';

        if (isDuplicate(type, project, sessionId || 'unknown')) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ ok: true, deduplicated: true }));
          return;
        }

        // Emit to SSE event bus
        emit('trigger', { type, project, machine, sessionId, timestamp });

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

  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(indexHtml);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Voice notification server running on port ' + PORT);
});
