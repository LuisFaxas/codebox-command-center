/* SSE connection with auto-reconnect */

import { updateSession, removeSession, setConnected, setConfig, dispatch } from '#state';

function connectSSE() {
  const es = new EventSource('/events');

  es.addEventListener('session:update', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateSession(data);
    } catch (err) { /* ignore parse errors */ }
  });

  es.addEventListener('session:remove', (e) => {
    try {
      const data = JSON.parse(e.data);
      removeSession(data.sessionId);
    } catch (err) { /* ignore parse errors */ }
  });

  es.addEventListener('trigger', (e) => {
    try {
      const data = JSON.parse(e.data);
      dispatch('trigger', data);
    } catch (err) { /* ignore parse errors */ }
  });

  es.addEventListener('config:updated', (e) => {
    try {
      const data = JSON.parse(e.data);
      setConfig(data);
    } catch (err) { /* ignore parse errors */ }
  });

  es.addEventListener('open', () => {
    setConnected(true);
    const dot = document.querySelector('.connection-dot');
    const label = document.querySelector('.connection-label');
    if (dot) dot.classList.add('connected');
    if (label) label.textContent = 'Connected';
  });

  es.addEventListener('error', () => {
    setConnected(false);
    const dot = document.querySelector('.connection-dot');
    const label = document.querySelector('.connection-label');
    if (dot) dot.classList.remove('connected');
    if (label) label.textContent = 'Reconnecting...';
  });

  return es;
}

export { connectSSE };
