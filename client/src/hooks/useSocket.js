import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAuth } from '../modules/auth/authSlice';
import { getSocket, disconnectSocket } from '../services/socket';
import { setStatus, setWorkerLocation, setWorkerInfo, clearActiveOrder } from '../modules/order/orderSlice';
import toast from 'react-hot-toast';

/**
 * Subscribes to an order's live updates.
 * Order events flow: backend pub/sub → socket server → `order:<id>` room → this hook.
 */
export function useOrderSocket(orderId, callbacks = {}) {
  const dispatch = useDispatch();
  const { accessToken: token } = useSelector(selectAuth);

  useEffect(() => {
    if (!orderId || !token) return;
    const socket = getSocket(token);

    const handleConnect = () => socket.emit('order:subscribe', { orderId });

    if (socket.connected) handleConnect();
    else socket.once('connect', handleConnect);

    const onStatus = (p) => {
      dispatch(setStatus({ status: p.status, at: p.at }));
      toast(statusToMessage(p.status));
    };
    const onAssigned = (p) => {
      dispatch(setStatus({ status: 'assigned' }));
      dispatch(setWorkerInfo({ workerId: p.workerId }));
      toast.success('Worker assigned');
    };
    const onLocation = (p) => dispatch(setWorkerLocation(p));
    const onFailed = (p) => {
      toast.error(`No workers available: ${p.reason}`);
      dispatch(clearActiveOrder());
    };
    const onCancelled = () => {
      toast('Order cancelled');
      dispatch(clearActiveOrder());
    };
    const onChat = (msg) => {
      if (callbacks.onChatMessage) callbacks.onChatMessage(msg);
    };

    socket.on('order.status', onStatus);
    socket.on('order.assigned', onAssigned);
    socket.on('worker.location', onLocation);
    socket.on('order.failed', onFailed);
    socket.on('order.cancelled', onCancelled);
    socket.on('chat.message', onChat);

    return () => {
      socket.emit('order:unsubscribe', { orderId });
      socket.off('order.status', onStatus);
      socket.off('order.assigned', onAssigned);
      socket.off('worker.location', onLocation);
      socket.off('order.failed', onFailed);
      socket.off('order.cancelled', onCancelled);
      socket.off('chat.message', onChat);
    };
  }, [orderId, token, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Worker side — listens for incoming offers.
 */
export function useWorkerOfferSocket(onOffer) {
  const { accessToken: token } = useSelector(selectAuth);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const handler = (offer) => onOffer(offer);
    socket.on('offer.new', handler);

    return () => {
      socket.off('offer.new', handler);
    };
  }, [token, onOffer]);
}

export function useDisconnectOnLogout() {
  const { accessToken: token } = useSelector(selectAuth);
  useEffect(() => {
    if (!token) disconnectSocket();
  }, [token]);
}

function statusToMessage(s) {
  const map = {
    searching: '🔍 Finding a nearby worker…',
    assigned: '✅ Worker assigned',
    on_the_way: '🛵 Worker is on the way',
    arrived: '📍 Worker has arrived',
    in_progress: '🔧 Service started',
    completed: '🎉 Service completed',
  };
  return map[s] || `Status: ${s}`;
}
