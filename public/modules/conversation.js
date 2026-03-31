/* Conversation panel with message rendering and response input */

import { subscribe, state, getSession, dispatch, getAllSessions } from '#state';
import { fetchMessages, sendSdkResponse, matchSdkSession, dismissSessionApi } from '#sdk';
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

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for HTTP context
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function renderPanelStructure() {
  if (!panel) return;

  panel.innerHTML = `
    <div class="conversation-header">
      <div class="conversation-title">
        <span class="project-name"></span>
        <span class="status-badge"></span>
      </div>
      <div class="conversation-toolbar">
        <button class="toolbar-btn copy-question-btn" title="Copy question text" style="display:none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy Question
        </button>
        <button class="toolbar-btn copy-path-btn" title="Copy session path">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          Copy Path
        </button>
        <button class="toolbar-btn dismiss-btn" title="Dismiss session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Dismiss
        </button>
      </div>
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

  // Toolbar: Copy Question
  const copyQuestionBtn = panel.querySelector('.copy-question-btn');
  copyQuestionBtn.addEventListener('click', () => {
    const session = getSession(state.selectedSessionId);
    if (session && session.questionText) {
      copyToClipboard(session.questionText).then(() => {
        dispatch('toast', { type: 'done', message: 'Question copied' });
      });
    }
  });

  // Toolbar: Copy Path
  const copyPathBtn = panel.querySelector('.copy-path-btn');
  copyPathBtn.addEventListener('click', () => {
    const session = getSession(state.selectedSessionId);
    if (session && session.cwd) {
      copyToClipboard(session.cwd).then(() => {
        dispatch('toast', { type: 'done', message: 'Path copied' });
      });
    }
  });

  // Toolbar: Dismiss
  const dismissBtn = panel.querySelector('.dismiss-btn');
  dismissBtn.addEventListener('click', () => {
    if (state.selectedSessionId) {
      const session = getSession(state.selectedSessionId);
      const name = session?.project || state.selectedSessionId;
      if (confirm(`Dismiss session "${name}"? This removes it from the dashboard.`)) {
        dismissSessionApi(state.selectedSessionId);
        renderEmptyState('no-selection');
      }
    }
  });

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
  // Show/hide Copy Question button based on question text availability
  const copyQuestionBtn = headerEl.querySelector('.copy-question-btn');
  if (copyQuestionBtn) {
    copyQuestionBtn.style.display = (session.status === 'attention' && session.questionText) ? '' : 'none';
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
  sendBtn.textContent = 'Sending...';
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
  sendBtn.innerHTML = ARROW_ICON;
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

  // Show loading state
  userScrolled = false;
  if (messagesEl) {
    messagesEl.innerHTML = `<div class="empty-state"><p>Loading conversation...</p></div>`;
  }

  // Determine SDK session ID for fetching messages
  let sdkId = session.sdkSessionId || null;

  if (!sdkId && session.cwd) {
    // Try matching by cwd
    const match = await matchSdkSession(session.cwd);
    if (match && match.sessionId) {
      sdkId = match.sessionId;
    }
  }

  if (!sdkId) {
    // No SDK session found — remote or just started
    if (messagesEl) {
      messagesEl.innerHTML = `
        <div class="empty-state">
          <h3>No Conversation Available</h3>
          <p>This session may be remote or just started. Conversation history will appear once an SDK session is matched.</p>
        </div>
      `;
    }
    return;
  }

  // Load messages from SDK
  const messages = await fetchMessages(sdkId, 20, 0);

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
