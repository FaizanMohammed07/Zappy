import { io } from 'socket.io-client';

let socket = null;

export function getSocket(token) {
  if (socket && socket.active) return socket;
  if (socket) socket.disconnect();

  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
