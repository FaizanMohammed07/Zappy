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

  // Background message handler — fires when app tab is not focused.
  // We send DATA-ONLY messages, so title/body live in payload.data and this
  // handler is the ONLY thing that renders a notification (no duplicates).
  messaging.onBackgroundMessage((payload) => {
    const data  = payload.data || {};
    const title = data.title || payload.notification?.title;
    const body  = data.body  || payload.notification?.body || '';
    if (!title) return;

    // Branded Zappy icon (the only icon asset that exists — see public/icons/).
    const icon = '/icons/zappy-icon.svg';
    const urgent = data.type === 'new_job_request' || data.type === 'sos';

    // Promotional pushes get a "Book Now" CTA; everything else "Open".
    const ctaLabel = data.type === 'promotional' ? 'Book Now' : 'Open';

    self.registration.showNotification(title, {
      body,
      icon,
      badge:    '/icons/zappy-icon.svg',
      image:    data.image || data.imageUrl || undefined, // big hero image when provided
      data:     { url: data.deepLink || '/', ...data },
      actions:  [
        { action: 'open',    title: ctaLabel },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      vibrate:  urgent ? [300, 120, 300, 120, 300] : [200, 100, 200],
      tag:      data.orderId || data.type || `zappy-${Date.now()}`,
      renotify: true,
      silent:   false,          // play the system notification sound
      requireInteraction: urgent, // job offers / SOS stay until acted on
      timestamp: Date.now(),
    });
  });
}

// Handle messages from the main thread (e.g. skipWaiting from build tooling).
// Returning true from a message handler tells Chrome to expect a sendResponse
// callback — if we don't call it, Chrome logs "message channel closed" errors.
// This listener handles known messages synchronously (no return value → no open channel).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

// Tap on background notification — navigate to deepLink
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return; // user tapped Dismiss — just close
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
