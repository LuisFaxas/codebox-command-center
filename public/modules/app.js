/* Entry point — bootstraps all modules */

import { connectSSE } from '#sse';
import { subscribe, updateSession, setConfig } from '#state';

document.addEventListener('DOMContentLoaded', async () => {
  // Load initial sessions
  try {
    const sessRes = await fetch('/sessions');
    const sessions = await sessRes.json();
    for (const [id, session] of Object.entries(sessions)) {
      updateSession(session);
    }
  } catch (e) { /* initial load failed, SSE will sync */ }

  // Load initial config
  try {
    const cfgRes = await fetch('/config');
    const config = await cfgRes.json();
    setConfig(config);
  } catch (e) { /* config load failed, SSE will sync */ }

  // Start SSE connection
  connectSSE();

  // Sidebar toggle
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    // Restore persisted state
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }

    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
  }

  // Update connection dot on state change
  subscribe('connection:change', ({ connected }) => {
    const dot = document.querySelector('.connection-dot');
    const label = document.querySelector('.connection-label');
    if (dot) dot.classList.toggle('connected', connected);
    if (label) label.textContent = connected ? 'Connected' : 'Reconnecting...';
  });

  console.log('Command Center initialized');
});
