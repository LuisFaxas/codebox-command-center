const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 3099;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TRIGGER_FILE = path.join(DATA_DIR, 'trigger.json');
const SAMPLES_DIR = path.join(DATA_DIR, 'samples');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const VOICES = [
  'en-US-GuyNeural',
  'en-US-EricNeural',
  'en-US-ChristopherNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural',
];

let lastTrigger = 0;

// Config: voice + template per type, persisted to disk
let config = {
  done: { voice: 'en-US-GuyNeural', template: 'Done with {project}' },
  question: { voice: 'en-US-GuyNeural', template: 'I need your attention at {project}' },
};

// Ensure directories exist
[DATA_DIR, SAMPLES_DIR, CACHE_DIR].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

try {
  if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
} catch(e) {}

// Debounce map: prevents duplicate triggers within window (per D-10, D-11)
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

// Cleanup stale debounce entries every 60 seconds (prevents memory leak on long-lived server)
setInterval(() => {
  const cutoff = Date.now() - 30000;
  for (const [key, ts] of debounceMap) {
    if (ts < cutoff) debounceMap.delete(key);
  }
}, 60000);

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getSamples() {
  try {
    return fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.wav') && f.includes('--')).sort();
  } catch(e) { return []; }
}

function generateSamples(text, cb) {
  try {
    fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.wav')).forEach(f => {
      fs.unlinkSync(path.join(SAMPLES_DIR, f));
    });
  } catch(e) {}

  let done = 0;
  const total = VOICES.length;
  const safeText = text.replace(/'/g, "'\\''");

  VOICES.forEach(voice => {
    const shortName = voice.replace('en-US-','').replace('Neural','').toLowerCase();
    const outFile = path.join(SAMPLES_DIR, `${shortName}--${voice}.wav`);
    exec(
      `edge-tts --voice "${voice}" --rate="-5%" --pitch="-10Hz" --text '${safeText}' --write-media "${outFile}"`,
      { timeout: 15000 },
      (err) => {
        done++;
        if (done === total && cb) cb();
      }
    );
  });
}

function safeName(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
}

function getCachePath(type, project) {
  return path.join(CACHE_DIR, `${type}--${safeName(project)}.wav`);
}

