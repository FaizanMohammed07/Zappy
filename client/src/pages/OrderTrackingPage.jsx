import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, MessageCircle, Star, CheckCircle,
  Clock, MapPin, AlertCircle, Loader2, ShieldCheck,
} from 'lucide-react';
import { useGetOrderQuery, useCancelOrderMutation, useRateOrderMutation } from '../services/api';
import { useOrderSocket } from '../hooks/useSocket';
import { selectOrder, setActiveOrder } from '../modules/order/orderSlice';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import PageTransition from '../components/common/PageTransition';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const STEPS = [
  { key: 'searching',   label: 'Finding a worker',    desc: 'We are matching you with the best nearby worker' },
  { key: 'assigned',    label: 'Worker assigned',     desc: 'A worker has accepted your request' },
  { key: 'on_the_way',  label: 'Worker on the way',   desc: 'Your worker is heading to your location' },
  { key: 'arrived',     label: 'Worker arrived',      desc: 'Your worker has reached the location' },
  { key: 'in_progress', label: 'Service in progress', desc: 'Your service is currently being completed' },
  { key: 'completed',   label: 'Completed',           desc: 'Your service has been completed' },
];

export default function OrderTrackingPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const { data, isLoading, refetch } = useGetOrderQuery(id);
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [rateOrder] = useRateOrderMutation();
  const [showCancel, setShowCancel] = useState(false);
  const liveOrder = useSelector(selectOrder);

  const order = data?.order;

  useEffect(() => {
    if (order) dispatch(setActiveOrder({ orderId: order._id, status: order.status }));
  }, [order?._id, dispatch]); // eslint-disable-line

  useOrderSocket(order?._id);

  const status = liveOrder.activeOrderId === order?._id
    ? liveOrder.status || order?.status
    : order?.status;

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

  const terminal = ['completed', 'cancelled', 'failed'].includes(status);
  const canCancel = !terminal && !['arrived', 'in_progress'].includes(status);

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

  async function callWorker() {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/orders/${id}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then((x) => x.json());
      if (r.proxyNumber) window.location.href = `tel:${r.proxyNumber}`;
    } catch {
      toast.error('Could not start call');
    }
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <motion.button
            onClick={() => nav('/')}
            className="back-btn"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
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

      <motion.div
        className="page-container pt-4 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Worker card */}
        {order.workerId && !terminal && (
          <motion.div className="card" variants={fadeInUp}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zappy-gradient flex items-center justify-center text-white font-bold text-base shrink-0">
                {(order.workerName || 'W').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#0F172A] truncate">{order.workerName || 'Your Worker'}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={9} strokeWidth={2.5} />
                    Verified
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
                <button onClick={callWorker} className="btn-icon bg-success-50" aria-label="Call worker">
                  <Phone size={16} strokeWidth={2} className="text-success-600" />
                </button>
                <button onClick={() => nav(`/orders/${id}/chat`)} className="btn-icon bg-zappy-50" aria-label="Chat">
                  <MessageCircle size={16} strokeWidth={2} className="text-zappy-600" />
                </button>
              </div>
            </div>

            {['on_the_way', 'arrived'].includes(status) && liveOrder.etaMinutes != null && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={13} strokeWidth={2} />
                  <span className="text-xs font-medium">
                    {status === 'arrived' ? 'Worker has arrived' : 'Estimated arrival'}
                  </span>
                </div>
                <span className="font-bold text-zappy-600 text-sm">
                  {status === 'arrived' ? 'At your location' : `${liveOrder.etaMinutes} min`}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Map */}
        <motion.div variants={fadeInUp}>
          <LiveTrackingMap pickup={pickup} workerLocation={liveOrder.workerLocation} height="38vh" />
        </motion.div>

        {/* OTP card */}
        {['assigned', 'on_the_way', 'arrived'].includes(status) && order.otp && (
          <motion.div className="card bg-amber-50 ring-1 ring-amber-200" variants={fadeInUp}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} strokeWidth={2} className="text-amber-700" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Your Service OTP</p>
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
              const done = activeStepIdx > i;
              const current = activeStepIdx === i;
              const upcoming = activeStepIdx < i;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      done ? 'bg-success-500' : current ? 'bg-zappy-600 shadow-soft' : 'bg-slate-100'
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
                      <div className={`w-0.5 h-5 mt-1 ${done ? 'bg-success-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className={`pb-1 ${upcoming ? 'opacity-40' : ''}`}>
                    <p className={`text-sm font-semibold leading-tight ${
                      current ? 'text-zappy-700' : done ? 'text-[#0F172A]' : 'text-slate-400'
                    }`}>{s.label}</p>
                    {current && (
                      <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Location card */}
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
      </motion.div>

      {/* Action bar */}
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
            <button
              onClick={() => setShowCancel(true)}
              className="btn-secondary w-full"
            >
              <AlertCircle size={15} strokeWidth={2} />
              Cancel Order
            </button>
          )}
          {canCancel && showCancel && (
            <div className="bg-red-50 rounded-card p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">Cancel this order?</p>
              <p className="text-xs text-red-600">This action cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowCancel(false)} className="btn-secondary flex-1">
                  Keep order
                </button>
                <button onClick={onCancel} disabled={cancelling} className="btn-danger flex-1">
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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
