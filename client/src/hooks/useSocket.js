import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAuth } from '../modules/auth/authSlice';
import { getSocket, disconnectSocket } from '../services/socket';
import {
  setStatus, setWorkerLocation, setWorkerInfo, clearActiveOrder, setEta, setDispatchMessage,
} from '../modules/order/orderSlice';
import toast from 'react-hot-toast';

const STATUS_MSG = {
  searching:   'Finding a nearby worker…',
  assigned:    'Worker assigned to your order',
  on_the_way:  'Worker is on the way',
  arrived:     'Worker has arrived',
  in_progress: 'Service in progress',
  completed:   'Service completed successfully',
};

/**
 * Subscribes to an order's live updates via socket.
 * Events flow: backend pub/sub → socket server → order:<id> room → here.
 */
export function useOrderSocket(orderId, callbacks = {}) {
  const dispatch = useDispatch();
  const { accessToken: token } = useSelector(selectAuth);

  useEffect(() => {
    if (!orderId || !token) return;
    const socket = getSocket(token);

    const subscribe = () => socket.emit('order:subscribe', { orderId });
    if (socket.connected) subscribe();
    else socket.once('connect', subscribe);

    const onStatus = (p) => {
      dispatch(setStatus({ status: p.status, at: p.at }));
      const msg = STATUS_MSG[p.status];
      if (msg) {
        p.status === 'completed'
          ? toast.success(msg)
          : toast(msg, { icon: null });
      }
    };

    const onAssigned = (p) => {
      dispatch(setStatus({ status: 'assigned' }));
      dispatch(setWorkerInfo({ workerId: p.workerId }));
      toast.success('Worker assigned to your order');
    };

    const onLocation = (p) => dispatch(setWorkerLocation(p));

    const onEta = (p) => {
      if (p?.etaMinutes != null) dispatch(setEta({ minutes: p.etaMinutes }));
    };

    const onFailed = (p) => {
      toast.error(p?.reason ? `No workers found: ${p.reason}` : 'No workers available right now');
      dispatch(clearActiveOrder());
    };

    const onCancelled = () => {
      toast('Order cancelled', { icon: null });
      dispatch(clearActiveOrder());
    };

    const onChat = (msg) => callbacks.onChatMessage?.(msg);

    const onDispatchUpdate = (p) => {
      if (p?.message) dispatch(setDispatchMessage({ message: p.message }));
    };

    socket.on('order.status',          onStatus);
    socket.on('order.assigned',        onAssigned);
    socket.on('worker.location',       onLocation);
    socket.on('eta.update',            onEta);
    socket.on('order.failed',          onFailed);
    socket.on('order.cancelled',       onCancelled);
    socket.on('chat.message',          onChat);
    socket.on('order.dispatch_update', onDispatchUpdate);

    return () => {
      socket.emit('order:unsubscribe', { orderId });
      socket.off('order.status',          onStatus);
      socket.off('order.assigned',        onAssigned);
      socket.off('worker.location',       onLocation);
      socket.off('eta.update',            onEta);
      socket.off('order.failed',          onFailed);
      socket.off('order.cancelled',       onCancelled);
      socket.off('chat.message',          onChat);
      socket.off('order.dispatch_update', onDispatchUpdate);
    };
  }, [orderId, token, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Worker side — listens for incoming job requests (broadcast model).
 * onOffer(offer)        — order broadcast received
 * onCancelled(p)        — order taken by another worker, dismiss popup
 * onForceAssigned(data) — force-assigned by system, navigate to job directly
 */
export function useWorkerOfferSocket(onOffer, onCancelled, onForceAssigned) {
  const { accessToken: token } = useSelector(selectAuth);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const offerHandler         = (offer) => onOffer(offer);
    const cancelledHandler     = (p)     => onCancelled?.(p);
    const forceAssignedHandler = (data)  => onForceAssigned?.(data);
    socket.on('new_job_request', offerHandler);
    socket.on('offer.cancelled', cancelledHandler);
    socket.on('job.assigned',    forceAssignedHandler);
    return () => {
      socket.off('new_job_request', offerHandler);
      socket.off('offer.cancelled', cancelledHandler);
      socket.off('job.assigned',    forceAssignedHandler);
    };
  }, [token, onOffer, onCancelled, onForceAssigned]);
}

export function useDisconnectOnLogout() {
  const { accessToken: token } = useSelector(selectAuth);
  useEffect(() => {
    if (!token) disconnectSocket();
  }, [token]);
}
