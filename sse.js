const clients = new Set();
const buffer = [];
const BUFFER_SIZE = 100;
let eventId = 0;

function formatSSE(event) {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function emit(eventType, data) {
  eventId++;
  const event = { id: eventId, type: eventType, data, timestamp: Date.now() };
  buffer.push(event);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
  const formatted = formatSSE(event);
  for (const client of clients) {
    client.write(formatted);
  }
}

export function addClient(req, res, lastEventId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (lastEventId) {
    const lastId = Number(lastEventId);
    const replayIndex = buffer.findIndex(e => e.id > lastId);
    if (replayIndex !== -1) {
      for (let i = replayIndex; i < buffer.length; i++) {
        res.write(formatSSE(buffer[i]));
      }
    }
  }

  clients.add(res);
  req.on('close', () => clients.delete(res));
}

export function getClientCount() {
  return clients.size;
}

// Keepalive: send SSE comment every 15 seconds to keep connections alive through proxies
setInterval(() => {
  for (const client of clients) {
    client.write(': keepalive\n\n');
  }
}, 15000);