function generateCached(type, project, cb) {
  const cachePath = getCachePath(type, project);
  if (fs.existsSync(cachePath)) {
    return cb(null, cachePath);
  }

  const cfg = config[type] || config.done;
  const text = cfg.template.replace(/\{project\}/g, project);
  const safeText = text.replace(/'/g, "'\\''");

  exec(
    `edge-tts --voice "${cfg.voice}" --rate="-5%" --pitch="-10Hz" --text '${safeText}' --write-media "${cachePath}"`,
    { timeout: 15000 },
    (err) => {
      if (err) return cb(err);
      cb(null, cachePath);
    }
  );
}

function clearCache(type) {
  try {
    fs.readdirSync(CACHE_DIR).filter(f => f.startsWith(type + '--') && f.endsWith('.wav')).forEach(f => {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    });
  } catch(e) {}
}

const html = `<!DOCTYPE html>
<html><head><title>Claude Notify</title></head>
<body style="background:#0d0d0d;color:#e0e0e0;font-family:system-ui;margin:0;padding:2rem">
<div style="max-width:700px;margin:0 auto">
  <h1 style="font-size:1.8rem;letter-spacing:2px;color:#c0392b;margin-bottom:0.5rem">CLAUDE VOICE PICKER</h1>
  <p style="opacity:0.5;margin-bottom:1.5rem">Set voice and template for each notification type. Use {project} in the template for the project name.</p>

  <div style="display:flex;gap:0;margin-bottom:1.5rem">
    <button id="tab-done" onclick="switchTab('done')"
      style="flex:1;padding:0.75rem;font-size:1rem;font-weight:bold;cursor:pointer;border:2px solid #c0392b;border-radius:8px 0 0 8px;background:#c0392b;color:#fff;transition:all 0.2s">
      DONE (Stop)
    </button>
    <button id="tab-question" onclick="switchTab('question')"
      style="flex:1;padding:0.75rem;font-size:1rem;font-weight:bold;cursor:pointer;border:2px solid #c0392b;border-radius:0 8px 8px 0;background:transparent;color:#c0392b;transition:all 0.2s">
      QUESTION (Ask)
    </button>
  </div>

  <div style="margin-bottom:1rem">
    <label style="font-size:0.85rem;opacity:0.6;display:block;margin-bottom:0.25rem">Template (use {project} for project name):</label>
    <input id="template" type="text" value=""
      style="width:100%;padding:0.75rem 1rem;font-size:1.1rem;background:#1a1a1a;color:#fff;border:2px solid #333;border-radius:8px;outline:none;box-sizing:border-box">
  </div>

  <div style="margin-bottom:0.75rem">
    <label style="font-size:0.85rem;opacity:0.6;display:block;margin-bottom:0.25rem">Preview text (for voice audition):</label>
    <div style="display:flex;gap:0.5rem">
      <input id="msg" type="text" value=""
        style="flex:1;padding:0.75rem 1rem;font-size:1.1rem;background:#1a1a1a;color:#fff;border:2px solid #333;border-radius:8px;outline:none"
        onkeydown="if(event.key==='Enter')generate()">
      <button onclick="generate()" id="genBtn"
        style="padding:0.75rem 1.5rem;background:#c0392b;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:bold;min-width:120px">
        GENERATE
      </button>
    </div>
  </div>

  <div id="current-selection" style="margin-bottom:1rem;padding:0.5rem 1rem;background:#1a1a1a;border-radius:6px;font-size:0.85rem;opacity:0.6"></div>

  <div id="voices" style="display:flex;flex-direction:column;gap:0.75rem"></div>

  <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #333">
    <p id="status" style="font-size:1.1rem;opacity:0.7">Pick a tab, set template, generate voices</p>
    <p id="count" style="font-size:0.85rem;opacity:0.4">0 notifications played</p>
  </div>
</div>
<script>
let count = 0;
let audio = null;
let currentTab = 'done';
let serverConfig = {};

async function loadConfig() {
  const res = await fetch('/config');
  serverConfig = await res.json();
  applyTab();
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-done').style.background = tab === 'done' ? '#c0392b' : 'transparent';
  document.getElementById('tab-done').style.color = tab === 'done' ? '#fff' : '#c0392b';
  document.getElementById('tab-question').style.background = tab === 'question' ? '#c0392b' : 'transparent';
  document.getElementById('tab-question').style.color = tab === 'question' ? '#fff' : '#c0392b';
  applyTab();
}

function applyTab() {
  const cfg = serverConfig[currentTab] || {};
  const template = cfg.template || (currentTab === 'done' ? 'Done with {project}' : 'I need your attention at {project}');
  document.getElementById('template').value = template;
  document.getElementById('msg').value = template.replace(/\\{project\\}/g, 'My Project');
  document.getElementById('voices').innerHTML = '';
  const el = document.getElementById('current-selection');
  const voice = cfg.voice || 'not set';
  el.textContent = 'Current voice: ' + voice + ' | Type: ' + currentTab;
}

async function generate() {
  const text = document.getElementById('msg').value.trim();
  if (!text) return;

  const btn = document.getElementById('genBtn');
  btn.textContent = 'GENERATING...';
  btn.disabled = true;
  document.getElementById('voices').innerHTML = '<p style="opacity:0.5">Generating all voices...</p>';

  const res = await fetch('/generate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ text })
  });
  const data = await res.json();

  btn.textContent = 'GENERATE';
  btn.disabled = false;

  if (data.ok) loadVoices();
}

async function loadVoices() {
  const res = await fetch('/samples');
  const samples = await res.json();
  const container = document.getElementById('voices');
  container.innerHTML = '';

  samples.forEach(function(name) {
    const parts = name.replace('.wav','').split('--');
    const shortName = parts[0];
    const fullVoice = parts[1] || shortName;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:#1a1a1a;border-radius:8px;border:2px solid transparent;transition:all 0.2s';

    const cfg = serverConfig[currentTab] || {};
    if (cfg.voice === fullVoice) row.style.borderColor = '#c0392b';

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.style.cssText = 'padding:0.4rem 1rem;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem;min-width:60px';
    playBtn.onclick = function(e) { e.stopPropagation(); playVoice(name); };

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;font-size:1rem;font-weight:500';
    nameSpan.textContent = shortName;

    const voiceSpan = document.createElement('span');
    voiceSpan.style.cssText = 'font-size:0.8rem;opacity:0.4';
    voiceSpan.textContent = fullVoice;

    const useBtn = document.createElement('button');
    useBtn.textContent = 'USE THIS';
    useBtn.style.cssText = 'padding:0.4rem 1rem;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem;font-weight:bold';
    useBtn.onclick = function(e) { e.stopPropagation(); selectVoice(fullVoice, row); };

    row.appendChild(playBtn);
    row.appendChild(nameSpan);
    row.appendChild(voiceSpan);
    row.appendChild(useBtn);
    container.appendChild(row);
  });
}

function playVoice(name) {
  if (audio) { audio.pause(); audio = null; }
  audio = new Audio('/wav/' + name + '?t=' + Date.now());
  audio.play();
}

async function selectVoice(voice, el) {
  document.querySelectorAll('#voices > div').forEach(function(d) { d.style.borderColor = 'transparent'; });
  if (el) el.style.borderColor = '#c0392b';

  const template = document.getElementById('template').value.trim();
  const res = await fetch('/select', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ voice: voice, template: template, type: currentTab })
  });
  const data = await res.json();
  if (data.ok) {
    serverConfig[currentTab] = { voice: voice, template: template };
    document.getElementById('status').textContent = 'Selected ' + voice + ' for ' + currentTab.toUpperCase() + '! Cache cleared.';
    document.getElementById('current-selection').textContent = 'Current voice: ' + voice + ' | Type: ' + currentTab;
  }
}

async function poll() {
  try {
    const res = await fetch('/check');
    const data = await res.json();
    if (data.notify && data.wav) {
      count++;
      if (audio) { audio.pause(); audio = null; }
      audio = new Audio('/notify-wav?type=' + encodeURIComponent(data.type || 'done') + '&project=' + encodeURIComponent(data.project || '') + '&t=' + Date.now());
      audio.play();
      const label = data.type === 'question' ? 'Question' : 'Done';
      const proj = data.project ? ' (' + data.project + ')' : '';
      document.getElementById('status').textContent = label + proj + ' — ' + new Date().toLocaleTimeString();
      document.getElementById('count').textContent = count + ' notifications played';
      setTimeout(function() {
        document.getElementById('status').textContent = 'Listening for notifications...';
      }, 4000);
    }
  } catch(e) {}
  setTimeout(poll, 1000);
}

loadConfig();
poll();
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/check') {
    let notify = false;
    let type = 'done';
    let project = '';
    try {
      const stat = fs.statSync(TRIGGER_FILE);
      if (stat.mtimeMs > lastTrigger) {
        lastTrigger = stat.mtimeMs;
        notify = true;
        try {
          const content = JSON.parse(fs.readFileSync(TRIGGER_FILE, 'utf8'));
          type = content.type || 'done';
          project = content.project || '';
        } catch(e) {}
      }
    } catch(e) {}
    const wav = notify ? fs.existsSync(getCachePath(type, project || 'default')) || true : false;
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ notify, wav, type, project }));

  } else if (parsed.pathname === '/config') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(config));

  } else if (parsed.pathname === '/samples') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getSamples()));

  } else if (parsed.pathname === '/notify-wav') {
    const type = parsed.query.type || 'done';
    const project = parsed.query.project || 'project';
    generateCached(type, project, (err, wavPath) => {
      if (err || !wavPath || !fs.existsSync(wavPath)) {
        res.writeHead(404); res.end('Not generated');
        return;
      }
      try {
        const data = fs.readFileSync(wavPath);
        res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': data.length, 'Cache-Control': 'no-cache'});
        res.end(data);
      } catch(e) {
        res.writeHead(500); res.end('Read error');
      }
    });

  } else if (parsed.pathname.startsWith('/wav/')) {
    const file = path.basename(parsed.pathname.replace('/wav/', ''));
    const filePath = path.join(SAMPLES_DIR, file);
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': data.length});
      res.end(data);
    } catch(e) {
      res.writeHead(404); res.end('Not found');
    }

  } else if (parsed.pathname === '/generate' && req.method === 'POST') {
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

  } else if (parsed.pathname === '/select' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { voice, template, type } = JSON.parse(body);
        const t = type || 'done';
        config[t] = { voice, template };
        saveConfig();
        clearCache(t);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: true, voice, template, type: t }));
      } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });

  } else if (parsed.pathname === '/trigger' && req.method === 'POST') {
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

        // Write trigger.json for backward compat with browser /check polling
        const now = new Date();
        fs.writeFileSync(TRIGGER_FILE, JSON.stringify({ type, project, machine, sessionId, timestamp }));
        fs.utimesSync(TRIGGER_FILE, now, now);

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

  } else if (parsed.pathname === '/trigger' && req.method === 'GET') {
    // Backward compat: old hooks still using GET with query params
    const type = parsed.query.type || 'done';
    const project = parsed.query.project || '';

    if (isDuplicate(type, project, 'legacy')) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ ok: true, deduplicated: true }));
      return;
    }

    const now = new Date();
    fs.writeFileSync(TRIGGER_FILE, JSON.stringify({ type, project }));
    fs.utimesSync(TRIGGER_FILE, now, now);
    if (project) {
      generateCached(type, project, () => {});
    }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: true, type, project }));

  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Claude voice notification server running on port ${PORT}`);
});
