import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MessageCircle, Star, CheckCircle,
  Clock, MapPin, AlertCircle, Loader2, ShieldCheck, RefreshCw,
  Zap, X, ChevronRight, AlertTriangle, Wallet, HeadphonesIcon, FileText,
  Repeat2, Flame,
} from 'lucide-react';
import { useGetOrderQuery, useGetCancelPreviewQuery, useCancelOrderMutation, useRateOrderMutation, useGetPriceRevisionQuery, useSendTipMutation } from '../services/api';
import { useOrderSocket, useSocketStatus } from '../hooks/useSocket';
import { selectOrder, setActiveOrder } from '../modules/order/orderSlice';
import { selectAuth } from '../modules/auth/authSlice';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import PageTransition from '../components/common/PageTransition';
import MicroStatusPanel from '../components/tracking/MicroStatusPanel';
import TipCard from '../components/tracking/TipCard';
import PriceRevisionCard from '../components/tracking/PriceRevisionCard';
import WarrantyCard from '../components/tracking/WarrantyCard';
import SmartMatchSheet from '../components/tracking/SmartMatchSheet';
import ETABanner from '../components/tracking/ETABanner';
import QuickRebook from '../components/tracking/QuickRebook';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';
import CashbackCelebration from '../components/rewards/CashbackCelebration';
import { useGetWalletQuery } from '../services/api';

