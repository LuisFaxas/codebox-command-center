/* Session card rendering and grid management */

import { subscribe, setSelectedSession, state, getSession } from '#state';
import { escapeHtml, formatRelativeTime, statusLabel } from '#utils';

const DEVICE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="9" rx="1.5"/><path d="M5 14h6M8 11v3"/></svg>';

let grid = null;
let durationInterval = null;

function getPreviewText(session) {
  if (session.status === 'attention' && session.questionText) {
    return escapeHtml(session.questionText);
  }
  switch (session.status) {
    case 'done': return 'Completed';
    case 'working': return 'Working...';
    case 'stale': return 'Inactive';
    default: return 'Working...';
  }
}

function renderCard(session) {
  if (!grid) return;

  let card = grid.querySelector(`[data-session-id="${session.sessionId}"]`);
  if (!card) {
    card = document.createElement('div');
    card.dataset.sessionId = session.sessionId;
    card.addEventListener('click', () => {
      setSelectedSession(session.sessionId);
    });
    grid.appendChild(card);
  }

  const isSelected = state.selectedSessionId === session.sessionId;
  const isAttention = session.status === 'attention';

  card.className = 'session-card';
  card.classList.add(isSelected ? 'glass-card' : 'glass-subtle');
  if (isSelected) card.classList.add('selected');
  if (isAttention) card.classList.add('attention');

  const durationText = session.status === 'stale'
    ? 'Inactive'
    : formatRelativeTime(session.lastActivity);

  const replyBtn = isAttention
    ? `<button class="session-reply-btn" data-reply="${session.sessionId}">Send Reply</button>`
    : '';

  card.innerHTML = `
    <div class="session-card-header">
      <h3 class="session-project">${escapeHtml(session.project || 'Unknown')}</h3>
      <span class="status-badge badge-${session.status}">${statusLabel(session.status)}</span>
    </div>
    <div class="session-machine">
      ${DEVICE_ICON}
      <span>${escapeHtml(session.machine || 'unknown')}</span>
    </div>
    <p class="session-preview">${getPreviewText(session)}</p>
    <div class="session-meta">
      <span class="session-duration" data-activity="${session.lastActivity}">${durationText}</span>
      ${replyBtn}
    </div>
  `;

  // Reply button click should also select the session
  const replyBtnEl = card.querySelector('[data-reply]');
  if (replyBtnEl) {
    replyBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedSession(session.sessionId);
    });
  }
}

function removeCard(sessionId) {
  if (!grid) return;
  const card = grid.querySelector(`[data-session-id="${sessionId}"]`);
  if (card) card.remove();
}

function updateSelectedState({ sessionId }) {
  if (!grid) return;
  const cards = grid.querySelectorAll('.session-card');
  cards.forEach(card => {
    const id = card.dataset.sessionId;
    const session = getSession(id);
    const isSelected = id === sessionId;
    const isAttention = session && session.status === 'attention';

    card.classList.remove('glass-subtle', 'glass-card', 'selected');
    card.classList.add(isSelected ? 'glass-card' : 'glass-subtle');
    if (isSelected) card.classList.add('selected');
    // Preserve attention class
    card.classList.toggle('attention', !!isAttention);
  });
}

function updateDurations() {
  if (!grid) return;
  const els = grid.querySelectorAll('.session-duration[data-activity]');
  els.forEach(el => {
    const session = getSession(el.closest('.session-card')?.dataset.sessionId);
    if (session && session.status !== 'stale') {
      el.textContent = formatRelativeTime(session.lastActivity);
    }
  });
}

function initSessions() {
  grid = document.getElementById('session-grid');
  if (!grid) return;

  subscribe('session:update', (sessionData) => {
    renderCard(sessionData);
  });

  subscribe('session:remove', ({ sessionId }) => {
    removeCard(sessionId);
  });

  subscribe('session:select', updateSelectedState);

  // Update duration displays every 60s
  durationInterval = setInterval(updateDurations, 60000);
}

export { initSessions };
