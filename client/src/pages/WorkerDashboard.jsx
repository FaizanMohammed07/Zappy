import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, MapPin, Navigation, Loader2, Briefcase,
  Flame, ChevronRight, TrendingUp, CheckCircle,
  AlertTriangle, X, Star, Award, Target,
  Wifi, WifiOff, BadgeCheck, Trophy, Zap, Gem,
  Droplets, Bolt, Wind, Hammer, Users, Car,
  Sparkles, Paintbrush2, Wrench, Clock, BarChart2,
  ChevronDown, ChevronUp, ArrowRight, BadgeIndianRupee,
  ShieldCheck, TrendingDown, Siren, ArrowUpRight,
  ArrowDownRight, Minus, Smartphone, Battery, Layers,
  Home, Bike, Fuel, Pencil, Bell, Building2, ArrowRightLeft,
  GraduationCap, Scale, Wallet, FileText, Menu, Calendar, HelpCircle
} from 'lucide-react';
import {
  useGetWorkerMeQuery, useGoOnlineMutation, useGoOfflineMutation,
  useGetEarningsQuery, useWorkerAcceptMutation, useWorkerRejectMutation,
  useGetKycStatusQuery, useGetWorkerOrdersQuery, useGetDemandZonesQuery,
  useGetWorkerLeaderboardQuery, useListNotificationsQuery, useLogoutMutation, useRevokeAllSessionsMutation,
  useGetWorkerGoalsQuery, useGetZoneBenchmarkQuery,
} from '../services/api';
import { useWorkerOfferSocket } from '../hooks/useSocket';
import { setOffer, clearOffer, setOnline, selectWorker } from '../modules/worker/workerSlice';
import { selectAuth, logout } from '../modules/auth/authSlice';
import { useGeolocation } from '../hooks/useGeolocation';
import { reverseGeocode } from '../utils/reverseGeocode';
import { getSocket } from '../services/socket';
import { ZappyLogo } from '../components/common/ZappyLogo';
import WorkerOnboarding from './WorkerOnboarding';
import ShiftSlotsWidget from '../components/worker/ShiftSlotsWidget';
import WellnessWidget from '../components/worker/WellnessWidget';
import EarnedWageWidget from '../components/worker/EarnedWageWidget';
import ReadyModeCard from '../components/worker/ReadyModeCard';
import toast from 'react-hot-toast';

/* ─── Constants (mirror backend incentive.service.js) ─────────── */

const MILESTONES = [
  { jobs: 10, bonusRs: 200 },
  { jobs: 25, bonusRs: 500 },
  { jobs: 50, bonusRs: 1000 },
  { jobs: 100, bonusRs: 2500 },
  { jobs: 200, bonusRs: 5000 },
];

const BADGES = [
  { id: 'first', label: 'Starter', Icon: Zap, threshold: 1 },
  { id: 'five', label: '5 Jobs', Icon: Star, threshold: 5 },
  { id: 'twenty', label: '25 Jobs', Icon: Flame, threshold: 25 },
  { id: 'fifty', label: 'Elite', Icon: Gem, threshold: 50 },
  { id: 'century', label: 'Legend', Icon: Trophy, threshold: 100 },
];

const SERVICE_ICON_MAP = {
  // Original
  electrical: { Icon: Bolt, bg: 'bg-amber-100', color: 'text-amber-600' },
  plumbing: { Icon: Droplets, bg: 'bg-blue-100', color: 'text-blue-600' },
  ac_repair: { Icon: Wind, bg: 'bg-cyan-100', color: 'text-cyan-600' },
  carpenter: { Icon: Hammer, bg: 'bg-orange-100', color: 'text-orange-600' },
  helper: { Icon: Users, bg: 'bg-green-100', color: 'text-green-600' },
  puncture: { Icon: Car, bg: 'bg-slate-100', color: 'text-slate-500' },
  cleaning: { Icon: Sparkles, bg: 'bg-purple-100', color: 'text-purple-600' },
  painting: { Icon: Paintbrush2, bg: 'bg-pink-100', color: 'text-pink-600' },
  // Mobile phone
  screen_replacement: { Icon: Smartphone, bg: 'bg-indigo-100', color: 'text-indigo-600' },
  battery_replacement: { Icon: Battery, bg: 'bg-emerald-100', color: 'text-emerald-600' },
  charging_issue: { Icon: Bolt, bg: 'bg-yellow-100', color: 'text-yellow-600' },
  speaker_mic_issue: { Icon: Layers, bg: 'bg-violet-100', color: 'text-violet-600' },
  software_issue: { Icon: Wrench, bg: 'bg-red-100', color: 'text-red-600' },
  water_damage_check: { Icon: Droplets, bg: 'bg-sky-100', color: 'text-sky-600' },
  // Construction
  mason: { Icon: Home, bg: 'bg-stone-100', color: 'text-stone-600' },
  // Car + Bike
  battery_jump_start: { Icon: Zap, bg: 'bg-yellow-100', color: 'text-yellow-600' },
  fuel_delivery: { Icon: Fuel, bg: 'bg-orange-100', color: 'text-orange-600' },
  bike_wash: { Icon: Bike, bg: 'bg-cyan-100', color: 'text-cyan-600' },
  car_wash: { Icon: Car, bg: 'bg-blue-100', color: 'text-blue-600' },
  minor_roadside_repair: { Icon: AlertTriangle, bg: 'bg-red-100', color: 'text-red-600' },
};

/* ─── Notification bell with live unread count ───────────────── */
function NotifBell({ token, onTap }) {
  const { data } = useListNotificationsQuery(
    { page: 1, unreadOnly: true },
    { skip: !token, pollingInterval: 60000 }
  );
  const [bump, setBump] = useState(0); // real-time socket bumps

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const handler = () => setBump((b) => b + 1);
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [token]);

  const count = (data?.unread ?? 0) + bump;

  return (
    <motion.button
      onClick={onTap}
      className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:text-white/80"
      style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
      whileTap={{ scale: 0.9 }}
    >
      <Bell size={15} className="text-white/70" />
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </motion.button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getLast7Days(breakdown = []) {
  const byDate = Object.fromEntries(breakdown.map((d) => [d.date, d]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return byDate[key] || { date: key, earningsPaise: 0, jobs: 0 };
  });
}

/* ─── Offer alert sound ──────────────────────────────────────────────────────
 * Browsers create an AudioContext in the `suspended` state unless it is started
 * by a user gesture. An offer arrives over a socket (no gesture), so building a
 * fresh context per alert produced a SILENT beep every time. We keep ONE context
 * and unlock/resume it on the worker's first tap, then resume before each play. */
let _audioCtx = null;
function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_audioCtx) _audioCtx = new AC();
  return _audioCtx;
}
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { });
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}

