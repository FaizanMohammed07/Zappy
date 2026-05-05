import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MessageCircle, Star, CheckCircle,
  Clock, MapPin, AlertCircle, Loader2, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { useGetOrderQuery, useCancelOrderMutation, useRateOrderMutation } from '../services/api';
import { useOrderSocket } from '../hooks/useSocket';
import { selectOrder, setActiveOrder } from '../modules/order/orderSlice';
import { selectAuth } from '../modules/auth/authSlice';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import PageTransition from '../components/common/PageTransition';
import MicroStatusPanel from '../components/tracking/MicroStatusPanel';
import SmartMatchSheet from '../components/tracking/SmartMatchSheet';
import ETABanner from '../components/tracking/ETABanner';
import QuickRebook from '../components/tracking/QuickRebook';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const STEPS = [
  { key: 'searching',   label: 'Finding a worker',    desc: 'Matching you with the best nearby worker' },
  { key: 'assigned',    label: 'Worker assigned',     desc: 'A worker has accepted your request' },
  { key: 'on_the_way',  label: 'Worker on the way',   desc: 'Your worker is heading to your location' },
  { key: 'arrived',     label: 'Worker arrived',      desc: 'Your worker has reached the location' },
  { key: 'in_progress', label: 'Service in progress', desc: 'Your service is currently being completed' },
  { key: 'completed',   label: 'Completed',           desc: 'Your service has been completed successfully' },
];

