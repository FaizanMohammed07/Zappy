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

  // IMPORTANT: we do NOT register onBackgroundMessage here.
  // The server sends a `notification` payload, which the Firebase SDK renders
  // automatically (using webpush.notification: icon, badge, actions, image…).
  // If we ALSO called showNotification() here, every push would appear TWICE.
  // Display styling is therefore controlled server-side in webpush.notification.
  firebase.messaging();
}

// Activate the updated service worker immediately, replacing the old cached one
// (otherwise notification changes don't take effect until all tabs are closed).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
