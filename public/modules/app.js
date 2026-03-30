/* Entry point — bootstraps all modules */

import { connectSSE } from '#sse';
import { subscribe, updateSession, setConfig } from '#state';
import { initSessions } from '#sessions';
import { initConversation } from '#conversation';
import { initSidebar } from '#sidebar';
import { initToasts } from '#toasts';
import { initAudio } from '#audio';
import { initParticles } from './particles.js';

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

  // Initialize UI modules
  initSessions();
  initConversation();
  initSidebar();
  initToasts();
  initAudio();

  // Start SSE connection
  connectSSE();

  // Particle background behind the main content area
  const mainArea = document.querySelector('.command-center');
  if (mainArea) {
    initParticles(mainArea, {
      count: 200,
      spread: 10,
      speed: 0.04,
      baseSize: 100,
      sizeRandomness: 1,
      cameraDistance: 20,
      moveOnHover: true,
      hoverFactor: 0.4
    });
  }

  // Sidebar toggle — collapse/expand, nav buttons handle expand-to-section
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    // Restore persisted state
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }

    sidebarToggle.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.contains('collapsed');
      if (isCollapsed) {
        sidebar.classList.remove('collapsed');
      } else {
        sidebar.classList.add('collapsed');
      }
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
