/* Entry point — bootstraps all modules */

import { connectSSE } from '#sse';
import { subscribe, updateSession, setConfig } from '#state';
import { initSidebar } from '#sidebar';
import { initToasts } from '#toasts';
import { initAudio } from '#audio';

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

  // Initialize modules that may be provided by parallel plans
  // Sessions and conversation modules loaded dynamically — may not exist yet
  try {
    const { initSessions } = await import('#sessions');
    initSessions();
  } catch (e) { /* sessions module not yet available */ }

  try {
    const { initConversation } = await import('#conversation');
    initConversation();
  } catch (e) { /* conversation module not yet available */ }

  // Initialize sidebar, toasts, audio
  initSidebar();
  initToasts();
  initAudio();

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
