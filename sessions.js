import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './config.js';
import { emit } from './sse.js';

const STALE_MS = 5 * 60 * 1000;
const REMOVE_MS = 30 * 60 * 1000;
const PERSIST_INTERVAL_MS = 30000;
const CLEANUP_INTERVAL_MS = 30000;
const MAX_EVENTS_PER_SESSION = 20;
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

const sessions = new Map();

function sessionDelta(session) {
  const { events, ...delta } = session;
  return delta;
}

export function upsertSession({ sessionId, project, machine, cwd, type, questionText }) {
  const now = Date.now();
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      project: project || '',
      machine: machine || '',
      cwd: cwd || '',
      status: 'done',
      firstSeen: now,
      lastActivity: now,
      lastEventType: type || 'done',
      eventCount: 0,
      events: [],
      questionText: null,
      questionTimestamp: null,
    };
    sessions.set(sessionId, session);
  }

  session.project = project || session.project;
  session.machine = machine || session.machine;
  session.cwd = cwd || session.cwd;
  session.lastActivity = now;
  session.lastEventType = type || 'done';
  session.eventCount++;

  if (type === 'question') {
    session.status = 'attention';
    session.questionText = questionText || null;
    session.questionTimestamp = now;
  } else {
    session.status = 'done';
  }

  session.events.push({ type: type || 'done', timestamp: now });
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.shift();
  }

  emit('session:update', sessionDelta(session));
  return session;
}

export function getAllSessions() {
  return Object.fromEntries(sessions);
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function loadSessions() {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
      const now = Date.now();
      const entries = raw.sessions || {};
      for (const [id, session] of Object.entries(entries)) {
        if (now - session.lastActivity < REMOVE_MS) {
          sessions.set(id, session);
        }
      }
    }
  } catch(e) {}
}

export function saveSessions() {
  try {
    const tmp = SESSIONS_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify({ sessions: Object.fromEntries(sessions), savedAt: Date.now() }, null, 2));
    renameSync(tmp, SESSIONS_FILE);
  } catch(e) {}
}

// Combined persist + TTL sweep
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const elapsed = now - session.lastActivity;
    if (elapsed > REMOVE_MS) {
      sessions.delete(id);
      emit('session:remove', { sessionId: id });
    } else if (elapsed > STALE_MS && session.status !== 'stale') {
      session.status = 'stale';
      emit('session:update', sessionDelta(session));
    }
  }
  saveSessions();
}, CLEANUP_INTERVAL_MS);

// Graceful shutdown — save but do NOT call process.exit
function onShutdown() { saveSessions(); }
process.on('SIGTERM', onShutdown);
process.on('SIGINT', onShutdown);
