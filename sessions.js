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

// Debounce timers for tool SSE emissions (max 1 per second per session)
const toolDebounceTimers = new Map();
const TOOL_DEBOUNCE_MS = 1000;

export function upsertSession({ sessionId, project, machine, cwd, type, questionText, toolName, toolTarget, source, sdkSessionId }) {
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
      currentTool: null,
      currentTarget: null,
      source: null,
      sdkSessionId: null,
      dismissed: false,
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
    session.currentTool = null;
    session.currentTarget = null;
  } else if (type === 'tool') {
    session.status = 'working';
    session.currentTool = toolName || null;
    session.currentTarget = toolTarget || null;
  } else if (type === 'session-start') {
    session.status = 'working';
    session.source = source || 'startup';
    session.sdkSessionId = sdkSessionId || sessionId;
  } else {
    // done
    session.status = 'done';
    session.currentTool = null;
    session.currentTarget = null;
  }

  session.events.push({ type: type || 'done', timestamp: now });
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.shift();
  }

  // Clear tool debounce on non-tool events so they emit immediately
  if (type !== 'tool') {
    const timer = toolDebounceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      toolDebounceTimers.delete(sessionId);
    }
  }

  emit('session:update', sessionDelta(session));
  return session;
}

export function handleToolUpdate(sessionId, toolName, toolTarget) {
  const now = Date.now();
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      project: '',
      machine: '',
      cwd: '',
      status: 'working',
      firstSeen: now,
      lastActivity: now,
      lastEventType: 'tool',
      eventCount: 0,
      events: [],
      questionText: null,
      questionTimestamp: null,
      currentTool: null,
      currentTarget: null,
      source: null,
      sdkSessionId: null,
      dismissed: false,
    };
    sessions.set(sessionId, session);
  }

  session.currentTool = toolName || null;
  session.currentTarget = toolTarget || null;
  session.lastActivity = now;
  session.lastEventType = 'tool';
  session.status = 'working';
  session.eventCount++;

  session.events.push({ type: 'tool', timestamp: now });
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.shift();
  }

  // Debounce SSE emission: max 1 per second per session
  if (!toolDebounceTimers.has(sessionId)) {
    emit('session:update', sessionDelta(session));
    toolDebounceTimers.set(sessionId, setTimeout(() => {
      toolDebounceTimers.delete(sessionId);
    }, TOOL_DEBOUNCE_MS));
  } else {
    // A timer is pending — schedule one final emission when it expires
    clearTimeout(toolDebounceTimers.get(sessionId));
    toolDebounceTimers.set(sessionId, setTimeout(() => {
      toolDebounceTimers.delete(sessionId);
      const s = sessions.get(sessionId);
      if (s) emit('session:update', sessionDelta(s));
    }, TOOL_DEBOUNCE_MS));
  }

  return session;
}

export function dismissSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.dismissed = true;
  }
  sessions.delete(sessionId);
  emit('session:remove', { sessionId });
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
