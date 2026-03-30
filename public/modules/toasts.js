/* Toast notification system
   Creates .toast elements inside #toast-container for Playwright compatibility */

import { subscribe } from '#state';
import { escapeHtml } from '#utils';

const MAX_TOASTS = 5;
const DONE_TIMEOUT = 8000;
const QUESTION_TIMEOUT = 15000;

let container = null;

function initToasts() {
  container = document.getElementById('toast-container');
  subscribe('trigger', (data) => {
    showToast(data.type, data.project);
  });
}

function showToast(type, project) {
  if (!container) return;

  // Enforce max 5 toasts
  while (container.children.length >= MAX_TOASTS) {
    container.removeChild(container.firstElementChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'done'
    ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 8 14 16 6"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="7" x2="10" y2="11"/><circle cx="10" cy="14" r="0.5" fill="#f59e0b"/></svg>';

  const message = type === 'done'
    ? `"${escapeHtml(project)}" is done`
    : `"${escapeHtml(project)}" needs attention`;

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      ${icon}
      <span style="font-size:14px;color:var(--text-primary)">${message}</span>
    </div>
  `;

  // Click to dismiss
  toast.addEventListener('click', () => dismissToast(toast));

  container.appendChild(toast);

  // Auto-dismiss
  const timeout = type === 'question' ? QUESTION_TIMEOUT : DONE_TIMEOUT;
  setTimeout(() => dismissToast(toast), timeout);
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('dismissing');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 200);
}

export { initToasts, showToast };
