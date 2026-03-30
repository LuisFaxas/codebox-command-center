/* Shared utility functions */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(ms) {
  const elapsed = Math.floor((Date.now() - ms) / 1000);
  if (elapsed < 60) return '< 1m';
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return mins + 'm';
  const hours = Math.floor(mins / 60);
  return hours + 'h ' + (mins % 60) + 'm';
}

function formatRelativeTime(timestamp) {
  const elapsed = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsed < 5) return 'just now';
  if (elapsed < 60) return elapsed + 's ago';
  if (elapsed < 3600) return Math.floor(elapsed / 60) + 'm ago';
  return Math.floor(elapsed / 3600) + 'h ago';
}

function statusColor(status) {
  switch (status) {
    case 'done': return '--status-done';
    case 'attention': return '--status-attention';
    case 'stale': return '--status-stale';
    case 'working': return '--status-working';
    case 'error': return '--status-error';
    default: return '--status-stale';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'done': return 'DONE';
    case 'attention': return 'ATTENTION';
    case 'stale': return 'STALE';
    case 'working': return 'WORKING';
    case 'error': return 'ERROR';
    default: return 'UNKNOWN';
  }
}

export { escapeHtml, formatDuration, formatRelativeTime, statusColor, statusLabel };
