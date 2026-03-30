/* Fetch wrapper for /sdk/* proxy endpoints */

async function fetchSdkSessions() {
  try {
    const res = await fetch('/sdk/sessions');
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function fetchMessages(sessionId, limit = 20, offset = 0) {
  try {
    const res = await fetch(`/sdk/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function sendSdkResponse(sessionId, text) {
  try {
    const res = await fetch(`/sdk/sessions/${sessionId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: 'Network error' };
  }
}

export { fetchSdkSessions, fetchMessages, sendSdkResponse };
