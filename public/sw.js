self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.type === 'question'
    ? 'Claude needs attention'
    : 'Claude is done';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.project ? `${data.project} — ${data.type}` : data.type,
      tag: `claude-${data.type}-${data.project}`,
      renotify: true,
      requireInteraction: data.type === 'question',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      if (windowClients.length > 0) {
        windowClients[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
