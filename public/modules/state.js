/* Shared reactive state store with pub/sub */

const state = {
  sessions: new Map(),
  selectedSessionId: null,
  config: { done: {}, question: {} },
  connected: false
};

const listeners = new Map();

function subscribe(event, callback) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(callback);
}

function dispatch(event, data) {
  const cbs = listeners.get(event);
  if (cbs) cbs.forEach(cb => cb(data));
}

function updateSession(sessionData) {
  state.sessions.set(sessionData.sessionId, sessionData);
  dispatch('session:update', sessionData);
}

function removeSession(sessionId) {
  state.sessions.delete(sessionId);
  dispatch('session:remove', { sessionId });
  if (state.selectedSessionId === sessionId) {
    state.selectedSessionId = null;
    dispatch('session:select', { sessionId: null });
  }
}

function setSelectedSession(sessionId) {
  state.selectedSessionId = sessionId;
  dispatch('session:select', { sessionId });
}

function setConnected(bool) {
  state.connected = bool;
  dispatch('connection:change', { connected: bool });
}

function setConfig(configObj) {
  state.config = configObj;
  dispatch('config:update', configObj);
}

function getSession(id) {
  return state.sessions.get(id);
}

function getAllSessions() {
  return Array.from(state.sessions.values());
}

export {
  state,
  subscribe,
  dispatch,
  updateSession,
  removeSession,
  setSelectedSession,
  setConnected,
  setConfig,
  getSession,
  getAllSessions
};
