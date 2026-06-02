import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MessageCircle, Star, CheckCircle,
  Clock, MapPin, AlertCircle, Loader2, ShieldCheck, RefreshCw,
  Zap, X, ChevronRight, AlertTriangle, Wallet, HeadphonesIcon, FileText,
  Repeat2, CheckCircle2, UserCheck, HelpCircle,
} from 'lucide-react';
import { useGetOrderQuery, useGetCancelPreviewQuery, useCancelOrderMutation, useRateOrderMutation, useGetPriceRevisionQuery } from '../services/api';
import { useOrderSocket, useSocketStatus } from '../hooks/useSocket';
import { selectOrder, setActiveOrder, setWorkerLocation } from '../modules/order/orderSlice';
import { selectAuth } from '../modules/auth/authSlice';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import PageTransition from '../components/common/PageTransition';

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
  // Socket delivers real-time state; REST poll is a safety net for missed events.
  const { data, isLoading, refetch } = useGetOrderQuery(id, { pollingInterval: 30000 });
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [rateOrder] = useRateOrderMutation();

  const [showCancel, setShowCancel]           = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [showMatchSheet, setShowMatchSheet]   = useState(false);
  const [cashbackPop, setCashbackPop]         = useState(null); // { amountPaise }
  const completionShownRef = useRef(false);
  const matchShownRef      = useRef(false);
  const liveOrder = useSelector(selectOrder);
  const { data: walletData } = useGetWalletQuery();

  // ── Worker-arrived confirmation flow ──────────────────────────────────────
  // OTP is only revealed after the user explicitly confirms the worker is present.
  // sessionStorage key persists the confirmation across same-session refreshes.
  const ssKey = `wc:${id}`;
  const [workerConfirmed,         setWorkerConfirmed]         = useState(() => {
    try { return sessionStorage.getItem(ssKey) === '1'; } catch { return false; }
  });
  const [showArrivedSheet,        setShowArrivedSheet]        = useState(false);
  const [confirmCountdown,        setConfirmCountdown]        = useState(90);
  const [workerNotHereMode,       setWorkerNotHereMode]       = useState(false);
  const countdownRef = useRef(null);
  // Track the last status we showed the sheet for so we don't show it twice
  const arrivedShownRef = useRef(workerConfirmed);

  // Fetch cancel fee preview whenever cancel sheet is open
  const { data: cancelPreview, isFetching: previewLoading } = useGetCancelPreviewQuery(id, {
    skip: !showCancel,
    refetchOnMountOrArgChange: true,
  });

  const order = data?.order;

  useEffect(() => {
    if (!order) return;
    dispatch(setActiveOrder({ orderId: order._id, status: order.status }));
    // Seed the map immediately from the REST response so the worker dot shows on
    // page load / hard refresh without waiting for the next socket location event.
    if (order.workerCurrentLocation) {
      dispatch(setWorkerLocation(order.workerCurrentLocation));
    }
  }, [order?._id, dispatch]); // eslint-disable-line

  // Derive status early so the effects below can read it without a TDZ error.
  // liveOrder comes from the socket; order comes from REST. Socket wins when active.
  const status = liveOrder.activeOrderId === order?._id
    ? liveOrder.status || order?.status
    : order?.status;

  // Show confirmation sheet once when worker first marks arrived
  useEffect(() => {
    if (status !== 'arrived' || workerConfirmed || arrivedShownRef.current) return;
    arrivedShownRef.current = true;
    setShowArrivedSheet(true);
    setConfirmCountdown(90);
    setWorkerNotHereMode(false);
  }, [status, workerConfirmed]);

  // Auto-confirm countdown — if user ignores the sheet for 90 s the OTP is revealed
  useEffect(() => {
    if (!showArrivedSheet) { clearInterval(countdownRef.current); return; }
    countdownRef.current = setInterval(() => {
      setConfirmCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          confirmWorkerArrived();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [showArrivedSheet]); // eslint-disable-line

  function confirmWorkerArrived() {
    setWorkerConfirmed(true);
    setShowArrivedSheet(false);
    try { sessionStorage.setItem(ssKey, '1'); } catch {}
    toast.success('OTP revealed — share it with your worker to start');
  }

  useOrderSocket(order?._id);
  const socketStatus = useSocketStatus();

  // Price revision — poll during in_progress / arrived (status is now defined)
  const { data: revisionData } = useGetPriceRevisionQuery(id, {
    skip: !['in_progress', 'arrived'].includes(status),
    pollingInterval: 15000,
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
            workerLocation={
              // When arrived and no socket location yet, pin the worker dot at the
              // pickup coordinate so the map always shows "someone is here".
              liveOrder.workerLocation ||
              (status === 'arrived' && pickup ? pickup : null)
            }
            service={order.service}
            status={status}
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

        {/* OTP card ─────────────────────────────────────────────────────────
            • assigned / on_the_way → show OTP upfront (worker hasn't arrived yet,
              user can have it ready)
            • arrived → only reveal after user confirms worker is present
            • in_progress → hide (service already started)                      */}
        <AnimatePresence>
          {order.otp && (
            // arrived but not yet confirmed → show a "waiting for your confirmation" placeholder
            status === 'arrived' && !workerConfirmed ? (
              <motion.div
                key="otp-pending"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl overflow-hidden ring-1 ring-violet-200"
                style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' }}
              >
                <div className="px-4 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                    <HelpCircle size={18} strokeWidth={2} className="text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-violet-900">Confirm the worker is here</p>
                    <p className="text-xs text-violet-500 mt-0.5">Your OTP will appear once you confirm</p>
                  </div>
                  <button
                    onClick={() => setShowArrivedSheet(true)}
                    className="px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            ) : (
              // Show OTP when: not-arrived statuses OR arrived+confirmed
              ['assigned', 'on_the_way'].includes(status) || (status === 'arrived' && workerConfirmed)
            ) && (
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
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <ShieldCheck size={15} strokeWidth={2} className="text-white/80" />
                  <p className="text-xs font-extrabold text-white/80 uppercase tracking-widest">
                    {status === 'arrived' ? 'Worker is here — share your OTP' : 'Your Service OTP'}
                  </p>
                </div>
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
            )
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

      {/* ── Worker-arrived confirmation sheet ───────────────────────────────
          Slides up when worker marks arrived. User must confirm before OTP shows.
          Auto-confirms after 90 s (countdown visible) so the service isn't blocked
          if the user is slow to respond or the app is backgrounded.               */}
      <AnimatePresence>
        {showArrivedSheet && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {/* do nothing — must tap a button */}}
            />

            <motion.div
              className="relative bg-white rounded-t-[32px] pb-[max(1.75rem,env(safe-area-inset-bottom))]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Drag pill */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-5" />

              {/* Worker avatar + headline */}
              <div className="flex flex-col items-center px-6 pb-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl mb-3 shadow-lg"
                     style={{ boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                  {(order.workerName || 'W').slice(0, 2).toUpperCase()}
                </div>
                <p className="text-xl font-black text-[#0F172A] text-center leading-tight">
                  Is {order.workerName ? order.workerName.split(' ')[0] : 'your worker'} at your door?
                </p>
                <p className="text-sm text-slate-400 mt-1.5 text-center">
                  They've marked themselves as arrived. Confirm so your OTP unlocks.
                </p>
              </div>

              {/* Auto-confirm countdown ring */}
              <div className="flex flex-col items-center mt-4 mb-5">
                <div className="relative w-16 h-16">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="5" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="#7c3aed"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - confirmCountdown / 90)}`}
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-violet-700">
                    {confirmCountdown}s
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  OTP auto-reveals in {confirmCountdown} s
                </p>
              </div>

              {/* Action buttons */}
              <div className="px-5 space-y-3">
                {!workerNotHereMode ? (
                  <>
                    {/* YES — confirm arrived */}
                    <motion.button
                      onClick={confirmWorkerArrived}
                      whileTap={{ scale: 0.97 }}
                      className="w-full h-14 rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-2.5"
                      style={{
                        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                        boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
                      }}
                    >
                      <CheckCircle2 size={20} strokeWidth={2.5} />
                      Yes, they're here — show OTP
                    </motion.button>

                    {/* NO — worker not here */}
                    <button
                      onClick={() => {
                        clearInterval(countdownRef.current);
                        setWorkerNotHereMode(true);
                      }}
                      className="w-full h-12 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
                    >
                      No, they haven't arrived yet
                    </button>
                  </>
                ) : (
                  /* Worker-not-here panel */
                  <div className="rounded-2xl bg-red-50 ring-1 ring-red-100 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-extrabold text-red-800">Worker hasn't arrived?</p>
                        <p className="text-xs text-red-500 mt-0.5">
                          Call them first — sometimes GPS delay causes an early ping.
                          If they're genuinely not there, report it.
                        </p>
                      </div>
                    </div>

                    {order.workerId && (
                      <button
                        onClick={callWorker}
                        className="w-full h-11 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <Phone size={15} strokeWidth={2} /> Call Worker
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setWorkerNotHereMode(false)}
                        className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          // Dismiss sheet but don't confirm — user can re-open via placeholder card
                          setShowArrivedSheet(false);
                          setWorkerNotHereMode(false);
                          toast('Sheet closed — tap "Confirm" when ready', { icon: '⏳' });
                        }}
                        className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
                      >
                        Wait & check later
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
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
