// Firebase Messaging Service Worker
// ─────────────────────────────────────────────────────────────────────────────
// Firebase config is injected via URL query string at registration time so we
// don't hardcode credentials in a public file.
//
// Registration in useFCM.js:
//   navigator.serviceWorker.register(
//     `/firebase-messaging-sw.js?apiKey=...&projectId=...&...`
//   )
//
// Fallback: reads from meta tag or uses bundled defaults if query string absent.
// ─────────────────────────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Parse config from registration URL query string
function getConfig() {
  const params = new URLSearchParams(self.location.search);
  return {
    apiKey:            params.get('apiKey'),
    authDomain:        params.get('authDomain'),
    projectId:         params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId:             params.get('appId'),
  };
}

const cfg = getConfig();

// Only initialise if we have the minimum required fields
if (cfg.apiKey && cfg.projectId && cfg.messagingSenderId) {
  firebase.initializeApp(cfg);

  const messaging = firebase.messaging();

  // Background message handler — fires when app tab is not focused
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    if (!title) return;

    // Pick icon based on notification type
    const iconMap = {
      new_job_request:  '/icons/job-icon.png',
      worker_assigned:  '/icons/worker-icon.png',
      order_completed:  '/icons/success-icon.png',
      sos:              '/icons/sos-icon.png',
    };
    const icon = iconMap[data.type] || '/icons/icon-192.png';

    self.registration.showNotification(title, {
      body:     body || '',
      icon,
      badge:    '/icons/badge-72.png',
      data:     { url: data.deepLink || '/', ...data },
      actions:  [{ action: 'open', title: 'Open' }],
      vibrate:  [200, 100, 200],
      tag:      data.orderId || data.type || 'zappy',
      renotify: true,
      requireInteraction: data.type === 'new_job_request', // job offers stay until dismissed
    });
  });
}

// Tap on background notification — navigate to deepLink
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
