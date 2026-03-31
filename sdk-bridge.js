import { listSessions, getSessionMessages, unstable_v2_resumeSession } from '@anthropic-ai/claude-agent-sdk';

export function extractTextContent(message) {
  if (!message || !message.content) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
  return '';
}

export async function getSdkSessions() {
  try {
    const sessions = await listSessions({ limit: 50 });
    return sessions.map(s => ({
      sessionId: s.sessionId,
      summary: s.summary,
      lastModified: s.lastModified,
      cwd: s.cwd,
      firstPrompt: s.firstPrompt,
      tag: s.tag,
      createdAt: s.createdAt,
    }));
  } catch (e) {
    return [];
  }
}

export async function getSdkMessages(sessionId, limit = 20, offset = 0) {
  try {
    const messages = await getSessionMessages(sessionId, { limit, offset });
    return messages.map(m => ({
      type: m.type,
      uuid: m.uuid,
      sessionId: m.session_id,
      content: extractTextContent(m.message),
    }));
  } catch (e) {
    return [];
  }
}

export async function findSdkSessionForCwd(targetCwd) {
  try {
    const sessions = await listSessions({ limit: 50 });
    const match = sessions
      .filter(s => s.cwd === targetCwd)
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    return match[0] || null;
  } catch (e) {
    return null;
  }
}

export async function sendResponse(sessionId, text) {
  let session;
  try {
    session = unstable_v2_resumeSession(sessionId, {
      model: 'claude-sonnet-4-20250514',
    });
    await session.send(text);
    const messages = [];
    for await (const msg of session.stream()) {
      if (msg.type === 'assistant') {
        const textContent = msg.message.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('');
        messages.push(textContent);
      }
    }
    return { ok: true, response: messages.join('\n') };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (session) {
      try { session.close(); } catch (e) {}
    }
  }
}
