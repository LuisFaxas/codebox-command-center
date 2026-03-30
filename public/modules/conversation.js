/* Conversation panel with message rendering and response input */

import { subscribe, state, getSession, dispatch, getAllSessions } from '#state';
import { fetchMessages, sendSdkResponse } from '#sdk';
import { escapeHtml, statusLabel } from '#utils';

const ARROW_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h12M11 5l4 4-4 4"/></svg>';

let panel = null;
let headerEl = null;
let messagesEl = null;
let inputContainer = null;
let inputEl = null;
let sendBtn = null;
let disclaimerEl = null;
let userScrolled = false;

function renderEmptyState(type) {
  if (!panel) return;

  panel.classList.remove('has-input');

  if (type === 'no-sessions') {
    panel.innerHTML = `
      <div class="empty-state">
        <h3>No Active Sessions</h3>
        <p>Sessions will appear here when Claude Code is running. Start a session in any project to see it on this dashboard.</p>
      </div>
    `;
  } else {
    panel.innerHTML = `
      <div class="empty-state">
        <h3>Select a Session</h3>
        <p>Click a session card above to view its conversation history.</p>
      </div>
    `;
  }

  headerEl = null;
  messagesEl = null;
  inputContainer = null;
  inputEl = null;
  sendBtn = null;
  disclaimerEl = null;
}

function renderErrorState() {
  if (!messagesEl) return;
  messagesEl.innerHTML = `
    <div class="empty-state">
      <h3>Error</h3>
      <p>Could not load conversation. The SDK connection may be down. Check the server logs and try again.</p>
    </div>
  `;
}

function renderPanelStructure() {
  if (!panel) return;

  panel.innerHTML = `
    <div class="conversation-header">
      <span class="project-name"></span>
      <span class="status-badge"></span>
    </div>
    <div class="message-list"></div>
    <div class="response-input-container">
      <textarea class="response-input" placeholder="Type your response..." rows="1"></textarea>
      <button class="response-send-btn">${ARROW_ICON}</button>
      <div class="sdk-disclaimer" style="color: var(--text-muted); font-size: 12px; width: 100%; text-align: center; display: none;">Response sent via SDK transcript (experimental)</div>
    </div>
  `;

  headerEl = panel.querySelector('.conversation-header');
  messagesEl = panel.querySelector('.message-list');
  inputContainer = panel.querySelector('.response-input-container');
  inputEl = panel.querySelector('.response-input');
  sendBtn = panel.querySelector('.response-send-btn');
  disclaimerEl = panel.querySelector('.sdk-disclaimer');

  // Track user scroll position
  messagesEl.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesEl;
    userScrolled = scrollTop < scrollHeight - clientHeight - 50;
  });

  // Enter to submit, Shift+Enter for newline
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', () => handleSend());
}

function updateHeader(session) {
  if (!headerEl) return;
  const nameEl = headerEl.querySelector('.project-name');
  const badgeEl = headerEl.querySelector('.status-badge');
  if (nameEl) nameEl.textContent = session.project || 'Unknown';
  if (badgeEl) {
    badgeEl.className = `status-badge badge-${session.status}`;
    badgeEl.textContent = statusLabel(session.status);
  }
}

function renderCodeBlocks(escaped) {
  // Split by triple backtick markers (already escaped)
  const parts = escaped.split(/```(?:\w*\n?)?/);
  if (parts.length === 1) return escaped;

  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      html += parts[i];
    } else {
      html += `<pre><code>${parts[i]}</code></pre>`;
    }
  }
  return html;
}

function renderMessages(messages) {
  if (!messagesEl) return;

  if (!messages || messages.length === 0) {
    messagesEl.innerHTML = `
      <div class="empty-state">
        <p>No messages in this conversation yet.</p>
      </div>
    `;
    return;
  }

  messagesEl.innerHTML = messages.map(msg => {
    const senderLabel = msg.type === 'user' ? 'You' : 'Claude';
    const typeClass = msg.type === 'user' ? 'user' : 'assistant';
    const escaped = escapeHtml(msg.content || '');
    const contentHtml = renderCodeBlocks(escaped);

    return `
      <div class="message-block ${typeClass}">
        <div class="message-sender">${senderLabel}</div>
        <div class="message-text">${contentHtml}</div>
      </div>
    `;
  }).join('');

  scrollToBottom();
}

function scrollToBottom() {
  if (!messagesEl || userScrolled) return;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(type, content) {
  if (!messagesEl) return;

  // Remove empty state if present
  const emptyState = messagesEl.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const senderLabel = type === 'user' ? 'You' : 'Claude';
  const escaped = escapeHtml(content);
  const contentHtml = renderCodeBlocks(escaped);

  const div = document.createElement('div');
  div.className = `message-block ${type}`;
  div.innerHTML = `
    <div class="message-sender">${senderLabel}</div>
    <div class="message-text">${contentHtml}</div>
  `;
  messagesEl.appendChild(div);

  userScrolled = false;
  scrollToBottom();
}

async function handleSend() {
  if (!inputEl || !state.selectedSessionId) return;
  const text = inputEl.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  const sessionId = state.selectedSessionId;

  const result = await sendSdkResponse(sessionId, text);

  if (result.ok) {
    inputEl.value = '';
    appendMessage('user', text);
    if (result.response) {
      appendMessage('assistant', result.response);
    }
    if (disclaimerEl) disclaimerEl.style.display = 'block';
  } else {
    dispatch('toast', {
      type: 'error',
      message: 'Response failed to send. The session may have ended. Check the terminal and try again.'
    });
  }

  sendBtn.disabled = false;
}

async function loadConversation(sessionId) {
  if (!sessionId) {
    const sessions = getAllSessions();
    renderEmptyState(sessions.length === 0 ? 'no-sessions' : 'no-selection');
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    renderEmptyState('no-selection');
    return;
  }

  // Ensure panel structure exists
  if (!messagesEl) {
    renderPanelStructure();
  }

  updateHeader(session);

  // Show/hide input based on attention status
  panel.classList.toggle('has-input', session.status === 'attention');
  if (disclaimerEl) disclaimerEl.style.display = 'none';

  // Load messages
  userScrolled = false;
  const messages = await fetchMessages(sessionId, 20, 0);

  if (messages === null || (Array.isArray(messages) && messages.length === 0 && !Array.isArray(messages))) {
    renderErrorState();
    return;
  }

  renderMessages(messages);
}

function initConversation() {
  panel = document.getElementById('conversation-panel');
  if (!panel) return;

  // Render initial empty state
  renderEmptyState('no-selection');

  // On session select, load conversation
  subscribe('session:select', async ({ sessionId }) => {
    await loadConversation(sessionId);
  });

  // Update input visibility when session status changes
  subscribe('session:update', (sessionData) => {
    if (state.selectedSessionId === sessionData.sessionId && headerEl) {
      updateHeader(sessionData);
      panel.classList.toggle('has-input', sessionData.status === 'attention');
    }
  });
}

export { initConversation };