export default function OrderTrackingPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const { accessToken: token } = useSelector(selectAuth);
  const { data, isLoading, refetch } = useGetOrderQuery(id);
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [rateOrder] = useRateOrderMutation();
  const [showCancel, setShowCancel]         = useState(false);
  const [showMatchSheet, setShowMatchSheet] = useState(false);
  const matchShownRef = useRef(false);
  const liveOrder = useSelector(selectOrder);

  const order = data?.order;

  useEffect(() => {
    if (order) dispatch(setActiveOrder({ orderId: order._id, status: order.status }));
  }, [order?._id, dispatch]); // eslint-disable-line

  useOrderSocket(order?._id);

  const status = liveOrder.activeOrderId === order?._id
    ? liveOrder.status || order?.status
    : order?.status;

  /* Show SmartMatchSheet exactly once when worker first assigned */
  useEffect(() => {
    if (
      status === 'assigned' &&
      order?.workerId &&
      !matchShownRef.current
    ) {
      matchShownRef.current = true;
      setShowMatchSheet(true);
    }
  }, [status, order?.workerId]);

  const activeStepIdx = STEPS.findIndex((s) => s.key === status);

  const pickup = useMemo(() => {
    if (!order?.pickupLocation?.coordinates) return null;
    const [lng, lat] = order.pickupLocation.coordinates;
    return { lat, lng };
  }, [order]);

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-zappy-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading order…</p>
        </div>
      </div>
    );
  }

  const terminal  = ['completed', 'cancelled', 'failed'].includes(status);
  const canCancel = !terminal && !['arrived', 'in_progress'].includes(status);

  async function callWorker() {
    try {
      const res = await fetch(`/api/orders/${id}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const r = await res.json();
      if (r.proxyNumber) window.location.href = `tel:${r.proxyNumber}`;
      else toast.error('Call service unavailable');
    } catch {
      toast.error('Could not start call');
    }
  }

  async function onCancel() {
    try {
      await cancelOrder({ id, reason: 'user_cancelled' }).unwrap();
      toast.success('Order cancelled');
      setShowCancel(false);
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Could not cancel');
    }
  }

  const workerForSheet = order.workerId
    ? {
        name: order.workerName,
        rating: order.workerRating,
        completedJobs: order.workerJobs,
        etaMinutes: liveOrder.etaMinutes,
      }
    : null;

  return (
    <PageTransition>
    <div className="min-h-screen bg-[#F9FAFB] pb-28">

      {/* Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <motion.button onClick={() => nav('/')} className="back-btn" whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="t-label">Order tracking</p>
            <p className="font-semibold text-[#0F172A] capitalize">{order.service.replace(/_/g, ' ')}</p>
          </div>
          <div className="text-right">
            <p className="t-label">Total</p>
            <p className="font-bold text-[#0F172A]">₹{order.pricing?.total}</p>
          </div>
        </div>
      </header>

      {/* ETA Banner — sits just below header, outside scroll */}
      <ETABanner etaMinutes={liveOrder.etaMinutes} status={status} />

      <motion.div
        className="page-container pt-4 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Searching — MicroStatusPanel replaces basic spinner */}
        <AnimatePresence>
          {status === 'searching' && (
            <motion.div
              key="micro-status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <MicroStatusPanel active liveMessage={liveOrder.dispatchMessage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Failed state */}
        {status === 'failed' && (
          <motion.div variants={fadeInUp} className="card bg-red-50 ring-1 ring-red-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-red-800 text-sm">No workers available</p>
                <p className="text-xs text-red-600 mt-0.5">
                  All nearby workers are busy. Try again in a few minutes.
                </p>
                <button
                  onClick={() => nav(`/book/${order.service}`)}
                  className="flex items-center gap-1.5 mt-3 text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition"
                >
                  <RefreshCw size={12} />
                  Try Again
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Worker card */}
        {order.workerId && !terminal && status !== 'searching' && (
          <motion.div className="card" variants={fadeInUp}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zappy-gradient flex items-center justify-center text-white font-bold text-base shrink-0">
                {(order.workerName || 'W').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#0F172A] truncate">{order.workerName || 'Your Worker'}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={9} strokeWidth={2.5} /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Star size={11} strokeWidth={2} className="text-amber-500 fill-amber-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {order.workerRating?.toFixed?.(1) || '4.8'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">{order.workerJobs || 0}+ jobs</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={callWorker}
                  className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"
                  aria-label="Call worker"
                >
                  <Phone size={16} strokeWidth={2} className="text-green-600" />
                </button>
                <button
                  onClick={() => nav(`/orders/${id}/chat`)}
                  className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"
                  aria-label="Chat"
                >
                  <MessageCircle size={16} strokeWidth={2} className="text-blue-600" />
                </button>
              </div>
            </div>

            {/* ETA row */}
            {['on_the_way', 'arrived'].includes(status) && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={13} strokeWidth={2} />
                  <span className="text-xs font-medium">
                    {status === 'arrived' ? 'Worker has arrived' : 'Estimated arrival'}
                  </span>
                </div>
                <span className="font-bold text-blue-600 text-sm">
                  {status === 'arrived'
                    ? 'At your location'
                    : liveOrder.etaMinutes != null
                    ? `${liveOrder.etaMinutes} min`
                    : 'Calculating…'}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Live map */}
        <motion.div variants={fadeInUp}>
          <LiveTrackingMap
            pickup={pickup}
            workerLocation={liveOrder.workerLocation}
            service={order.service}
            height="38vh"
          />
        </motion.div>

        {/* OTP card */}
        {['assigned', 'on_the_way', 'arrived'].includes(status) && order.otp && (
          <motion.div className="card bg-amber-50 ring-1 ring-amber-200" variants={fadeInUp}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} strokeWidth={2} className="text-amber-700" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Your Service OTP
              </p>
            </div>
            <div className="text-4xl font-extrabold tracking-[0.5em] text-amber-700 text-center py-2">
              {order.otp}
            </div>
            <p className="text-xs text-amber-600 text-center font-medium">
              Share this code with the worker to begin service
            </p>
          </motion.div>
        )}

        {/* Progress stepper */}
        <motion.div className="card" variants={fadeInUp}>
          <p className="font-semibold text-[#0F172A] text-sm mb-4">Order Progress</p>
          <div className="space-y-4">
            {STEPS.map((s, i) => {
              const done    = activeStepIdx > i;
              const current = activeStepIdx === i;
              const future  = activeStepIdx < i;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      done ? 'bg-green-500' : current ? 'bg-blue-600 shadow-soft' : 'bg-slate-100'
                    }`}>
                      {done ? (
                        <CheckCircle size={16} strokeWidth={2.5} className="text-white" />
                      ) : current ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse-slow" />
                      ) : (
                        <div className="w-2 h-2 bg-slate-300 rounded-full" />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-5 mt-1 ${done ? 'bg-green-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className={`pb-1 ${future ? 'opacity-40' : ''}`}>
                    <p className={`text-sm font-semibold leading-tight ${
                      current ? 'text-blue-700' : done ? 'text-[#0F172A]' : 'text-slate-400'
                    }`}>
                      {s.label}
                    </p>
                    {current && (
                      <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Service location */}
        <motion.div className="card" variants={fadeInUp}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <MapPin size={15} strokeWidth={2} className="text-slate-500" />
            </div>
            <div>
              <p className="t-label mb-1">Service Location</p>
              <p className="text-sm font-medium text-[#0F172A] leading-relaxed">
                {order.pickupLocation?.address}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick rebook — shown after completion */}
        {status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <QuickRebook
              service={order.service}
              workerName={order.workerName}
              workerRating={order.workerRating}
              lastTotal={order.pricing?.total}
            />
          </motion.div>
        )}

      </motion.div>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="page-container pt-3 pb-2 space-y-2">
          {status === 'completed' && !order.userRating && (
            <RatingPanel
              onRate={async (rating) => {
                try {
                  await rateOrder({ id, rating }).unwrap();
                  toast.success('Thanks for your feedback!');
                  refetch();
                } catch (err) {
                  toast.error(err.data?.error || 'Could not submit rating');
                }
              }}
            />
          )}
          {terminal && (
            <button onClick={() => nav('/')} className="btn-primary w-full">
              Back to Home
            </button>
          )}
          {canCancel && !showCancel && (
            <button onClick={() => setShowCancel(true)} className="btn-secondary w-full">
              <AlertCircle size={15} strokeWidth={2} />
              Cancel Order
            </button>
          )}
          {canCancel && showCancel && (
            <div className="bg-red-50 rounded-card p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">Cancel this order?</p>
              <p className="text-xs text-red-600">A cancellation fee may apply.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowCancel(false)} className="btn-secondary flex-1">Keep order</button>
                <button onClick={onCancel} disabled={cancelling} className="btn-danger flex-1">
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SmartMatchSheet — slides up once when worker assigned */}
      <AnimatePresence>
        {showMatchSheet && (
          <SmartMatchSheet
            worker={workerForSheet}
            onDismiss={() => setShowMatchSheet(false)}
          />
        )}
      </AnimatePresence>

    </div>
    </PageTransition>
  );
}

function RatingPanel({ onRate }) {
  const [value, setValue] = useState(0);
  return (
    <div className="bg-white rounded-card border border-slate-100 p-4 space-y-3">
      <p className="text-sm font-bold text-[#0F172A] text-center">Rate your experience</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setValue(n)} className="p-1 transition-transform active:scale-90">
            <Star
              size={28}
              strokeWidth={1.5}
              className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
            />
          </button>
        ))}
      </div>
      <button onClick={() => onRate(value)} disabled={!value} className="btn-primary w-full">
        Submit Rating
      </button>
    </div>
  );
}
