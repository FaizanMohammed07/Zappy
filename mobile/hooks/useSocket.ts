import { useEffect } from 'react';
import { socketClient } from '../services/socket/socketClient';

export const useSocket = (roomId?: string) => {
  useEffect(() => {
    socketClient.connect();

    if (roomId) {
      // Subscribe to specific room if needed
      socketClient.emit('order:subscribe', { orderId: roomId });
    }

    return () => {
      if (roomId) {
        socketClient.emit('order:unsubscribe', { orderId: roomId });
      }
    };
  }, [roomId]);

  return socketClient;
};