const CANCEL_REASONS = [
  { id: 'changed_mind',      label: 'Changed my mind' },
  { id: 'booked_mistake',    label: 'Booked by mistake' },
  { id: 'taking_too_long',   label: 'Worker is taking too long' },
  { id: 'found_alternative', label: 'Found another solution' },
  { id: 'price_too_high',    label: 'Price seems too high' },
  { id: 'emergency',         label: 'Personal emergency' },
  { id: 'other',             label: 'Other reason' },
];

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
  const { data, isLoading, refetch } = useGetOrderQuery(id, { pollingInterval: 10000 });
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [rateOrder] = useRateOrderMutation();
  const [sendTip] = useSendTipMutation();
  const [liveBoost, setLiveBoost]             = useState(0);
  const [showCancel, setShowCancel]           = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [showMatchSheet, setShowMatchSheet]   = useState(false);
  const [cashbackPop, setCashbackPop]         = useState(null); // { amountPaise }
  const completionShownRef = useRef(false);
  const matchShownRef = useRef(false);
  const liveOrder = useSelector(selectOrder);
  const { data: walletData } = useGetWalletQuery();

  // Fetch cancel fee preview whenever cancel sheet is open
  const { data: cancelPreview, isFetching: previewLoading } = useGetCancelPreviewQuery(id, {
    skip: !showCancel,
    refetchOnMountOrArgChange: true,
  });

  const order = data?.order;

  useEffect(() => {
    if (order) dispatch(setActiveOrder({ orderId: order._id, status: order.status }));
  }, [order?._id, dispatch]); // eslint-disable-line

  useOrderSocket(order?._id);
  const socketStatus = useSocketStatus();

  const status = liveOrder.activeOrderId === order?._id
    ? liveOrder.status || order?.status
    : order?.status;

  // Price revision — poll during in_progress / arrived (status is now defined)
  const { data: revisionData } = useGetPriceRevisionQuery(id, {
    skip: !['in_progress', 'arrived'].includes(status),
    pollingInterval: 5000,
  });
  const pendingRevision = revisionData?.revision;

  /* Show cashback celebration once when order first hits 'completed' */
  useEffect(() => {
    if (status === 'completed' && order?._id && !completionShownRef.current) {
      completionShownRef.current = true;
      // Small delay so the order UI settles first
      const t = setTimeout(() => {
        const total = order?.pricing?.total || 0;
        // Estimate cashback: 5% of order total (server decides exact amount,
        // but showing the approximation gives immediate delight)
        const estimated = Math.round(total * 5); // 5% in paise (total is in rupees)
        if (estimated >= 100) { // only show if ≥ ₹1
          setCashbackPop({ amountPaise: estimated });
        }
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [status, order?._id]); // eslint-disable-line

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

  const displayStatus = status === 'created' ? 'searching' : status;
  const activeStepIdx = STEPS.findIndex((s) => s.key === displayStatus);

  const pickup = useMemo(() => {
    if (!order?.pickupLocation?.coordinates) return null;
    const [lng, lat] = order.pickupLocation.coordinates;
    return { lat, lng };
  }, [order]);

  if (isLoading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
          <p className="text-sm text-white/60 font-medium">Loading order…</p>
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
      const result = await cancelOrder({ id, reason: cancelReason || 'user_cancelled' }).unwrap();
      setShowCancel(false);
      setCancelReason('');
      if (result.feeRupees > 0) {
        toast(`Order cancelled — ₹${result.feeRupees} cancellation fee charged`, {
          icon: '💳',
          duration: 5000,
        });
      } else {
        toast.success('Order cancelled — no charge');
      }
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Could not cancel. Try again.');
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
    {/* Cashback celebration popup — fires once after order completes */}
    {cashbackPop && (
      <CashbackCelebration
        amountPaise={cashbackPop.amountPaise}
        totalEarnedPaise={walletData?.wallet?.lifetimeCreditedPaise}
        onClose={() => setCashbackPop(null)}
      />
    )}
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f9fafb 120px)' }}>

      {/* Socket degraded banner — shown when live updates are interrupted */}
      <AnimatePresence>
        {socketStatus !== 'connected' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold ${
              socketStatus === 'offline' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              <Loader2 size={12} className="animate-spin shrink-0" />
              {socketStatus === 'offline'
                ? 'Live updates unavailable — showing last known state'
                : 'Reconnecting live updates…'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium header */}
      <header className="sticky top-0 z-20 backdrop-blur-md" style={{ background: 'rgba(15,23,42,0.97)' }}>
        <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
          <motion.button onClick={() => nav('/')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0" whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={18} strokeWidth={2.5} className="text-white" />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Order tracking</p>
            <p className="font-bold text-white capitalize flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400" />
              {order.service.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Total</p>
            <p className="font-black text-white">₹{order.pricing?.total}</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </header>

      {/* ETA Banner — sits just below header, outside scroll */}
      <ETABanner etaMinutes={liveOrder.etaMinutes} status={status} />

      <motion.div
        className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pt-4 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Searching — MicroStatusPanel replaces basic spinner */}
        <AnimatePresence>
          {['created', 'searching'].includes(status) && (
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

        {/* ── Live Boost card — shown while searching ─────────────────── */}
        <AnimatePresence>
          {['created', 'searching'].includes(status) && (
            <motion.div
              key="boost-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ delay: 0.5, type: 'spring', damping: 22, stiffness: 280 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)', boxShadow: '0 8px 32px rgba(15,23,42,0.18)' }}
            >
              {/* Heat bar */}
              <motion.div
                className="h-1"
                animate={{ scaleX: liveBoost > 0 ? 1 : 0.25 }}
                style={{
                  transformOrigin: 'left',
                  background: liveBoost >= 100 ? 'linear-gradient(90deg,#f97316,#ef4444)'
                    : liveBoost >= 50 ? 'linear-gradient(90deg,#fb923c,#f97316)'
                    : liveBoost >= 10 ? 'linear-gradient(90deg,#fbbf24,#fb923c)'
                    : 'rgba(255,255,255,0.08)',
                }}
              />

              <div className="px-4 pt-4 pb-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      key={liveBoost}
                      animate={liveBoost > 0 ? { rotate: [-10, 10, -6, 6, 0], scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      <Flame
                        size={18} strokeWidth={2}
                        className={liveBoost >= 100 ? 'text-red-400' : liveBoost >= 50 ? 'text-orange-400' : liveBoost >= 10 ? 'text-amber-400' : 'text-white/25'}
                      />
                    </motion.div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight">
                        {liveBoost >= 100 ? 'On fire — top priority!' : liveBoost >= 50 ? 'Heating up fast' : liveBoost > 0 ? 'Boosted' : 'Boost to get matched faster'}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {liveBoost > 0 ? `Workers see +₹${liveBoost} on your offer` : 'Tip a worker to jump the queue'}
                      </p>
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {liveBoost > 0 && (
                      <motion.div
                        key={liveBoost}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
                      >
                        <Zap size={10} strokeWidth={2.5} className="text-orange-400" />
                        <span className="text-[11px] font-black text-orange-400">+₹{liveBoost}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Boost amount pills */}
                <div className="grid grid-cols-5 gap-2 mb-3.5">
                  {[0, 10, 20, 50, 100].map((amt) => {
                    const active = liveBoost === amt;
                    const isNone = amt === 0;
                    return (
                      <motion.button
                        key={amt}
                        onClick={async () => {
                          const prev = liveBoost;
                          setLiveBoost(amt);
                          if (amt > 0) {
                            try {
                              await sendTip({ orderId: id, amountPaise: amt * 100 }).unwrap();
                              try { navigator.vibrate?.([40, 30, 80, 30, 120]); } catch {}
                              // Crazy confirmation toast
                              const msgs = [
                                `+₹${amt} boost sent! Workers are seeing your higher offer now`,
                                `Your offer just jumped to ₹${(order?.pricing?.total || 0) + amt} — workers will race to accept!`,
                                amt >= 100
                                  ? `Max boost! You're #1 priority in the queue`
                                  : amt >= 50
                                  ? `Hot offer! Nearby workers just got notified of your boost`
                                  : `Boosted! Workers who ignored you may now accept`,
                              ];
                              toast.success(msgs[Math.floor(Math.random() * msgs.length)], {
                                duration: 3500,
                                style: { background: '#0f172a', color: '#fb923c', fontWeight: 700, border: '1px solid rgba(251,146,60,0.3)' },
                                icon: amt >= 50 ? '🔥' : '⚡',
                              });
                            } catch { /* best-effort */ }
                          }
                        }}
                        whileTap={{ scale: 0.85 }}
                        animate={active ? { scale: [1, 1.13, 1.04], transition: { type: 'spring', stiffness: 500, damping: 18 } } : { scale: 1 }}
                        className="relative h-11 rounded-2xl flex items-center justify-center font-black text-[12px] overflow-hidden"
                        style={{
                          background: active ? (isNone ? 'linear-gradient(135deg,#334155,#1e293b)' : 'linear-gradient(135deg,#c2410c,#f97316)') : 'rgba(255,255,255,0.07)',
                          border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          color: active ? 'white' : 'rgba(255,255,255,0.45)',
                          boxShadow: active && !isNone ? '0 4px 18px rgba(249,115,22,0.45)' : 'none',
                        }}
                      >
                        {active && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0.7 }}
                            animate={{ scale: 3, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 rounded-2xl"
                            style={{ background: isNone ? 'rgba(255,255,255,0.12)' : 'rgba(251,146,60,0.35)' }}
                          />
                        )}
                        <span className="relative z-10">{isNone ? 'None' : `+₹${amt}`}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Speed bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg,#fb923c,#ef4444)' }}
                      animate={{ width: `${Math.min(100, liveBoost)}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white/35 shrink-0 w-20 text-right">
                    {liveBoost >= 100 ? 'Max speed' : liveBoost >= 50 ? 'Fast match' : liveBoost >= 10 ? 'Boosted' : 'Standard speed'}
                  </span>
                </div>
              </div>
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
          <motion.div
            className="rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
            variants={fadeInUp}
          >
            {/* Worker gradient banner */}
            <div className="px-4 py-3.5 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e3a5f 100%)' }}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-base shrink-0 ring-2 ring-white/20">
                {(order.workerName || 'W').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white truncate">{order.workerName || 'Your Worker'}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-300 bg-green-500/20 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={9} strokeWidth={2.5} /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Star size={11} strokeWidth={2} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-white/80">
                    {order.workerRating?.toFixed?.(1) || '4.8'}
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/50">{order.workerJobs || 0}+ jobs</span>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  onClick={callWorker}
                  className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shadow-sm"
                  whileTap={{ scale: 0.92 }}
                  aria-label="Call worker"
                >
                  <Phone size={16} strokeWidth={2} className="text-white" />
                </motion.button>
                <motion.button
                  onClick={() => nav(`/orders/${id}/chat`)}
                  className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"
                  whileTap={{ scale: 0.92 }}
                  aria-label="Chat"
                >
                  <MessageCircle size={16} strokeWidth={2} className="text-white" />
                </motion.button>
              </div>
            </div>

            {/* ETA row */}
            {['on_the_way', 'arrived'].includes(status) && (
              <div className="px-4 py-3 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={13} strokeWidth={2} className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700">
                    {status === 'arrived' ? 'Worker has arrived' : 'Estimated arrival'}
                  </span>
                </div>
                <span className="font-black text-blue-600 text-sm">
                  {status === 'arrived'
                    ? '📍 At your location'
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

        {/* Progress stepper */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <p className="font-bold text-[#0F172A] text-sm mb-4">Order Progress</p>
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const done    = activeStepIdx > i;
              const current = activeStepIdx === i;
              const future  = activeStepIdx < i;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      done ? 'bg-gradient-to-br from-green-400 to-green-600' : current ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-slate-100'
                    }`}
                    style={current ? { boxShadow: '0 4px 12px rgba(37,99,235,0.35)' } : {}}>
                      {done ? (
                        <CheckCircle size={15} strokeWidth={2.5} className="text-white" />
                      ) : current ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 bg-slate-300 rounded-full" />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-4 mt-1 rounded-full ${done ? 'bg-green-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className={`pb-1 pt-1 ${future ? 'opacity-35' : ''}`}>
                    <p className={`text-sm font-bold leading-tight ${
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

        {/* OTP card — shown below progress stepper once a worker is assigned */}
        <AnimatePresence>
          {['assigned', 'on_the_way', 'arrived'].includes(status) && order.otp && (
            <motion.div
              key="otp-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: status === 'arrived'
                  ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: status === 'arrived'
                  ? '0 8px 28px rgba(124,58,237,0.35)'
                  : '0 8px 24px rgba(245,158,11,0.3)',
              }}
            >
              {/* Header row */}
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <ShieldCheck size={15} strokeWidth={2} className="text-white/80" />
                <p className="text-xs font-extrabold text-white/80 uppercase tracking-widest">
                  {status === 'arrived' ? 'Worker is here — share your OTP' : 'Your Service OTP'}
                </p>
              </div>

              {/* Digit boxes */}
              <div className="flex justify-center gap-3 px-4 pb-3">
                {String(order.otp).split('').map((digit, i) => (
                  <div
                    key={i}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}
                  >
                    <span className="text-4xl font-black text-white tracking-tight">{digit}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-white/70 text-center font-semibold pb-4 px-4">
                Tell this code to your worker to start the service
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Service location */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4 flex items-start gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <MapPin size={15} strokeWidth={2} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Service Location</p>
            <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">
              {order.pickupLocation?.address}
            </p>
          </div>
        </motion.div>

        {/* Completion proof photos — shown to customer after job done */}
        {status === 'completed' && order.completionPhotos?.length > 0 && (
          <motion.div
            className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
            variants={fadeInUp}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <CheckCircle size={15} strokeWidth={2} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Work Completed</p>
                <p className="text-sm font-bold text-[#0F172A]">Proof of work photos</p>
              </div>
            </div>
            <div className={`grid gap-2 ${order.completionPhotos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {order.completionPhotos.map((url, i) => (
                <ProofPhoto key={i} url={url} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed order actions — invoice + support */}
        {status === 'completed' && (
          <motion.div className="flex gap-2" variants={fadeInUp}>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/orders/${id}/invoice`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) throw new Error('Invoice not available');
                  const html = await res.text();
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  const url  = URL.createObjectURL(blob);
                  window.open(url, '_blank', 'noopener');
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                } catch (err) {
                  toast.error(err.message || 'Could not load invoice');
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white ring-1 ring-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <FileText size={15} strokeWidth={2} className="text-blue-600" />
              Invoice
            </button>
            <button
              onClick={() => nav('/support')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white ring-1 ring-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <HeadphonesIcon size={15} strokeWidth={2} className="text-violet-600" />
              Get Help
            </button>
          </motion.div>
        )}

        {/* Book Same Worker Again — shown after completion when a worker exists */}
        {status === 'completed' && order.workerId && (
          <motion.div variants={fadeInUp}>
            <motion.button
              onClick={() => nav(`/book/${order.service}?preferredWorker=${order.workerId}`)}
              whileTap={{ scale: 0.97 }}
              className="w-full h-14 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
              }}
            >
              <Repeat2 size={18} strokeWidth={2.5} />
              Book {order.workerName ? order.workerName.split(' ')[0] : 'Same Worker'} Again
            </motion.button>
          </motion.div>
        )}

        {/* Price Revision Alert — shown during in_progress when worker requests */}
        {pendingRevision && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <PriceRevisionCard
              revision={{ ...pendingRevision, orderId: id }}
              onResolved={() => refetch()}
            />
          </motion.div>
        )}

        {/* Warranty card — shown after completion */}
        {status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <WarrantyCard orderId={id} />
          </motion.div>
        )}

        {/* Tip card — shown after completion */}
        {status === 'completed' && !order.userRating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <TipCard orderId={id} onDone={refetch} />
          </motion.div>
        )}

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
      <div className="fixed bottom-0 inset-x-0 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 -8px 32px rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2">
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
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-red-600 border border-red-200 rounded-2xl hover:bg-red-50 transition"
            >
              <AlertCircle size={15} strokeWidth={2} />
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* ── Cancel Order Bottom Sheet — Uber style ─────────────── */}
      <AnimatePresence>
        {showCancel && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCancel(false)}
            />

            <motion.div
              className="relative bg-white rounded-t-[28px] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              {/* drag pill */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />

              {/* header */}
              <div className="flex items-center justify-between px-5 mb-4">
                <p className="font-extrabold text-[#0F172A] text-lg">Cancel order?</p>
                <button
                  onClick={() => setShowCancel(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X size={16} strokeWidth={2.5} className="text-slate-500" />
                </button>
              </div>

              {/* Fee preview card */}
              <div className="mx-5 mb-4">
                {previewLoading ? (
                  <div className="h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  </div>
                ) : cancelPreview ? (
                  <div className={`rounded-2xl p-4 flex items-center gap-3 ${
                    cancelPreview.isFree
                      ? 'bg-green-50 ring-1 ring-green-100'
                      : 'bg-red-50 ring-1 ring-red-100'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      cancelPreview.isFree ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {cancelPreview.isFree
                        ? <CheckCircle size={18} strokeWidth={2} className="text-green-600" />
                        : <Wallet size={18} strokeWidth={2} className="text-red-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${cancelPreview.isFree ? 'text-green-800' : 'text-red-800'}`}>
                        {cancelPreview.isFree
                          ? cancelPreview.secsLeft > 0
                            ? `Free cancel — ${Math.floor(cancelPreview.secsLeft / 60)}m ${cancelPreview.secsLeft % 60}s left`
                            : 'No cancellation fee'
                          : `₹${cancelPreview.feeRupees} cancellation fee`
                        }
                      </p>
                      <p className={`text-xs mt-0.5 ${cancelPreview.isFree ? 'text-green-600' : 'text-red-600'}`}>
                        {cancelPreview.message}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Cancel reason list */}
              <p className="px-5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Why are you cancelling?
              </p>
              <div className="px-5 space-y-1 mb-5 max-h-48 overflow-y-auto">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setCancelReason(r.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition ${
                      cancelReason === r.id
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-sm font-semibold">{r.label}</span>
                    {cancelReason === r.id && <CheckCircle size={14} strokeWidth={2.5} className="text-white shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="px-5 flex gap-3">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 h-12 rounded-2xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Keep Order
                </button>
                <button
                  onClick={onCancel}
                  disabled={cancelling || !cancelReason}
                  className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-extrabold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelling && <Loader2 size={16} className="animate-spin" />}
                  {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

function ProofPhoto({ url, index }) {
  const [state, setState] = useState('loading'); // loading | loaded | error

  if (!url) return null;

  return (
    <a
      href={state === 'loaded' ? url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden ring-1 ring-slate-100 hover:ring-green-300 transition bg-slate-50"
      onClick={state !== 'loaded' ? (e) => e.preventDefault() : undefined}
    >
      {/* Fixed-height container prevents the "blank white box" on error/loading */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-slate-300" />
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-50">
            <AlertCircle size={20} className="text-slate-300" />
            <p className="text-[10px] text-slate-400 font-medium">Photo unavailable</p>
          </div>
        )}
        <img
          src={url}
          alt={`Work proof ${index + 1}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      </div>
    </a>
  );
}

function RatingPanel({ onRate }) {
  const [value, setValue] = useState(0);
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.2)' }}
    >
      <div className="p-4 space-y-3">
        <p className="text-sm font-bold text-white text-center">How was your experience?</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button
              key={n}
              onClick={() => setValue(n)}
              whileTap={{ scale: 0.85 }}
              className="p-1"
            >
              <Star
                size={32}
                strokeWidth={1.5}
                className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-white/20'}
              />
            </motion.button>
          ))}
        </div>
        <motion.button
          onClick={() => onRate(value)}
          disabled={!value}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
          whileTap={{ scale: 0.97 }}
        >
          Submit Rating
        </motion.button>
      </div>
    </div>
  );
}
