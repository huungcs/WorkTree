// OneSignal Service Worker for WorkTree X PWA Push Notifications
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const urlToOpen = data.url || (data.taskId ? `/index.html?task=${data.taskId}` : '/index.html');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('index.html') && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data
          });
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_TEST_NOTIFICATION') {
    const title = event.data.title || '🔔 WorkTree X - Thử nghiệm thông báo';
    const options = {
      body: event.data.body || 'Điện thoại của bạn đã kết nối thành công với hệ thống chuông & thông báo WorkTree X!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'test-push-' + Date.now(),
      data: { url: '/index.html' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

