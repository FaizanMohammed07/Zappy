import { io } from 'socket.io-client';

// In dev Vite proxies /socket.io → backend:4000, but WebSocket upgrades can
// fail on some systems. Use polling first then upgrade to WS automatically.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket = null;

export function getSocket(token) {
  // Never connect without a valid token — server will reject it and log
  // "No auth token found" which is noisy and misleading in the console.
  if (!token) {
    if (import.meta.env.DEV) console.warn('[Socket] getSocket called without token — skipping');
    return { connected: false, emit: () => {}, on: () => {}, once: () => {}, off: () => {} };
  }

  // Reuse existing connected socket if it has the same token
  if (socket && socket.active && socket._authToken === token) return socket;

  // Disconnect stale socket (different token = re-login)
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  // Tag the socket so we can detect token changes
  socket._authToken = token;

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