function playOfferAlert() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Resume if the browser suspended it (backgrounded tab / not yet unlocked).
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    [[0, 880], [0.2, 1100], [0.4, 880]].forEach(([delay, freq]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch { }
}

function computeTrustScore(acceptRate, rating, completedJobs) {
  return Math.min(100, Math.round(
    (acceptRate * 0.35) +
    ((rating / 5) * 100 * 0.45) +
    (Math.min(completedJobs / 20, 1) * 100 * 0.20),
  ));
}

/* ─── Main ───────────────────────────────────────────────────── */

export default function WorkerDashboard() {
  const nav = useNavigate();
  const dispatch = useDispatch();
  const worker = useSelector(selectWorker);
  const { accessToken: token } = useSelector(selectAuth);

  // 60s poll — profile/availability rarely changes mid-session; socket events drive
  // job-offer state changes, so there's no user-visible lag from a slower REST poll.
  const { data: meData, refetch: refetchMe } = useGetWorkerMeQuery(undefined, { pollingInterval: 60000, skip: !token });
  const { data: todayData } = useGetEarningsQuery('today', { skip: !token });
  const { data: weekData } = useGetEarningsQuery('week', { skip: !token });
  const { data: kycData } = useGetKycStatusQuery(undefined, { skip: !token });
  const { data: jobsData } = useGetWorkerOrdersQuery(1, { skip: !token });

  // Profile avatar — fetched from server proxy (permanent, no URL expiry)
  const [avatarUrl, setAvatarUrl] = useState(null);
  useEffect(() => {
    if (!token || !meData?.worker?.profilePhotoKey) return;
    const baseUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${baseUrl}/api/workers/me/avatar`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => blob && setAvatarUrl(URL.createObjectURL(blob)))
      .catch(() => { });
  }, [token, meData?.worker?.profilePhotoKey]);

  const [goOnline] = useGoOnlineMutation();
  const [goOffline] = useGoOfflineMutation();
  const [acceptOffer, { isLoading: accepting }] = useWorkerAcceptMutation();
  const [rejectOffer] = useWorkerRejectMutation();
  const [callLogout] = useLogoutMutation();
  const [revokeAll] = useRevokeAllSessionsMutation();

  const { getCurrent, watch } = useGeolocation();
  const watchRef = useRef(null);
  const [myLat, setMyLat] = useState(null);
  const [myLng, setMyLng] = useState(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [areaName, setAreaName] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [onlineTimer, setOnlineTimer] = useState(0); // seconds online this session
  const onlineStart = useRef(null);

  const me = meData?.worker;
  const isOnline = me?.isOnline ?? false;
  const isBusy = isOnline && !!me?.currentOrderId;
  const kycApproved = kycData?.kyc?.status === 'approved';
  const kycStatus = kycData?.kyc?.status;
  const canGoOnline = kycApproved;

  const completedJobs = me?.completedJobs ?? 0;
  const rating = me?.rating ?? null; // null until first real rating
  const penalties = me?.penalties ?? {};
  const totalOffers = penalties.totalOffers ?? 0;
  const totalRejects = penalties.totalRejects ?? 0;
  const totalCancels = penalties.totalCancels ?? 0;

  const hasOfferData = totalOffers > 0;
  const hasJobData = completedJobs > 0;
  const hasRatingData = hasJobData && rating !== null;

  const acceptRate = hasOfferData ? Math.round(((totalOffers - totalRejects) / totalOffers) * 100) : null;
  const cancelRate = hasJobData ? Math.round((totalCancels / completedJobs) * 100) : null;
  const trustScore = (hasOfferData || hasJobData)
    ? computeTrustScore(acceptRate ?? 100, rating ?? 5, completedJobs)
    : null;

  const chart7d = getLast7Days(weekData?.dailyBreakdown);
  const chartMax = Math.max(...chart7d.map((d) => d.earningsPaise), 1);
  const hasChartData = chart7d.some((d) => d.earningsPaise > 0);

  const nextMilestone = MILESTONES.find((m) => m.jobs > completedJobs) ?? null;
  const prevMilestone = [...MILESTONES].reverse().find((m) => m.jobs <= completedJobs);
  const msProgress = nextMilestone
    ? Math.round(((completedJobs - (prevMilestone?.jobs ?? 0)) /
      (nextMilestone.jobs - (prevMilestone?.jobs ?? 0))) * 100)
    : 100;

  const todayRs = todayData?.earningsRupees ?? 0;
  const todayJobs = todayData?.jobs ?? 0;
  const weekRs = weekData?.earningsRupees ?? 0;
  const weekAvgRs = weekData?.avgEarningPerJobRupees ?? 0;
  const totalWallet = Math.round((me?.wallet?.totalEarnings ?? 0) / 100);

  // session online timer
  useEffect(() => {
    if (isOnline) {
      onlineStart.current = onlineStart.current ?? Date.now();
      const id = setInterval(() => {
        setOnlineTimer(Math.floor((Date.now() - onlineStart.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    } else {
      onlineStart.current = null;
      setOnlineTimer(0);
    }
  }, [isOnline]);

  useEffect(() => { dispatch(setOnline(isOnline)); }, [isOnline, dispatch]);

  // Real-time KYC rejection — admin can revoke while worker is online
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const handleKycRejected = ({ status, reason }) => {
      dispatch(setOnline(false));
      toast.error(
        reason ? `KYC rejected: ${reason}` : 'Your KYC was not approved. Please resubmit.',
        { duration: 8000 }
      );
      // Refetch worker profile so KYC banner re-appears immediately
      refetchMe?.();
    };
    socket.on('kyc.rejected', handleKycRejected);
    return () => socket.off('kyc.rejected', handleKycRejected);
  }, [token, dispatch]);

  // GPS permission probe
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((r) => {
      setGpsOn(r.state === 'granted');
      r.onchange = () => setGpsOn(r.state === 'granted');
    }).catch(() => { });
  }, []);

  // offer socket + alert
  const handleOffer = useCallback((offer) => {
    // Map boostAmountPaise → boostedBy (rupees) so the boost badge renders immediately
    // even if the customer boosted before dispatch started broadcasting.
    const enriched = {
      ...offer,
      ...(offer.boostAmountPaise > 0 && { boostedBy: Math.round(offer.boostAmountPaise / 100) }),
      // High-demand accept bonus (platform-funded, paid on completion) — grows as search widens.
      ...(offer.urgencyBonusPaise > 0 && { urgencyBonusBy: Math.round(offer.urgencyBonusPaise / 100) }),
    };
    dispatch(setOffer(enriched));
    // Stronger vibration pattern for boosted offers (distinct from standard)
    const isBoosted = (offer.boostAmountPaise ?? 0) > 0;
    playOfferAlert();
    try { navigator.vibrate?.(isBoosted ? [100, 50, 150, 50, 250, 50, 150] : [200, 100, 200]); } catch { }
  }, [dispatch]);

  // offer taken by another worker — dismiss popup immediately
  const handleOfferCancelled = useCallback((p) => {
    if (worker.currentOffer && String(worker.currentOffer._id) === String(p?.orderId)) {
      dispatch(clearOffer());
    }
  }, [dispatch, worker.currentOffer]);

  // system auto-assigned a job to this worker (force-assign flow)
  const handleForceAssigned = useCallback((data) => {
    dispatch(clearOffer());
    refetchMe();
    playOfferAlert();
    try { navigator.vibrate?.([300, 100, 300, 100, 300]); } catch { }
    toast.success(`Job assigned to you! ₹${data.price ?? ''}`, { duration: 6000 });
    setTimeout(() => nav(`/worker/jobs/${data.orderId}`), 1500);
  }, [dispatch, nav, refetchMe]);

  // Customer boosted their offer while worker is viewing it — update price live
  const handleOfferBoosted = useCallback((data) => {
    if (worker.currentOffer && String(worker.currentOffer._id) === String(data?.orderId)) {
      dispatch(setOffer({ ...worker.currentOffer, price: data.newTotal, boostedBy: data.rupees }));
      playOfferAlert();
      try { navigator.vibrate?.([60, 40, 100, 40, 150]); } catch { }
    }
  }, [dispatch, worker.currentOffer]);

  // Active job pulled away (admin reassign or stale-watchdog) — clear banner immediately
  const handleJobPulled = useCallback(() => {
    refetchMe();
    toast.error('Your job was reassigned. Stay online for the next one.', { duration: 5000 });
  }, [refetchMe]);

  useWorkerOfferSocket(handleOffer, handleOfferCancelled, handleForceAssigned, handleOfferBoosted, handleJobPulled);

  // Continuous location broadcast — socket (fast) + REST fallback (reliable)
  // Client-side gates: 4s time throttle + 10m distance threshold.
  // Server enforces its own 1s throttle and 5m threshold as a second layer.
  const lastRestRef = useRef(0);
  const lastSentPosRef = useRef(null); // { lat, lng } of last actually-sent position
  useEffect(() => {
    if (!isOnline || !token) { watchRef.current?.(); watchRef.current = null; return; }
    const socket = getSocket(token);
    let lastSocket = 0;

    function haverMetres(a, b) {
      const R = 6371000;
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const x = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    let stationaryState = { lastMovedAt: Date.now() };

    watchRef.current = watch(
      (pos) => {
        setGpsOn(true);
        setMyLat(pos.lat);
        setMyLng(pos.lng);
        const now = Date.now();
        const cur = { lat: pos.lat, lng: pos.lng };

        const distMoved = lastSentPosRef.current ? haverMetres(lastSentPosRef.current, cur) : 999;
        const moved = distMoved >= 15;
        if (moved) stationaryState.lastMovedAt = now;

        // Parked workers: heartbeat every 60s. Moving workers: every 4s.
        const isParked = (now - stationaryState.lastMovedAt) > 45000;
        const minInterval = isParked ? 60000 : 4000;

        if (moved || now - lastSocket >= minInterval) {
          lastSocket = now;
          if (moved) lastSentPosRef.current = cur;
          socket.emit('worker:location', {
            lat: pos.lat,
            lng: pos.lng,
            orderId: me?.currentOrderId,
            hdg: pos.heading ?? null,
            spd: pos.speed ?? null,
            acc: pos.accuracy ?? null,
          });
        }

        // REST backup: every 30s (Mongo alive heartbeat, survives socket reconnect)
        if (now - lastRestRef.current >= 30000) {
          lastRestRef.current = now;
          const locBody = { lat: pos.lat, lng: pos.lng };
          if (me?.currentOrderId) locBody.orderId = me.currentOrderId;
          const baseUrl = import.meta.env.VITE_API_URL || '';
          fetch(`${baseUrl}/api/workers/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(locBody),
          }).catch(() => { });
        }
      },
      () => setGpsOn(false),
    );
    return () => { watchRef.current?.(); watchRef.current = null; };
  }, [isOnline, token, watch, me?.currentOrderId]);

  // Onboarding gate — placed AFTER all hooks so React's hook count stays constant
  if (meData && !me?.onboardingComplete) {
    return <WorkerOnboarding onComplete={refetchMe} />;
  }

  async function toggleOnline() {
    if (!canGoOnline) { toast.error('KYC required'); nav('/worker/kyc'); return; }
    if (isBusy) { toast('Finish your active job first'); return; }
    setToggling(true);
    try {
      if (isOnline) {
        await goOffline().unwrap();
        setAreaName(null);
        toast.success('You are now offline');
      } else {
        const pos = await getCurrent();
        setGpsOn(true);
        // Poor accuracy (>500m = IP-based location on laptops) — warn the worker
        // so they know their position in the dispatch system may be wrong.
        if (pos.accuracy && pos.accuracy > 500) {
          toast('⚠️ GPS accuracy is low — your location may be off. Use a phone for accurate dispatch.', {
            duration: 6000,
            icon: null,
          });
        }
        await goOnline({ lat: pos.lat, lng: pos.lng }).unwrap();
        toast.success('You are now online');
        // Reverse geocode in background — non-blocking
        reverseGeocode(pos.lat, pos.lng).then(({ primary, secondary }) => {
          setAreaName(secondary ? `${primary}, ${secondary.split(',')[0]}` : primary);
        }).catch(() => { });
      }
      refetchMe();
    } catch (err) {
      toast.error(err.data?.error || err.message || 'Failed');
    } finally {
      setToggling(false);
    }
  }

  async function onAccept() {
    if (!worker.currentOffer) return;
    try {
      await acceptOffer(worker.currentOffer._id).unwrap();
      const id = worker.currentOffer._id;
      dispatch(clearOffer());
      nav(`/worker/jobs/${id}`);
    } catch (err) {
      toast.error(err.data?.error || 'Could not accept');
      dispatch(clearOffer());
    }
  }

  async function onReject() {
    if (!worker.currentOffer) return;
    try { await rejectOffer(worker.currentOffer._id).unwrap(); } finally { dispatch(clearOffer()); }
  }

  const initials = (me?.name || 'W').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const fmtTimer = onlineTimer > 0
    ? `${Math.floor(onlineTimer / 3600)}h ${Math.floor((onlineTimer % 3600) / 60)}m online`
    : null;
  // Desktop Tabs State
  const [activeJobTab, setActiveJobTab] = useState('New');

  const pendingCount = jobsData?.orders?.filter(o => o.status === 'pending').length || 0;
  const acceptedCount = jobsData?.orders?.filter(o => o.status === 'accepted').length || 0;
  const ongoingCount = jobsData?.orders?.filter(o => ['in_progress', 'arrived', 'started'].includes(o.status)).length || 0;
  const completedCount = jobsData?.orders?.filter(o => o.status === 'completed').length || 0;
  const cancelledCount = jobsData?.orders?.filter(o => o.status === 'cancelled').length || 0;

  const getTabOrders = () => {
    if (!jobsData?.orders) return [];
    switch (activeJobTab) {
      case 'New': return jobsData.orders.filter(o => o.status === 'pending');
      case 'Accepted': return jobsData.orders.filter(o => o.status === 'accepted');
      case 'Ongoing': return jobsData.orders.filter(o => ['in_progress', 'arrived', 'started'].includes(o.status));
      case 'Completed': return jobsData.orders.filter(o => o.status === 'completed');
      case 'Cancelled': return jobsData.orders.filter(o => o.status === 'cancelled');
      default: return [];
    }
  };

  const desktopTabOrders = getTabOrders();

  return (
    <>
      {/* ── Mobile & Tablet View (Unmodified) ────────────────── */}
      <div className="lg:hidden">
        {/* Top Navbar */}
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 z-20">
          <button className="p-2 -ml-2 text-slate-700">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-1.5">
            <Zap className="text-blue-600 fill-blue-600" size={24} />
            <div>
              <h1 className="text-lg font-black text-blue-600 leading-none">Zappyone</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Worker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={22} className="text-slate-600" onClick={() => nav('/worker/notifications')} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-slate-200">
              <span className="text-blue-700 font-bold text-sm">{initials}</span>
            </div>
          </div>
        </header>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, staggerChildren: 0.1 }} className="pb-24">
          
          {/* Welcome Card */}
          <div className="m-4 p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/60 shadow-sm flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  Hello, {me?.name?.split(' ')[0]} <span className="text-lg">👋</span>
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Go online to get more jobs</p>
                <div className="flex items-center gap-1 mt-2 text-slate-600 cursor-pointer">
                  <MapPin size={14} />
                  <span className="text-xs font-bold">{areaName || 'Fetching Location...'}</span>
                  <ChevronDown size={14} className="ml-0.5 text-slate-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-600">{isOnline ? 'Online' : 'Offline'}</span>
                <button
                  onClick={toggleOnline}
                  disabled={toggling || !canGoOnline}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${isOnline ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isOnline ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <button 
              onClick={toggleOnline} 
              disabled={toggling || !canGoOnline}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white shadow-md transition-colors ${isOnline ? 'bg-red-500 shadow-red-200 active:bg-red-600' : 'bg-blue-600 shadow-blue-200 active:bg-blue-700'}`}
            >
              {toggling ? <Loader2 size={18} className="animate-spin" /> : <Wifi size={18} />}
              {isOnline ? 'Go Offline' : 'Go Online'}
            </button>
          </div>

          {/* 4 Stat Cards Horizontal Scroll */}
          <div className="flex overflow-x-auto gap-4 px-4 pb-2 snap-x hide-scrollbar">
            <motion.div whileTap={{ scale: 0.96 }} className="snap-start shrink-0 w-[140px] bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                <Wallet size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">Wallet Balance</p>
                <p className="text-2xl font-black text-slate-800 leading-none mt-1">₹{totalWallet}</p>
                <button onClick={() => nav('/wallet')} className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-0.5 hover:underline">
                  View balance <ChevronRight size={12} />
                </button>
              </div>
            </motion.div>

            <motion.div whileTap={{ scale: 0.96 }} className="snap-start shrink-0 w-[140px] bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <BadgeIndianRupee size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">Today's Earnings</p>
                <p className="text-2xl font-black text-slate-800 leading-none mt-1">₹{todayRs}</p>
                <p className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-0.5 hover:underline">
                  View details <ChevronRight size={12} />
                </p>
              </div>
            </motion.div>

            <motion.div whileTap={{ scale: 0.96 }} className="snap-start shrink-0 w-[140px] bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                <Briefcase size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">Today's Jobs</p>
                <p className="text-2xl font-black text-slate-800 leading-none mt-1">{todayJobs}</p>
                <p className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-0.5 hover:underline">
                  View all <ChevronRight size={12} />
                </p>
              </div>
            </motion.div>

            <motion.div whileTap={{ scale: 0.96 }} className="snap-start shrink-0 w-[140px] bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                <Star size={20} className="text-purple-500 fill-purple-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">Your Rating</p>
                <p className="text-2xl font-black text-slate-800 leading-none mt-1">{hasRatingData ? rating.toFixed(1) : '0.0'}</p>
                <p className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-0.5 hover:underline">
                  Reviews <ChevronRight size={12} />
                </p>
              </div>
            </motion.div>
          </div>

          {/* Job Requests */}
          <div className="mt-6 px-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-800">Job Requests</h3>
              <button className="text-xs font-bold text-blue-600 hover:underline">View all</button>
            </div>
            
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
              {[
                { label: 'New', count: pendingCount },
                { label: 'Accepted', count: acceptedCount },
                { label: 'Ongoing', count: ongoingCount },
                { label: 'Completed', count: completedCount },
              ].map(tab => (
                <button
                  key={tab.label}
                  onClick={() => setActiveJobTab(tab.label)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeJobTab === tab.label ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center text-center">
               {desktopTabOrders.length === 0 ? (
                 <>
                   <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                     <FileText size={32} className="text-blue-500" />
                   </div>
                   <h4 className="text-sm font-bold text-slate-800 mb-1">No {activeJobTab.toLowerCase()} job requests</h4>
                   <p className="text-xs text-slate-500 mb-6">Go online to receive new job requests</p>
                   <button onClick={toggleOnline} disabled={toggling || !canGoOnline} className="bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors w-full justify-center">
                     <Wifi size={16} /> {isOnline ? 'Go Offline' : 'Go Online'}
                   </button>
                 </>
               ) : (
                 <div className="w-full space-y-3">
                   {desktopTabOrders.map(order => (
                     <div key={order._id} className="p-3 border border-slate-200 rounded-xl cursor-pointer text-left" onClick={() => nav(`/worker/jobs/${order._id}`)}>
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="font-bold text-sm text-slate-800">{order.serviceName || 'Job Service'}</p>
                           <p className="text-xs text-slate-500 mt-1">{order.status}</p>
                         </div>
                         <p className="font-black text-blue-600 text-sm">₹{order.price}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="mt-6 px-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-800">Today's Schedule</h3>
              <button className="text-xs font-bold text-blue-600 hover:underline">View calendar</button>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                <Calendar size={24} className="text-blue-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No jobs scheduled for today</h4>
                <p className="text-xs text-slate-500 mt-0.5">Jobs will appear here once scheduled</p>
              </div>
            </div>
          </div>

          {/* Earnings Overview */}
          <div className="mt-8 px-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-slate-800">Earnings Overview</h3>
              <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => nav('/wallet')}>View details</button>
            </div>
            
            <p className="text-xs font-medium text-slate-500">This Week</p>
            <div className="flex items-end gap-3 mt-1 mb-6">
              <p className="text-3xl font-black text-slate-800 leading-none">₹{weekRs}</p>
              <p className="text-xs font-bold text-green-500 flex items-center mb-0.5">
                <ArrowUpRight size={14} /> 0% <span className="text-slate-400 font-normal ml-1">from last week</span>
              </p>
            </div>

            {hasChartData ? (
              <div className="relative h-28 w-full flex items-end justify-between">
                <div className="absolute top-0 bottom-6 left-6 right-0 border-b border-slate-100" />
                <div className="absolute top-1/2 bottom-6 left-6 right-0 border-b border-slate-50" />
                
                <div className="flex flex-col justify-between h-[calc(100%-24px)] text-[9px] font-bold text-slate-400 pb-1 absolute left-0 top-0">
                  <span>₹{chartMaxRs}</span>
                  <span>₹{Math.round(chartMaxRs/2)}</span>
                  <span>₹0</span>
                </div>

                <div className="flex-1 flex justify-between items-end ml-8 relative z-10">
                  {chart7d.map((d, i) => {
                    const isToday = i === chart7d.length - 1;
                    const h = Math.max(Math.round((d.earningsPaise / chartMax) * 100), 5);
                    const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][new Date(d.date + 'T00:00').getDay() - 1] || 'Sun';
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-2">
                        <div className="relative flex justify-center w-full" style={{ height: 80 }}>
                           <div className="absolute bottom-0 w-2.5 rounded-full" style={{ height: `${h}%`, background: isToday ? '#2563eb' : '#e2e8f0' }} />
                           <div className="absolute top-0 w-3 h-3 bg-white border-[3px] rounded-full transform translate-y-1/2 z-20" style={{ borderColor: isToday ? '#2563eb' : '#cbd5e1', bottom: `calc(${h}% - 6px)`, top: 'auto' }} />
                        </div>
                        <span className={`text-[9px] font-bold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Horizontal connection line for nodes */}
                <div className="absolute left-10 right-2 border-b-2 border-slate-200 z-0 top-[calc(100%-35px)]" />
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-sm font-bold text-slate-300">
                No earnings data to display
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 px-4">
            <h3 className="text-base font-black text-slate-800 mb-4">Quick Actions</h3>
            <div className="flex justify-between px-2">
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => nav('/worker/jobs')}>
                <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center">
                  <Briefcase size={20} className="text-blue-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">My Jobs</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center">
                  <Calendar size={20} className="text-orange-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Bookings</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => nav('/wallet')}>
                <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center">
                  <BadgeIndianRupee size={20} className="text-green-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Earnings</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center">
                  <FileText size={20} className="text-purple-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Documents</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center">
                  <HelpCircle size={20} className="text-blue-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Support</span>
              </div>
            </div>
          </div>

        </motion.div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 flex justify-between items-center z-50">
          <div className="flex flex-col items-center gap-1 cursor-pointer">
            <Home size={22} className="text-blue-600" />
            <span className="text-[10px] font-bold text-blue-600">Home</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => nav('/worker/jobs')}>
            <Briefcase size={22} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">My Jobs</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => nav('/wallet')}>
            <BadgeIndianRupee size={22} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Earnings</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => nav('/wallet')}>
            <Wallet size={22} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Wallet</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => nav('/worker/profile')}>
            <Users size={22} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Profile</span>
          </div>
        </div>
      </div>

      {/* ── Desktop View (Strictly lg and above) ──────────────── */}
      <div className="hidden lg:flex min-h-screen bg-[#F8FAFC] w-full overflow-hidden text-slate-800">
        
        {/* Sidebar */}
        <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white fill-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black text-blue-600 tracking-tight leading-none">Zappyone</h1>
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Worker</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {[
                { name: 'Dashboard', icon: Home, active: true, to: '/worker' },
                { name: 'My Jobs', icon: Briefcase, to: '/worker/jobs' },
                { name: 'Bookings', icon: Clock, to: '#' },
                { name: 'Earnings', icon: BadgeIndianRupee, to: '/wallet' },
                { name: 'Wallet', icon: Wallet, to: '/wallet' },
                { name: 'Notifications', icon: Bell, to: '/worker/notifications', badge: 3 },
                { name: 'Reviews', icon: Star, to: '#' },
                { name: 'Support', icon: AlertTriangle, to: '#' },
                { name: 'Profile', icon: Users, to: '/worker/profile' },
                { name: 'Documents', icon: FileText, to: '#' },
              ].map((link, idx) => (
                <button key={idx} onClick={() => link.to !== '#' && nav(link.to)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${link.active ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <link.icon size={18} strokeWidth={2} className={link.active ? 'text-white' : 'text-slate-400'} />
                    {link.name}
                  </div>
                  {link.badge && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{link.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-6">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <p className="text-xs font-bold text-slate-800 mb-3">Go Online to get more jobs</p>
              <button 
                onClick={toggleOnline} 
                disabled={toggling || !canGoOnline}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white shadow-lg transition-colors ${isOnline ? 'bg-red-500 shadow-red-200 hover:bg-red-600' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'}`}
              >
                {toggling ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                {isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-blue-600">
              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-tight">Need Help?</p>
                <p className="text-[10px] text-slate-500">24x7 Support</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto">
          
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                Hello, {me?.name || 'Worker'} <span className="text-xl">👋</span>
              </h2>
              <p className="text-sm text-slate-500 mt-1">Complete more jobs to earn more and grow with Zappyone.</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-700">{isOnline ? 'Online' : 'Offline'}</span>
                <button
                  onClick={toggleOnline}
                  disabled={toggling || !canGoOnline}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isOnline ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              
              <div className="relative">
                <Bell size={22} className="text-slate-600" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
              </div>

              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 cursor-pointer">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {initials}
                </div>
                <span className="text-sm font-bold text-slate-800">{me?.name?.split(' ')[0]}</span>
                <ChevronDown size={16} className="text-slate-400" />
              </div>
            </div>
          </header>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, staggerChildren: 0.1 }} className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
            
            {/* 6 Stat Cards Row */}
            <div className="grid grid-cols-6 gap-4">
              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Wallet size={20} className="text-white" />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Today's Earnings</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">₹{todayRs}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">{todayJobs} Jobs Completed</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <Clock size={20} className="text-blue-600" />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Today's Hours</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">{onlineTimer > 0 ? `${Math.floor(onlineTimer / 3600)}h ${Math.floor((onlineTimer % 3600) / 60)}m` : '00h 00m'}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">{todayJobs} Jobs Completed</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase size={20} className="text-white" />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Today's Jobs</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">{todayJobs}</p>
                  <p className="text-[11px] text-blue-600 mt-2 font-bold cursor-pointer hover:underline">View all jobs</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                    <Wallet size={20} className="text-white" />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Wallet Balance</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">₹{totalWallet}</p>
                  <p className="text-[11px] text-blue-600 mt-2 font-bold cursor-pointer hover:underline" onClick={() => nav('/wallet')}>View balance</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shrink-0">
                    <Star size={20} className="text-white fill-white" />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Your Rating</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">{hasRatingData ? rating.toFixed(1) : '0.0'}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">{hasRatingData ? 'Based on reviews' : '0 Reviews'}</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer hover:border-blue-300 transition-all relative overflow-hidden group"><div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-transparent group-hover:from-blue-500/5 transition-colors z-0" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-xl">%</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Acceptance Rate</p>
                  <p className="text-2xl font-black text-slate-800 leading-none mt-1">{acceptRate !== null ? `${acceptRate}%` : '0%'}</p>
                  <p className="text-[11px] text-blue-600 mt-2 font-bold cursor-pointer hover:underline">View details</p>
                </div>
              </motion.div>
            </div>

            {/* 2-Column Main Layout */}
            <div className="grid grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: Job Requests & Completed */}
              <div className="col-span-7 space-y-6">
                
                {/* Job Requests */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-black text-slate-800 mb-4">Job Requests</h3>
                  
                  {/* Tabs */}
                  <div className="flex gap-6 border-b border-slate-200">
                    {[
                      { label: 'New', count: pendingCount },
                      { label: 'Accepted', count: acceptedCount },
                      { label: 'Ongoing', count: ongoingCount },
                      { label: 'Completed', count: completedCount },
                      { label: 'Cancelled', count: cancelledCount },
                    ].map(tab => (
                      <button
                        key={tab.label}
                        onClick={() => setActiveJobTab(tab.label)}
                        className={`pb-3 text-sm font-bold transition-colors relative ${activeJobTab === tab.label ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {tab.label} ({tab.count})
                        {activeJobTab === tab.label && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="py-12 flex flex-col items-center justify-center min-h-[300px]">
                    {desktopTabOrders.length === 0 ? (
                      <div className="text-center flex flex-col items-center">
                        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                          <FileText size={40} className="text-blue-400" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">No {activeJobTab.toLowerCase()} job requests</h4>
                        <p className="text-sm text-slate-500 mt-1 mb-6">Go online to receive new job requests</p>
                        <button onClick={toggleOnline} disabled={toggling || !canGoOnline} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors">
                          <Wifi size={16} /> {isOnline ? 'Go Offline' : 'Go Online'}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full space-y-4 flex-1 self-start">
                         {desktopTabOrders.map(order => (
                           <div key={order._id} className="p-4 border border-slate-200 rounded-xl hover:border-blue-300 cursor-pointer" onClick={() => nav(`/worker/jobs/${order._id}`)}>
                             <div className="flex justify-between items-start">
                               <div>
                                 <p className="font-bold text-slate-800">{order.serviceName || 'Job Service'}</p>
                                 <p className="text-sm text-slate-500 mt-1">{order.status}</p>
                               </div>
                               <p className="font-black text-blue-600">₹{order.price}</p>
                             </div>
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recently Completed */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-800">Recently Completed</h3>
                    <button className="text-sm font-bold text-blue-600 hover:underline">View all</button>
                  </div>
                  
                  <div className="py-8 flex flex-col items-center justify-center">
                    {completedCount === 0 ? (
                      <div className="text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle size={32} className="text-slate-400" />
                        </div>
                        <h4 className="text-base font-bold text-slate-800">No completed jobs yet</h4>
                        <p className="text-xs text-slate-500 mt-1">Your completed jobs will appear here</p>
                      </div>
                    ) : (
                      <div className="w-full space-y-3">
                         {getTabOrders('Completed').slice(0, 3).map(order => (
                           <div key={order._id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => nav(`/worker/jobs/${order._id}`)}>
                             <p className="font-semibold text-slate-700">{order.serviceName || 'Job Completed'}</p>
                             <p className="font-bold text-slate-900">₹{order.price}</p>
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Schedule, Earnings Chart, Performance */}
              <div className="col-span-5 space-y-6">
                
                {/* Today's Schedule */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-800">Today's Schedule</h3>
                    <button className="text-sm font-bold text-blue-600 hover:underline">View Calendar</button>
                  </div>
                  
                  <div className="py-10 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <Clock size={28} className="text-blue-400" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">No jobs scheduled for today</h4>
                    <p className="text-xs text-slate-500 mt-1">Jobs will appear here once scheduled</p>
                  </div>
                </div>

                {/* Earnings Overview */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-slate-800">Earnings Overview</h3>
                    <button className="text-sm font-bold text-blue-600 hover:underline" onClick={() => nav('/wallet')}>View Details</button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-4">This Week</p>
                  
                  <div className="mb-6">
                    <p className="text-3xl font-black text-slate-800 leading-none mb-2">₹{weekRs}</p>
                    <p className="text-xs font-bold text-green-500 flex items-center gap-1">
                      <ArrowUpRight size={14} /> 0% <span className="text-slate-400 font-normal">from last week</span>
                    </p>
                  </div>

                  {/* Reusing chart7d data for a basic visual representation */}
                  {hasChartData ? (
                    <div className="relative h-32 w-full mt-4 flex items-end justify-between px-2">
                      <div className="absolute top-0 bottom-6 left-0 right-0 border-b border-slate-100" />
                      <div className="absolute top-1/2 bottom-6 left-0 right-0 border-b border-slate-50" />
                      {chart7d.map((d, i) => {
                        const barH = Math.max(Math.round((d.earningsPaise / chartMax) * 100), 10);
                        const isToday = i === chart7d.length - 1;
                        const rs = Math.round(d.earningsPaise / 100);
                        const dayLabel = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d.date + 'T00:00').getDay()];
                        return (
                           <div key={d.date} className="relative z-10 flex flex-col items-center flex-1">
                              <div className="w-full flex justify-center group cursor-pointer relative" style={{ height: 100 }}>
                                 <div className="absolute bottom-0 w-3 rounded-full transition-all duration-300 group-hover:bg-blue-500" style={{ height: `${barH}%`, background: isToday ? '#2563eb' : '#e2e8f0' }} />
                                 <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                   ₹{rs}
                                 </div>
                              </div>
                              <p className={`text-[10px] font-bold mt-3 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{isToday ? 'Today' : dayLabel}</p>
                           </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-sm font-bold text-slate-300">
                      No earnings data to display
                    </div>
                  )}
                </div>

                {/* Performance */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-800">Performance</h3>
                    <button className="text-sm font-bold text-blue-600 hover:underline">View Details</button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 whitespace-nowrap">Completion Rate</p>
                      <p className="text-2xl font-black text-slate-800">{acceptRate !== null ? `${acceptRate}%` : '0%'}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{todayJobs} Jobs</p>
                    </div>
                    
                    <div className="flex flex-col border-l border-slate-100 pl-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 whitespace-nowrap">On-time Rate</p>
                      <p className="text-2xl font-black text-slate-800">100%</p>
                      <p className="text-[10px] text-slate-400 mt-1">{todayJobs} Jobs</p>
                    </div>
                    
                    <div className="flex flex-col border-l border-slate-100 pl-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 whitespace-nowrap">Jobs Completed</p>
                      <p className="text-2xl font-black text-slate-800">{completedJobs}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Total</p>
                    </div>
                    
                    <div className="flex flex-col border-l border-slate-100 pl-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 whitespace-nowrap">Total Earnings</p>
                      <p className="text-2xl font-black text-slate-800">₹{totalWallet}</p>
                      <p className="text-[10px] text-slate-400 mt-1">All time</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </main>
        
        {/* Render Modals in Desktop view as well! */}
        <AnimatePresence>
          {worker.currentOffer && (
            <OfferModal
              offer={worker.currentOffer}
              onAccept={onAccept}
              onReject={onReject}
              accepting={accepting}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );

}

/* ─── Trust Score Ring ───────────────────────────────────────── */

function TrustScoreRing({ score }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const isNew = score === null;
  const displayScore = isNew ? 0 : score;
  const offset = circ * (1 - displayScore / 100);
  const color = isNew ? '#CBD5E1' : score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90 absolute">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F1F5F9" strokeWidth="6" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: isNew ? circ : offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="text-center relative z-10">
        {isNew ? (
          <>
            <p className="text-[11px] font-extrabold text-slate-400 leading-tight">NEW</p>
            <p className="text-[8px] font-bold text-slate-300 tracking-widest">WORKER</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-extrabold text-[#0F172A] leading-none">{score}</p>
            <p className="text-[8px] font-bold text-slate-400 tracking-widest">TRUST</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Performance Row ────────────────────────────────────────── */

function PerformanceRow({ label, value, max, display, noDataLabel, good, warn, trackColor, invert }) {
  const noData = value === null || value === undefined;
  // For inverted metrics (cancellation rate): lower value → fuller bar
  const pct = noData ? 0 : Math.min((value / max) * 100, 100);
  const barPct = noData ? 0 : invert ? Math.max(0, 100 - pct) : pct;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <div className="flex items-center gap-1">
          {noData ? (
            <Minus size={11} strokeWidth={2} className="text-slate-300" />
          ) : good ? (
            <ArrowUpRight size={11} strokeWidth={2.5} className="text-green-500" />
          ) : warn ? (
            <ArrowDownRight size={11} strokeWidth={2.5} className="text-red-500" />
          ) : (
            <Minus size={11} strokeWidth={2.5} className="text-amber-400" />
          )}
          <p className={`text-xs font-bold ${noData ? 'text-slate-300'
            : good ? 'text-green-600'
              : warn ? 'text-red-600'
                : 'text-amber-600'
            }`}>
            {noData ? (noDataLabel ?? '—') : display}
          </p>
        </div>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${noData ? 'bg-slate-200' : trackColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}

/* ─── Recent Jobs ────────────────────────────────────────────── */

function RecentJobsList({ orders, onNav }) {
  const [expanded, setExpanded] = useState(false);
  if (!orders?.length) return null;
  const visible = expanded ? orders : orders.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Jobs</p>
        {orders.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"
          >
            {expanded ? 'Show less' : `${orders.length - 3} more`}
            {expanded ? <ChevronUp size={10} strokeWidth={2.5} /> : <ChevronDown size={10} strokeWidth={2.5} />}
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-50">
        {visible.map((order, i) => {
          const svc = SERVICE_ICON_MAP[order.service] || { Icon: Wrench, bg: 'bg-slate-100', color: 'text-slate-500' };
          const { Icon } = svc;
          return (
            <motion.button
              key={order._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onNav(`/worker/jobs/${order._id}`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition"
            >
              <div className={`w-9 h-9 rounded-xl ${svc.bg} flex items-center justify-center shrink-0`}>
                <Icon size={14} strokeWidth={2} className={svc.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] capitalize leading-none">
                  {order.service.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(order.completedAt || order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-[#0F172A]">₹{order.pricing?.total ?? '—'}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${order.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {order.status === 'completed' ? 'Completed' : order.status.replace(/_/g, ' ')}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Leaderboard Widget ─────────────────────────────────────── */

const MOCK_LEADERS = [
  { rank: 1, name: 'R*** K.', weekEarnings: 8400, isMe: false },
  { rank: 2, name: 'A*** S.', weekEarnings: 7200, isMe: false },
  { rank: 3, name: 'M*** P.', weekEarnings: 6800, isMe: false },
  { rank: 4, name: 'S*** R.', weekEarnings: 5900, isMe: false },
  { rank: 5, name: 'K*** V.', weekEarnings: 5100, isMe: false },
];

const RANK_COLORS = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-orange-500',
};

function LeaderboardWidget({ workerId }) {
  const { data, isLoading } = useGetWorkerLeaderboardQuery(undefined, {
    // Tolerate missing endpoint gracefully
    refetchOnMountOrArgChange: true,
  });

  const leaders = data?.leaders?.length ? data.leaders : MOCK_LEADERS;
  const myRank = data?.myRank?.rank ?? 12;
  const total = data?.myRank?.total ?? 847;
  const maxEarnings = Math.max(...leaders.map((l) => l.weekEarnings), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
      style={{ border: '1px solid rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} strokeWidth={2} className="text-amber-500" />
          <p className="text-xs font-bold text-slate-700">Top Earners · This Week</p>
        </div>
        <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
          You&apos;re #{myRank}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50 px-0">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-5 h-4 bg-slate-100 rounded" />
              <div className="flex-1 h-3 bg-slate-100 rounded" />
              <div className="w-12 h-3 bg-slate-100 rounded" />
            </div>
          ))
          : leaders.map((leader, i) => {
            const isHighlighted = leader.isMe;
            const barPct = Math.round((leader.weekEarnings / maxEarnings) * 100);
            const rankColor = RANK_COLORS[leader.rank] ?? 'text-slate-400';
            return (
              <motion.div
                key={leader.rank}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-3 ${isHighlighted ? 'bg-indigo-50' : ''
                  }`}
              >
                {/* Rank */}
                <p className={`text-sm font-black w-5 text-center shrink-0 ${rankColor}`}>
                  {leader.rank}
                </p>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isHighlighted ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {leader.name}
                  </p>
                  <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isHighlighted ? 'bg-indigo-500' : 'bg-amber-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 + i * 0.06 }}
                    />
                  </div>
                </div>

                {/* Earnings */}
                <p className={`text-xs font-extrabold shrink-0 ${isHighlighted ? 'text-indigo-600' : 'text-slate-700'}`}>
                  ₹{leader.weekEarnings.toLocaleString('en-IN')}
                </p>
              </motion.div>
            );
          })
        }
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-50">
        <p className="text-[10px] font-semibold text-slate-400 text-center">
          Your rank: #{myRank} of {total.toLocaleString('en-IN')} workers
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Demand Zones ───────────────────────────────────────────── */

const LEVEL_META = {
  very_high: { label: 'Very High', bg: 'bg-red-50', ring: 'ring-red-100', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-400' },
  high: { label: 'High', bg: 'bg-amber-50', ring: 'ring-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-400' },
  medium: { label: 'Moderate', bg: 'bg-blue-50', ring: 'ring-blue-100', dot: 'bg-blue-400', text: 'text-blue-700', bar: 'bg-blue-300' },
  low: { label: 'Low', bg: 'bg-slate-50', ring: 'ring-slate-100', dot: 'bg-slate-300', text: 'text-slate-500', bar: 'bg-slate-200' },
};

const TOOLS = [
  { to: '/worker/earnings', icon: BarChart2, label: 'Earnings', sub: 'Job breakdown', bg: 'from-indigo-50/80 to-indigo-100/80', ring: 'ring-indigo-200/50', iconColor: 'text-indigo-600', iconBg: 'bg-white/60' },
  { to: '/worker/goals', icon: Target, label: 'Goals', sub: 'Daily & weekly', bg: 'from-purple-50/80 to-purple-100/80', ring: 'ring-purple-200/50', iconColor: 'text-purple-600', iconBg: 'bg-white/60' },
  { to: '/worker/bank', icon: Building2, label: 'Bank & UPI', sub: 'Add accounts', bg: 'from-blue-50/80 to-blue-100/80', ring: 'ring-blue-200/50', iconColor: 'text-blue-600', iconBg: 'bg-white/60' },
  { to: '/worker/withdraw', icon: ArrowRightLeft, label: 'Withdraw', sub: 'Transfer to bank', bg: 'from-emerald-50/80 to-emerald-100/80', ring: 'ring-emerald-200/50', iconColor: 'text-emerald-600', iconBg: 'bg-white/60' },
  { to: '/worker/skills', icon: Star, label: 'Skills', sub: 'Specialise & earn', bg: 'from-amber-50/80 to-amber-100/80', ring: 'ring-amber-200/50', iconColor: 'text-amber-600', iconBg: 'bg-white/60' },
  { to: '/worker/training', icon: GraduationCap, label: 'Training', sub: 'Get certified', bg: 'from-rose-50/80 to-rose-100/80', ring: 'ring-rose-200/50', iconColor: 'text-rose-600', iconBg: 'bg-white/60' },
  { to: '/worker/appeals', icon: Scale, label: 'Appeals', sub: 'Contest ratings', bg: 'from-orange-50/80 to-orange-100/80', ring: 'ring-orange-200/50', iconColor: 'text-orange-600', iconBg: 'bg-white/60' },
  { to: '/plans', icon: Gem, label: 'Go Pro', sub: 'Lower commission', bg: 'from-stone-50/80 to-stone-100/80', ring: 'ring-stone-200/50', iconColor: 'text-stone-600', iconBg: 'bg-white/60' },
  { to: '/wallet', icon: Wallet, label: 'Wallet', sub: null, bg: 'from-teal-50/80 to-teal-100/80', ring: 'ring-teal-200/50', iconColor: 'text-teal-600', iconBg: 'bg-white/60' },
];

function WorkerToolsGrid({ nav, totalWallet }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mt-8">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Quick Access</p>
      <div className="grid grid-cols-3 gap-3">
        {TOOLS.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.button key={t.to + t.label} onClick={() => nav(t.to)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (i * 0.05) }}
              className={`bg-gradient-to-br ${t.bg} rounded-[1.25rem] p-3.5 text-left ring-1 ${t.ring} shadow-sm active:scale-[0.94] hover:shadow-md transition-all duration-200 group overflow-hidden relative`}
            >
              {/* Decorative background blur */}
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity bg-current ${t.iconColor}`} />

              <div className={`w-8 h-8 rounded-xl ${t.iconBg} flex items-center justify-center mb-2.5 shadow-sm ring-1 ring-black/5`}>
                <Icon size={16} strokeWidth={2.5} className={t.iconColor} />
              </div>
              <p className="font-black text-[13px] text-slate-800 leading-tight mb-0.5">{t.label}</p>
              <p className="text-[10px] font-medium text-slate-500 leading-tight truncate relative z-10">
                {t.label === 'Wallet' ? `₹${totalWallet} available` : t.sub}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function GoalsWidget() {
  const nav = useNavigate();
  const { data } = useGetWorkerGoalsQuery();
  const goals = data?.goals ?? [];
  if (goals.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
      className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Target size={13} strokeWidth={2.5} className="text-indigo-600" />
          </div>
          <p className="text-xs font-bold text-[#0F172A]">Earnings Goals</p>
        </div>
        <button onClick={() => nav('/worker/goals')} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
          Details <ChevronRight size={10} strokeWidth={2.5} />
        </button>
      </div>
      <div className="space-y-2">
        {goals.map(g => {
          const pct = g.targetPaise > 0 ? Math.min(100, Math.round((g.earnedPaise / g.targetPaise) * 100)) : 0;
          const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#6366f1' : '#f59e0b';
          return (
            <div key={g.period}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600 capitalize">{g.period} goal</span>
                <span className="font-bold" style={{ color }}>{pct}% · ₹{(g.earnedPaise / 100).toFixed(0)} / ₹{(g.targetPaise / 100).toFixed(0)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function BenchmarkWidget() {
  const nav = useNavigate();
  const { data } = useGetZoneBenchmarkQuery();
  if (!data) return null;
  const top = Math.round(100 - data.percentile);
  const color = top <= 20 ? '#10b981' : top <= 50 ? '#6366f1' : '#f59e0b';

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
      className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <TrendingUp size={16} strokeWidth={2} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#0F172A]">Zone Ranking</p>
          <p className="text-[10px] text-slate-400">vs workers in your area</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold" style={{ color }}>Top {top}%</p>
          <p className="text-[10px] text-slate-400">avg ₹{(data.zoneAvgPaise / 100).toFixed(0)}/wk</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${data.percentile}%`, backgroundColor: color }} />
      </div>
      <button onClick={() => nav('/worker/goals')} className="mt-2 text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
        Set earnings goal <ChevronRight size={10} strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

function DemandZonesWidget() {
  const [expanded, setExpanded] = useState(false);
  const [coords, setCoords] = useState(null);

  // Real GPS — watch position while component is mounted
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { },
      { enableHighAccuracy: true, maximumAge: 60000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const { data, isLoading } = useGetDemandZonesQuery(
    coords ? { lat: coords.lat, lng: coords.lng } : undefined,
    { skip: !coords, pollingInterval: 60000 },
  );

  const zones = data?.zones ?? [];
  const top = zones[0];

  if (!coords || isLoading || !top) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
        className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <Flame size={14} strokeWidth={2} className="text-red-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#0F172A]">High Demand Zones</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {!coords ? 'Waiting for GPS location…' : 'Loading nearby zones…'}
          </p>
        </div>
      </motion.div>
    );
  }

  const topMeta = LEVEL_META[top.level] ?? LEVEL_META.low;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="bg-white rounded-2xl p-4 shadow-sm overflow-hidden"
    >
      <div className="flex gap-0.5 -mx-4 -mt-4 mb-4 h-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div key={i} className={`flex-1 ${topMeta.bar}`}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <Flame size={14} strokeWidth={2} className="text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-[#0F172A]">High Demand Zones</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Move here to receive more requests</p>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
          {expanded ? 'Less' : 'All zones'}
          <ChevronRight size={10} strokeWidth={2.5} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Top zone highlight */}
      <div className={`flex items-center gap-3 p-3 rounded-xl ring-1 ${topMeta.bg} ${topMeta.ring}`}>
        <div className="relative shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${topMeta.dot}`} />
          <motion.div className={`absolute inset-0 rounded-full ${topMeta.dot}`}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${topMeta.text}`}>
            {top.name}
            <span className={`ml-1.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-white/60 ${topMeta.text}`}>
              {topMeta.label}
            </span>
            {top.level === 'very_high' && (
              <span className="ml-1 text-[9px] font-extrabold bg-amber-400 text-white px-1.5 py-0.5 rounded-full">2× Surge</span>
            )}
            {top.level === 'high' && (
              <span className="ml-1 text-[9px] font-extrabold bg-orange-400 text-white px-1.5 py-0.5 rounded-full">1.5× Surge</span>
            )}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {top.distKm} km away · jobs in {top.waitMin} min
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Zap size={11} strokeWidth={2.5} className={topMeta.text} />
          <span className={`text-xs font-extrabold ${topMeta.text}`}>Go</span>
        </div>
      </div>

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="space-y-1.5 pt-2">
              {zones.slice(1).map((z) => {
                const m = LEVEL_META[z.level] ?? LEVEL_META.low;
                return (
                  <div key={z.name} className="flex items-center gap-2.5 px-1 py-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                    <p className="text-xs font-semibold text-[#0F172A] flex-1">{z.name}</p>
                    {z.level === 'very_high' && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">2×</span>}
                    {z.level === 'high' && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">1.5×</span>}
                    <span className={`text-[9px] font-bold ${m.text}`}>{m.label}</span>
                    <span className="text-[10px] text-slate-400">{z.distKm} km</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Offer Modal — Uber driver style ──────────────────────────── */

// Per-tier display window (fresh from receipt — independent of server expiresAt)
const TIER_DISPLAY_SEC = { express: 20, priority: 28, standard: 35 };

function OfferModal({ offer, onAccept, onReject, accepting }) {
  const isExpress = offer.tier === 'express';
  const isPriority = offer.tier === 'priority';

  // Fresh countdown from the moment the worker RECEIVES the offer.
  // Server's expiresAt is used as a hard upper bound only — we never show
  // a stale timer caused by network/queue delay between dispatch and delivery.
  const displayDuration = TIER_DISPLAY_SEC[offer.tier] ?? 35;
  const hardDeadline = offer.expiresAt
    ? new Date(offer.expiresAt).getTime()
    : Date.now() + displayDuration * 1000;
  // Receipt time: mount time. Give the full display duration from NOW, but cap at hard deadline.
  const receiptExpiry = Date.now() + displayDuration * 1000;
  const effectiveExpiry = Math.min(receiptExpiry, hardDeadline);
  const initialLeft = Math.round((effectiveExpiry - Date.now()) / 1000);

  const [left, setLeft] = useState(initialLeft);
  const totalRef = useRef(initialLeft);

  useEffect(() => {
    const tick = () => {
      const l = Math.max(0, Math.ceil((effectiveExpiry - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) onReject();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [offer._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.max(0, left / Math.max(totalRef.current, 1));
  const urgent = left <= 6;

  const svc = SERVICE_ICON_MAP[offer.service] || { Icon: Wrench, bg: 'bg-slate-100', color: 'text-slate-600' };
  const SvcIcon = svc.Icon;

  /* Static map of the pickup — shown as map background.
     The bottom card covers the lower ~60% of the popup, so a map centred on
     the pickup would bury the pin behind the card. We push the map centre
     SOUTH of the pickup so the actual location renders in the visible top
     band (~26% from top), where we also draw a live pulsing marker on it. */
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [pickLng, pickLat] = offer.pickupCoords || [0, 0];
  const MAP_ZOOM = 15;                 // closer = exact location
  const PIN_TOP_FRAC = 0.26;           // where the pin should sit (from top)
  const IMG_H = 500;                   // logical static-map height
  // metres-per-pixel at this latitude/zoom, then south-shift so pin moves up
  const mpp = (156543.03392 * Math.cos((pickLat * Math.PI) / 180)) / 2 ** MAP_ZOOM;
  const shiftPx = (0.5 - PIN_TOP_FRAC) * IMG_H;        // logical px to move pin up
  const centerLat = pickLat - (shiftPx * mpp) / 111320; // move centre south
  const mapUrl = mapboxToken && pickLng && pickLat
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-l+1d4ed8(${pickLng},${pickLat})/` +
    `${pickLng},${centerLat},${MAP_ZOOM},0/800x500@2x` +
    `?access_token=${mapboxToken}&attribution=false&logo=false`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center sm:justify-center sm:p-6 sm:bg-black/80 sm:backdrop-blur-sm"
    >
      <div className="w-full max-w-md flex flex-col h-full sm:h-[90vh] sm:max-h-[850px] relative overflow-hidden sm:rounded-[2.5rem] shadow-2xl">
        {/* Map fills the entire background */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: isExpress
              ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
              : isPriority
                ? 'linear-gradient(135deg, #1c1007, #78350f)'
                : 'linear-gradient(135deg, #0f172a, #1e293b)',
          }}
        >
          {mapUrl ? (
            <>
              <img src={mapUrl} alt="map" className="w-full h-full object-cover" />
              {/* Live pulsing marker sitting exactly over the pickup pin */}
              <div
                className="absolute z-[1] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: '50%', top: '26%' }}
              >
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ width: 90, height: 90, background: 'radial-gradient(circle, rgba(29,78,216,0.35), transparent 70%)' }}
                  animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
                <span className="block w-3.5 h-3.5 rounded-full bg-blue-600 ring-[3px] ring-white shadow-lg" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <motion.div
                className="w-32 h-32 rounded-full"
                style={{
                  background: isExpress
                    ? 'radial-gradient(circle, rgba(99,102,241,0.5), transparent)'
                    : isPriority
                      ? 'radial-gradient(circle, rgba(251,191,36,0.4), transparent)'
                      : 'radial-gradient(circle, rgba(99,102,241,0.3), transparent)',
                }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <MapPin size={36} strokeWidth={1.5} className={isExpress ? 'text-indigo-300 absolute' : isPriority ? 'text-amber-300 absolute' : 'text-indigo-400 absolute'} />
            </div>
          )}
          {/* Subtle vignette — keep the map (and pin) readable up top, darken toward the card */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.45) 100%)' }} />
          {/* Countdown pill */}
          <motion.div
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl backdrop-blur-md"
            style={{ background: urgent ? 'rgba(239,68,68,0.9)' : 'rgba(15,23,42,0.8)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}` }}
            animate={urgent ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 0.4, repeat: Infinity }}
          >
            <Clock size={13} strokeWidth={2.5} className="text-white" />
            <span className="text-white font-black text-base tabular-nums">{left}s</span>
          </motion.div>
          {/* Tier banner — NEW JOB / EXPRESS / PRIORITY */}
          <motion.div
            className="absolute top-4 left-4 px-3.5 py-2 rounded-2xl backdrop-blur-md"
            style={
              isExpress
                ? { background: 'rgba(79,70,229,0.9)', border: '1px solid rgba(99,102,241,0.6)' }
                : isPriority
                  ? { background: 'rgba(180,83,9,0.9)', border: '1px solid rgba(251,191,36,0.5)' }
                  : { background: 'rgba(99,102,241,0.8)', border: '1px solid rgba(99,102,241,0.4)' }
            }
            animate={{
              boxShadow: isExpress
                ? ['0 0 0 0px rgba(99,102,241,0.6)', '0 0 0 16px rgba(99,102,241,0)', '0 0 0 0px rgba(99,102,241,0)']
                : isPriority
                  ? ['0 0 0 0px rgba(251,191,36,0.5)', '0 0 0 14px rgba(251,191,36,0)', '0 0 0 0px rgba(251,191,36,0)']
                  : ['0 0 0 0px rgba(99,102,241,0.4)', '0 0 0 12px rgba(99,102,241,0)', '0 0 0 0px rgba(99,102,241,0)'],
            }}
            transition={{ duration: isExpress ? 1.0 : 1.5, repeat: Infinity }}
          >
            <span className="text-white font-black text-xs tracking-widest">
              {isExpress ? '⚡ EXPRESS JOB' : isPriority ? '⭐ PRIORITY JOB' : '⚡ NEW JOB'}
            </span>
          </motion.div>
        </div>

        {/* Spacer to push card to bottom */}
        <div className="flex-1 relative z-10 pointer-events-none" />

        {/* Bottom card — design changes completely per tier */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 360 }}
          className="relative z-10 rounded-t-[32px] mt-auto"
          style={
            isExpress
              ? { background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#1e1b4b 100%)', boxShadow: '0 -20px 80px rgba(79,70,229,0.5)' }
              : isPriority
                ? { background: 'linear-gradient(160deg,#1c1007 0%,#3b1f02 60%,#1c1007 100%)', boxShadow: '0 -20px 80px rgba(180,83,9,0.45)' }
                : { background: 'white', boxShadow: '0 -16px 60px rgba(0,0,0,0.25)' }
          }
        >
          {/* Animated progress bar */}
          <div className={`absolute top-0 inset-x-0 h-1.5 rounded-t-[32px] overflow-hidden ${isExpress || isPriority ? 'bg-white/10' : 'bg-slate-100'}`}>
            <motion.div
              className="h-full absolute left-0 top-0 rounded-full"
              style={{
                background: urgent
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : isExpress
                    ? 'linear-gradient(90deg, #a5b4fc, #818cf8, #c7d2fe)'
                    : isPriority
                      ? 'linear-gradient(90deg, #fbbf24, #f59e0b, #fcd34d)'
                      : 'linear-gradient(90deg, #6366f1, #0ea5e9)',
              }}
              animate={{ width: `${Math.max(0, progress * 100)}%` }}
              transition={{ duration: 0.25, ease: 'linear' }}
            />
          </div>

          {/* Drag handle */}
          <div className={`w-10 h-1 rounded-full mx-auto mt-3 mb-0 ${isExpress || isPriority ? 'bg-white/20' : 'bg-slate-200'}`} />

          <div className="px-5 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">

            {/* Express / Priority tier header strip */}
            {(isExpress || isPriority) && (
              <motion.div
                className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-2xl"
                style={{
                  background: isExpress ? 'rgba(165,180,252,0.12)' : 'rgba(251,191,36,0.12)',
                  border: isExpress ? '1px solid rgba(165,180,252,0.25)' : '1px solid rgba(251,191,36,0.25)',
                }}
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{isExpress ? '⚡' : '⭐'}</span>
                  <div>
                    <p className={`text-[13px] font-black ${isExpress ? 'text-indigo-200' : 'text-amber-300'}`}>
                      {isExpress ? 'Express Booking' : 'Priority Booking'}
                    </p>
                    <p className={`text-[10px] ${isExpress ? 'text-indigo-400' : 'text-amber-500'}`}>
                      {isExpress ? 'Nearest worker · Instant match · Higher pay' : '4.5★+ workers only · Premium rate'}
                    </p>
                  </div>
                </div>
                <div className={`text-[11px] font-black px-2 py-1 rounded-full ${isExpress ? 'bg-indigo-500/30 text-indigo-200' : 'bg-amber-500/30 text-amber-200'}`}>
                  {offer.tierMultiplier > 1 ? `${offer.tierMultiplier}× rate` : ''}
                </div>
              </motion.div>
            )}

            {/* Service label + dismiss */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isExpress || isPriority ? 'bg-white/15' : svc.bg}`}
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <SvcIcon size={22} strokeWidth={1.75} className={isExpress || isPriority ? 'text-white' : svc.color} />
                </motion.div>
                <div>
                  <p className={`font-black text-lg capitalize leading-tight ${isExpress || isPriority ? 'text-white' : 'text-slate-900'}`}>
                    {offer.service.replace(/_/g, ' ')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {isExpress && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full ring-1 ring-indigo-300"
                      >
                        <Zap size={9} strokeWidth={2.5} />
                        Express — Fast Accept
                      </motion.span>
                    )}
                    {isPriority && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ring-1 ${isPriority ? 'text-amber-200 bg-amber-500/20 ring-amber-500/30' : 'text-amber-700 bg-amber-100 ring-amber-300'}`}
                      >
                        <Star size={9} strokeWidth={2.5} />
                        Priority Request
                      </motion.span>
                    )}
                    {offer.surgeMultiplier > 1 && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-300 px-2 py-0.5 rounded-full ring-1 ring-amber-400"
                      >
                        <Zap size={9} strokeWidth={2.5} />
                        {offer.surgeMultiplier}× Surge
                      </motion.span>
                    )}
                    {offer.boostedBy ? (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 text-[10px] font-black text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-full ring-1 ring-orange-500/30"
                      >
                        <Flame size={9} strokeWidth={2.5} />
                        Customer boosted!
                      </motion.span>
                    ) : !isExpress && !isPriority ? (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ring-1 ring-indigo-100">
                        Exclusive to you
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <motion.button
                onClick={onReject}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isExpress || isPriority ? 'bg-white/10' : 'bg-slate-100'}`}
                whileTap={{ scale: 0.9 }}
              >
                <X size={18} strokeWidth={2.5} className={isExpress || isPriority ? 'text-white/60' : 'text-slate-500'} />
              </motion.button>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2 mb-1">
              <motion.p
                key={offer.price}
                className={`font-black leading-none tabular-nums ${urgent ? 'text-red-400'
                  : offer.boostedBy ? 'text-orange-400'
                    : isExpress ? 'text-indigo-100'
                      : isPriority ? 'text-amber-200'
                        : 'text-slate-900'
                  }`}
                style={{ fontSize: 52 }}
                animate={offer.boostedBy
                  ? { scale: [1, 1.18, 1] }
                  : urgent ? { scale: [1, 1.03, 1] } : {}}
                transition={offer.boostedBy ? { duration: 0.5 } : { duration: 0.4, repeat: Infinity }}
              >
                ₹{offer.price}
              </motion.p>
              {offer.boostedBy ? (
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], boxShadow: ['0 0 0 0 rgba(249,115,22,0.6)', '0 0 0 12px rgba(249,115,22,0)', '0 0 0 0 rgba(249,115,22,0)'] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="flex items-center gap-1 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full"
                  >
                    <Flame size={10} strokeWidth={2.5} />
                    +₹{offer.boostedBy} BOOST
                  </motion.div>
                  <span className={`text-[9px] font-bold mt-0.5 ${isExpress || isPriority ? 'text-orange-400' : 'text-orange-500'}`}>Customer boosted offer!</span>
                </motion.div>
              ) : (
                <Zap size={24} strokeWidth={2.5} className={urgent ? 'text-red-400' : isExpress ? 'text-indigo-300' : isPriority ? 'text-amber-300' : 'text-blue-600'} />
              )}
            </div>

            {/* High-demand accept bonus — platform-funded, paid on completion, grows as search widens */}
            {offer.urgencyBonusBy > 0 && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center justify-center gap-1.5 mb-4 bg-emerald-500/15 text-emerald-600 text-[11px] font-black px-3 py-1.5 rounded-full self-center"
              >
                <Sparkles size={12} strokeWidth={2.5} />
                +₹{offer.urgencyBonusBy} HIGH-DEMAND BONUS · paid on completion
              </motion.div>
            )}

            {/* Rating + Verified */}
            <div className="flex items-center gap-3 mb-5">
              <span className={`flex items-center gap-1 text-sm font-bold ${isExpress || isPriority ? 'text-white/80' : 'text-[#0F172A]'}`}>
                <Star size={14} strokeWidth={0} className="fill-amber-400" />
                4.9
              </span>
              <span className={`flex items-center gap-1 text-sm font-bold ${isExpress ? 'text-indigo-300' : isPriority ? 'text-amber-300' : 'text-blue-600'}`}>
                <BadgeCheck size={15} strokeWidth={2.5} />
                Verified
              </span>
            </div>

            {/* Route stops */}
            <div className="mb-4">
              {offer.etaMinutes || offer.distanceKm ? (
                <div className="flex gap-3 items-start mb-3">
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ring-2 ${isExpress || isPriority ? 'bg-white/40 ring-white/20' : 'bg-slate-400 ring-slate-200'}`} />
                    <div className={`w-px flex-1 my-1 min-h-[20px] ${isExpress || isPriority ? 'bg-white/15' : 'bg-slate-200'}`} />
                  </div>
                  <div className={`flex-1 min-w-0 pb-3 ${isExpress || isPriority ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
                    <p className={`font-bold text-sm ${isExpress || isPriority ? 'text-white' : 'text-[#0F172A]'}`}>
                      {[offer.etaMinutes && `${offer.etaMinutes} min`, offer.distanceKm && `(${offer.distanceKm} km)`]
                        .filter(Boolean).join(' ')} away
                    </p>
                    <p className={`text-xs mt-0.5 leading-snug line-clamp-1 ${isExpress || isPriority ? 'text-white/40' : 'text-slate-500'}`}>
                      {offer.pickupAddress}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3 items-start">
                <div className={`w-2.5 h-2.5 rounded-full ring-2 mt-1 shrink-0 ${isExpress || isPriority ? 'bg-white ring-white/30' : 'bg-[#0F172A] ring-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${isExpress || isPriority ? 'text-white' : 'text-[#0F172A]'}`}>Service location</p>
                  <p className={`text-xs mt-0.5 leading-snug line-clamp-1 ${isExpress || isPriority ? 'text-white/40' : 'text-slate-500'}`}>
                    {offer.pickupAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Job Details — always visible ──────────────────────────── */}
            {(() => {
              const dark = isExpress || isPriority;
              const cardBg = dark ? 'rgba(255,255,255,0.07)' : '#f8fafc';
              const cardBorder = dark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';
              const labelCls = dark ? 'text-white/40' : 'text-slate-400';
              const valueCls = dark ? 'text-white/90' : 'text-slate-700';
              const hasExtra = offer.description || offer.requiredTools?.length > 0 || offer.images?.length > 0;
              return (
                <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  {/* Urgency banner */}
                  {(offer.diagnosisUrgency === 'urgent' || offer.diagnosisUrgency === 'high') && (
                    <div className={`px-3 py-2 flex items-center gap-2 border-b ${offer.diagnosisUrgency === 'urgent'
                      ? 'bg-red-500/20 border-red-500/20'
                      : 'bg-amber-500/20 border-amber-500/20'
                      }`}>
                      <AlertTriangle size={12} strokeWidth={2.5} className={offer.diagnosisUrgency === 'urgent' ? 'text-red-400' : 'text-amber-400'} />
                      <span className={`text-[11px] font-black uppercase tracking-wide ${offer.diagnosisUrgency === 'urgent' ? 'text-red-300' : 'text-amber-300'}`}>
                        {offer.diagnosisUrgency === 'urgent' ? '⚠️ Urgent — prepare for emergency service' : '⚡ High priority — customer needs fast help'}
                      </span>
                    </div>
                  )}

                  <div className="p-3 space-y-2">
                    {/* Always-visible service context row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${labelCls}`}>Service</span>
                        <span className={`text-[12px] font-bold capitalize ${valueCls}`}>
                          {offer.service?.replace(/_/g, ' ')}
                          {(offer.vehicleType || offer.deviceBrand) ? ` · ${offer.vehicleType || offer.deviceBrand}` : ''}
                        </span>
                      </div>
                      {offer.distanceKm && (
                        <span className={`text-[11px] font-bold ${dark ? 'text-white/50' : 'text-slate-400'}`}>{offer.distanceKm} km away</span>
                      )}
                    </div>

                    {/* Customer description */}
                    {offer.description ? (
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelCls}`}>Customer note</p>
                        <p className={`text-[12px] leading-relaxed line-clamp-3 ${valueCls}`}>{offer.description}</p>
                      </div>
                    ) : !hasExtra && (
                      <p className={`text-[11px] italic ${dark ? 'text-white/30' : 'text-slate-400'}`}>No additional details — standard service job</p>
                    )}

                    {/* Required tools */}
                    {offer.requiredTools?.length > 0 && (
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${labelCls}`}>Bring these tools</p>
                        <div className="flex flex-wrap gap-1.5">
                          {offer.requiredTools.map(t => (
                            <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 capitalize ${dark ? 'bg-blue-400/15 text-blue-300 ring-blue-400/25' : 'bg-blue-50 text-blue-700 ring-blue-100'}`}>
                              {t.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customer photos */}
                    {offer.images?.length > 0 && (
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${labelCls}`}>Photos from customer</p>
                        <div className="flex gap-2">
                          {offer.images.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/20"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Accept button */}
            <motion.button
              onClick={onAccept}
              disabled={accepting}
              className="w-full h-[60px] text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 transition-transform"
              style={
                isExpress
                  ? { background: 'linear-gradient(135deg,#4338ca,#6366f1,#818cf8)', boxShadow: '0 8px 32px rgba(99,102,241,0.55)' }
                  : isPriority
                    ? { background: 'linear-gradient(135deg,#92400e,#b45309,#d97706)', boxShadow: '0 8px 32px rgba(180,83,9,0.5)' }
                    : { background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 6px 20px rgba(37,99,235,0.4)' }
              }
              whileTap={{ scale: 0.97 }}
              animate={
                isExpress
                  ? { boxShadow: ['0 8px 32px rgba(99,102,241,0.55)', '0 8px 48px rgba(99,102,241,0.8)', '0 8px 32px rgba(99,102,241,0.55)'] }
                  : isPriority
                    ? { boxShadow: ['0 8px 32px rgba(180,83,9,0.5)', '0 8px 48px rgba(217,119,6,0.75)', '0 8px 32px rgba(180,83,9,0.5)'] }
                    : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {accepting
                ? <Loader2 size={20} className="animate-spin" />
                : isExpress
                  ? <><Zap size={18} strokeWidth={2.5} /> Accept Express Job</>
                  : isPriority
                    ? <><Star size={18} strokeWidth={0} className="fill-white" /> Accept Priority Job</>
                    : 'Accept'}
            </motion.button>

            {/* Decline text link */}
            <button
              onClick={onReject}
              className={`w-full mt-2 py-2 text-[12px] font-semibold transition ${isExpress || isPriority ? 'text-white/35 hover:text-white/55' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Not available right now
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
