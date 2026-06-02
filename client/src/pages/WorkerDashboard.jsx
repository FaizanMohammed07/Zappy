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
  Home, Bike, Fuel, Pencil,
} from 'lucide-react';
import {
  useGetWorkerMeQuery, useGoOnlineMutation, useGoOfflineMutation,
  useGetEarningsQuery, useWorkerAcceptMutation, useWorkerRejectMutation,
  useGetKycStatusQuery, useGetWorkerOrdersQuery, useGetDemandZonesQuery,
  useGetWorkerLeaderboardQuery,
} from '../services/api';
import { useWorkerOfferSocket } from '../hooks/useSocket';
import { setOffer, clearOffer, setOnline, selectWorker } from '../modules/worker/workerSlice';
import { selectAuth, logout } from '../modules/auth/authSlice';
import { useGeolocation } from '../hooks/useGeolocation';
import { getSocket } from '../services/socket';
import { ZappyLogo } from '../components/common/ZappyLogo';
import ShiftSlotsWidget from '../components/worker/ShiftSlotsWidget';
import WellnessWidget from '../components/worker/WellnessWidget';
import EarnedWageWidget from '../components/worker/EarnedWageWidget';
import toast from 'react-hot-toast';

/* ─── Constants (mirror backend incentive.service.js) ─────────── */

const MILESTONES = [
  { jobs: 10,  bonusRs: 200  },
  { jobs: 25,  bonusRs: 500  },
  { jobs: 50,  bonusRs: 1000 },
  { jobs: 100, bonusRs: 2500 },
  { jobs: 200, bonusRs: 5000 },
];

const BADGES = [
  { id: 'first',   label: 'Starter',     Icon: Zap,     threshold: 1   },
  { id: 'five',    label: '5 Jobs',       Icon: Star,    threshold: 5   },
  { id: 'twenty',  label: '25 Jobs',      Icon: Flame,   threshold: 25  },
  { id: 'fifty',   label: 'Elite',        Icon: Gem,     threshold: 50  },
  { id: 'century', label: 'Legend',       Icon: Trophy,  threshold: 100 },
];

const SERVICE_ICON_MAP = {
  // Original
  electrical:            { Icon: Bolt,          bg: 'bg-amber-100',   color: 'text-amber-600'  },
  plumbing:              { Icon: Droplets,       bg: 'bg-blue-100',    color: 'text-blue-600'   },
  ac_repair:             { Icon: Wind,           bg: 'bg-cyan-100',    color: 'text-cyan-600'   },
  carpenter:             { Icon: Hammer,         bg: 'bg-orange-100',  color: 'text-orange-600' },
  helper:                { Icon: Users,          bg: 'bg-green-100',   color: 'text-green-600'  },
  puncture:              { Icon: Car,            bg: 'bg-slate-100',   color: 'text-slate-500'  },
  cleaning:              { Icon: Sparkles,       bg: 'bg-purple-100',  color: 'text-purple-600' },
  painting:              { Icon: Paintbrush2,    bg: 'bg-pink-100',    color: 'text-pink-600'   },
  // Mobile phone
  screen_replacement:    { Icon: Smartphone,     bg: 'bg-indigo-100',  color: 'text-indigo-600' },
  battery_replacement:   { Icon: Battery,        bg: 'bg-emerald-100', color: 'text-emerald-600'},
  charging_issue:        { Icon: Bolt,           bg: 'bg-yellow-100',  color: 'text-yellow-600' },
  speaker_mic_issue:     { Icon: Layers,         bg: 'bg-violet-100',  color: 'text-violet-600' },
  software_issue:        { Icon: Wrench,         bg: 'bg-red-100',     color: 'text-red-600'    },
  water_damage_check:    { Icon: Droplets,       bg: 'bg-sky-100',     color: 'text-sky-600'    },
  // Construction
  mason:                 { Icon: Home,           bg: 'bg-stone-100',   color: 'text-stone-600'  },
  // Car + Bike
  battery_jump_start:    { Icon: Zap,            bg: 'bg-yellow-100',  color: 'text-yellow-600' },
  fuel_delivery:         { Icon: Fuel,           bg: 'bg-orange-100',  color: 'text-orange-600' },
  bike_wash:             { Icon: Bike,           bg: 'bg-cyan-100',    color: 'text-cyan-600'   },
  car_wash:              { Icon: Car,            bg: 'bg-blue-100',    color: 'text-blue-600'   },
  minor_roadside_repair: { Icon: AlertTriangle,  bg: 'bg-red-100',     color: 'text-red-600'    },
};

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

function playOfferAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch {}
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
  const nav      = useNavigate();
  const dispatch = useDispatch();
  const worker   = useSelector(selectWorker);
  const { accessToken: token } = useSelector(selectAuth);

  // 60s poll — profile/availability rarely changes mid-session; socket events drive
  // job-offer state changes, so there's no user-visible lag from a slower REST poll.
  const { data: meData, refetch: refetchMe } = useGetWorkerMeQuery(undefined, { pollingInterval: 60000, skip: !token });
  const { data: todayData }   = useGetEarningsQuery('today',  { skip: !token });
  const { data: weekData }    = useGetEarningsQuery('week',   { skip: !token });
  const { data: kycData }     = useGetKycStatusQuery(undefined, { skip: !token });
  const { data: jobsData }    = useGetWorkerOrdersQuery(1,    { skip: !token });

  const [goOnline]  = useGoOnlineMutation();
  const [goOffline] = useGoOfflineMutation();
  const [acceptOffer, { isLoading: accepting }] = useWorkerAcceptMutation();
  const [rejectOffer] = useWorkerRejectMutation();

  const { getCurrent, watch } = useGeolocation();
  const watchRef   = useRef(null);
  const [myLat, setMyLat] = useState(null);
  const [myLng, setMyLng] = useState(null);
  const [gpsOn,        setGpsOn]        = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [onlineTimer,  setOnlineTimer]  = useState(0); // seconds online this session
  const onlineStart = useRef(null);

  const me          = meData?.worker;
  const isOnline    = me?.isOnline ?? false;
  const isBusy      = isOnline && !!me?.currentOrderId;
  const kycApproved = kycData?.kyc?.status === 'approved';
  const kycStatus   = kycData?.kyc?.status;
  // In dev mode, bypass KYC gate so testing is possible without admin approval
  const canGoOnline = kycApproved || import.meta.env.DEV;

  const completedJobs = me?.completedJobs ?? 0;
  const rating        = me?.rating ?? null; // null until first real rating
  const penalties     = me?.penalties ?? {};
  const totalOffers   = penalties.totalOffers ?? 0;
  const totalRejects  = penalties.totalRejects ?? 0;
  const totalCancels  = penalties.totalCancels ?? 0;

  const hasOfferData  = totalOffers > 0;
  const hasJobData    = completedJobs > 0;
  const hasRatingData = hasJobData && rating !== null;

  const acceptRate  = hasOfferData ? Math.round(((totalOffers - totalRejects) / totalOffers) * 100) : null;
  const cancelRate  = hasJobData   ? Math.round((totalCancels / completedJobs) * 100)               : null;
  const trustScore  = (hasOfferData || hasJobData)
    ? computeTrustScore(acceptRate ?? 100, rating ?? 5, completedJobs)
    : null;

  const chart7d  = getLast7Days(weekData?.dailyBreakdown);
  const chartMax = Math.max(...chart7d.map((d) => d.earningsPaise), 1);
  const hasChartData = chart7d.some((d) => d.earningsPaise > 0);

  const nextMilestone  = MILESTONES.find((m) => m.jobs > completedJobs) ?? null;
  const prevMilestone  = [...MILESTONES].reverse().find((m) => m.jobs <= completedJobs);
  const msProgress     = nextMilestone
    ? Math.round(((completedJobs - (prevMilestone?.jobs ?? 0)) /
        (nextMilestone.jobs - (prevMilestone?.jobs ?? 0))) * 100)
    : 100;

  const todayRs      = todayData?.earningsRupees ?? 0;
  const todayJobs    = todayData?.jobs ?? 0;
  const weekRs       = weekData?.earningsRupees ?? 0;
  const weekAvgRs    = weekData?.avgEarningPerJobRupees ?? 0;
  const totalWallet  = Math.round((me?.wallet?.totalEarnings ?? 0) / 100);

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

  // GPS permission probe
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((r) => {
      setGpsOn(r.state === 'granted');
      r.onchange = () => setGpsOn(r.state === 'granted');
    }).catch(() => {});
  }, []);

  // offer socket + alert
  const handleOffer = useCallback((offer) => {
    dispatch(setOffer(offer));
    playOfferAlert();
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
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
    try { navigator.vibrate?.([300, 100, 300, 100, 300]); } catch {}
    toast.success(`Job assigned to you! ₹${data.price ?? ''}`, { duration: 6000 });
    setTimeout(() => nav(`/worker/jobs/${data.orderId}`), 1500);
  }, [dispatch, nav, refetchMe]);

  // Customer boosted their offer while worker is viewing it — update price live
  const handleOfferBoosted = useCallback((data) => {
    if (worker.currentOffer && String(worker.currentOffer._id) === String(data?.orderId)) {
      dispatch(setOffer({ ...worker.currentOffer, price: data.newTotal, boostedBy: data.rupees }));
      playOfferAlert();
      try { navigator.vibrate?.([60, 40, 100, 40, 150]); } catch {}
    }
  }, [dispatch, worker.currentOffer]);

  useWorkerOfferSocket(handleOffer, handleOfferCancelled, handleForceAssigned, handleOfferBoosted);

  // Continuous location broadcast — socket (fast) + REST fallback (reliable)
  const lastRestRef = useRef(0);
  useEffect(() => {
    if (!isOnline || !token) { watchRef.current?.(); watchRef.current = null; return; }
    const socket = getSocket(token);
    let lastSocket = 0;

    watchRef.current = watch(
      (pos) => {
        setGpsOn(true);
        setMyLat(pos.lat);
        setMyLng(pos.lng);
        const now = Date.now();

        // Socket: every 4s (fast path — keeps geo + alive zset hot)
        if (now - lastSocket >= 4000) {
          lastSocket = now;
          socket.emit('worker:location', { lat: pos.lat, lng: pos.lng, orderId: me?.currentOrderId });
        }

        // REST backup: every 30s (survives socket reconnects, updates Mongo)
        if (now - lastRestRef.current >= 30000) {
          lastRestRef.current = now;
          const locBody = { lat: pos.lat, lng: pos.lng };
          if (me?.currentOrderId) locBody.orderId = me.currentOrderId;
          fetch('/api/workers/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(locBody),
          }).catch(() => {});
        }
      },
      () => setGpsOn(false),
    );
    return () => { watchRef.current?.(); watchRef.current = null; };
  }, [isOnline, token, watch, me?.currentOrderId]);

  async function toggleOnline() {
    if (!canGoOnline) { toast.error('KYC required'); nav('/worker/kyc'); return; }
    if (isBusy) { toast('Finish your active job first'); return; }
    setToggling(true);
    try {
      if (isOnline) {
        await goOffline().unwrap();
        toast.success('You are now offline');
      } else {
        const pos = await getCurrent();
        setGpsOn(true);
        await goOnline({ lat: pos.lat, lng: pos.lng }).unwrap();
        toast.success('You are now online');
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

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Cinematic Header ──────────────────────────────────── */}
      <div className="relative overflow-hidden pb-10" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a5f 100%)' }}>
        {/* Animated orbs */}
        <motion.div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent)' }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.25), transparent)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, delay: 2 }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div className="relative z-10 max-w-lg mx-auto px-5 pt-6 pb-8">
          {/* ── Top bar ─────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-7">
            <ZappyLogo size={26} />
            <motion.button
              onClick={() => { dispatch(logout()); nav('/worker/login'); }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white/50 px-3.5 py-2 rounded-full transition-colors hover:text-white/80"
              style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
              whileTap={{ scale: 0.93 }}
            >
              <LogOut size={12} strokeWidth={2.5} />
              Logout
            </motion.button>
          </div>

          {/* ── Profile row ─────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-7">
            {/* Avatar */}
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.4))',
                border: '2px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
              }}
              animate={{ boxShadow: ['0 0 0 0px rgba(99,102,241,0.35)', '0 0 0 10px rgba(99,102,241,0)', '0 0 0 0px rgba(99,102,241,0)'] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 1 }}
            >
              {initials}
              {/* Online dot */}
              {isOnline && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0f172a]" />
              )}
            </motion.div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-white/45 text-[11px] font-semibold tracking-wide">{getGreeting()}</p>
                <button
                  onClick={() => nav('/worker/profile')}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  title="Edit profile"
                >
                  <Pencil size={11} className="text-white/40" />
                </button>
              </div>
              <p className="text-white font-black text-2xl leading-tight truncate">{me?.name ?? '…'}</p>
              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                  <Star size={10} className="fill-amber-300 stroke-amber-300" />
                  {hasRatingData ? rating.toFixed(1) : 'New'}
                </span>
                <span className="w-px h-3 bg-white/15" />
                <span className="text-white/45 text-xs font-semibold">{completedJobs} jobs</span>
                {me?.skills?.[0] && (
                  <>
                    <span className="w-px h-3 bg-white/15" />
                    <span className="text-white/45 text-xs font-semibold capitalize">{me.skills[0].replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
            </div>

            {/* Verified badge */}
            {kycApproved && (
              <motion.div
                className="flex items-center gap-1.5 px-3 py-2 rounded-full shrink-0"
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  backdropFilter: 'blur(8px)',
                }}
                animate={{ boxShadow: ['0 0 0 0px rgba(34,197,94,0.25)', '0 0 0 6px rgba(34,197,94,0)', '0 0 0 0px rgba(34,197,94,0)'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <BadgeCheck size={13} strokeWidth={2.5} className="text-green-400" />
                <span className="text-[10px] font-extrabold text-green-400 tracking-wide">Verified</span>
              </motion.div>
            )}
          </div>

          {/* ── Earnings strip ─────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.11)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="grid grid-cols-3">
              {[
                { label: 'TODAY', value: todayRs, sub: `${todayJobs} job${todayJobs !== 1 ? 's' : ''}`, highlight: true },
                { label: 'THIS WEEK', value: weekRs, sub: `avg ₹${weekAvgRs}` },
                { label: 'ALL TIME', value: totalWallet, sub: 'total earned' },
              ].map(({ label, value, sub, highlight }, i) => (
                <div
                  key={label}
                  className={`px-4 py-4 ${i === 1 ? 'border-x border-white/10' : ''}`}
                >
                  <p className="text-white/35 text-[9px] font-black uppercase tracking-[0.15em] mb-2">{label}</p>
                  <motion.p
                    className={`font-black text-2xl leading-none tabular-nums ${
                      highlight && (isOnline || isBusy) ? 'text-green-300' : 'text-white'
                    }`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 + 0.15, type: 'spring', stiffness: 300 }}
                  >
                    ₹{value}
                  </motion.p>
                  <p className="text-white/35 text-[10px] mt-1.5 font-medium">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ───────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 mt-4 space-y-3.5 pb-10">

        {/* ── KYC Banner — hidden in dev to unblock testing ──── */}
        {!kycApproved && !import.meta.env.DEV && (
          <motion.button
            onClick={() => nav('/worker/kyc')}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full rounded-2xl p-4 text-left ring-1 ${
              kycStatus === 'rejected' ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                kycStatus === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle size={16} strokeWidth={2} className={kycStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${kycStatus === 'rejected' ? 'text-red-700' : 'text-amber-800'}`}>
                  {kycStatus === 'pending_review' ? 'KYC Under Review — 24h processing'
                   : kycStatus === 'rejected' ? 'KYC Rejected — Tap to resubmit'
                   : 'KYC Required to start accepting jobs'}
                </p>
              </div>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            </div>
          </motion.button>
        )}

        {/* ── Active Job Banner ────────────────────────────────── */}
        {me?.currentOrderId && (
          <motion.button
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => nav(`/worker/jobs/${me.currentOrderId}`)}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-left shadow-lg"
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Active Job</p>
              <p className="text-sm font-bold text-white">Continue working</p>
            </div>
            <ArrowRight size={18} className="text-white/80 shrink-0" />
          </motion.button>
        )}

        {/* ── Online Toggle ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: isBusy
              ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
              : isOnline
                ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                : 'white',
            border: isOnline ? '1px solid rgba(34,197,94,0.25)' : isBusy ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isOnline ? '0 4px 24px rgba(34,197,94,0.12)' : '0 2px 12px rgba(0,0,0,0.05)',
          }}
        >
          {/* Animated green bar on top when online */}
          {isOnline && (
            <div className="h-0.5 w-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: '60%' }}
              />
            </div>
          )}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  isBusy ? 'bg-amber-100' : isOnline ? 'bg-green-100' : 'bg-slate-100'
                }`}
                animate={isOnline && !isBusy ? {
                  boxShadow: ['0 0 0 0px rgba(34,197,94,0.4)', '0 0 0 10px rgba(34,197,94,0)', '0 0 0 0px rgba(34,197,94,0)']
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isBusy
                  ? <Briefcase size={20} strokeWidth={1.75} className="text-amber-600" />
                  : isOnline
                    ? <Navigation size={20} strokeWidth={1.75} className="text-green-600" />
                    : <WifiOff size={20} strokeWidth={1.75} className="text-slate-400" />}
              </motion.div>
              <div>
                <p className={`font-black text-base ${isOnline ? 'text-green-800' : isBusy ? 'text-amber-800' : 'text-slate-800'}`}>
                  {isBusy ? 'On a job' : isOnline ? 'Online · Accepting jobs' : 'Offline'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <motion.div
                    className={`w-1.5 h-1.5 rounded-full ${gpsOn ? 'bg-green-500' : 'bg-red-400'}`}
                    animate={gpsOn ? { opacity: [1, 0.4, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <p className="text-[11px] text-slate-500 font-medium">
                    {gpsOn ? 'GPS active' : 'GPS off'}
                    {fmtTimer && <span className="text-green-600 font-bold"> · {fmtTimer}</span>}
                  </p>
                </div>
              </div>
            </div>

            {!isBusy && (
              <motion.button
                onClick={toggleOnline}
                disabled={toggling || !canGoOnline}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 shrink-0 disabled:opacity-50 ${
                  isOnline ? 'bg-green-500' : 'bg-slate-200'
                }`}
                style={{ boxShadow: isOnline ? '0 4px 16px rgba(34,197,94,0.4)' : 'none' }}
                whileTap={{ scale: 0.93 }}
              >
                {toggling
                  ? <Loader2 size={14} className="absolute inset-0 m-auto animate-spin text-white" />
                  : (
                    <motion.span
                      className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                      animate={{ left: isOnline ? 'calc(100% - 28px)' : '4px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )
                }
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── Earnings Chart ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">7-Day Earnings</p>
              {hasChartData && (
                <motion.p
                  className="text-xl font-black text-slate-900 mt-0.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  ₹{weekRs}
                </motion.p>
              )}
            </div>
            <motion.button
              onClick={() => nav('/wallet')}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 px-3 py-1.5 rounded-xl bg-indigo-50"
              whileTap={{ scale: 0.94 }}
            >
              Full history <ChevronRight size={10} strokeWidth={3} />
            </motion.button>
          </div>

          {hasChartData ? (
            <div className="px-4 pb-5">
              {/* Bars — fixed 104px zone, labels float above via absolute */}
              <div className="flex items-end gap-2" style={{ height: 104 }}>
                {chart7d.map((d, i) => {
                  const barH = Math.max(Math.round((d.earningsPaise / chartMax) * 88), 4);
                  const isToday = i === chart7d.length - 1;
                  const rs = Math.round(d.earningsPaise / 100);
                  return (
                    <div key={d.date} className="flex-1 relative flex items-end">
                      {isToday && rs > 0 && (
                        <motion.p
                          className="absolute -top-5 left-0 right-0 text-center text-[9px] font-black text-indigo-600"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                        >
                          ₹{rs}
                        </motion.p>
                      )}
                      <motion.div
                        className="w-full rounded-lg"
                        initial={{ height: 0 }}
                        animate={{ height: barH }}
                        transition={{ duration: 0.5, delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                        style={{
                          background: isToday
                            ? 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)'
                            : 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
                          boxShadow: isToday ? '0 4px 14px rgba(99,102,241,0.4)' : 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Day labels — own row, never overlaps bars */}
              <div className="flex gap-2 mt-2.5">
                {chart7d.map((d, i) => {
                  const isToday = i === chart7d.length - 1;
                  const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                  const dayLabel = DAY[new Date(d.date + 'T00:00').getDay()];
                  return (
                    <span
                      key={d.date}
                      className={`flex-1 text-center text-[9px] font-bold ${
                        isToday ? 'text-indigo-500' : 'text-slate-300'
                      }`}
                    >
                      {isToday ? 'Today' : dayLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <BarChart2 size={32} strokeWidth={1} className="text-slate-100" />
              <p className="text-sm font-bold text-slate-300">No earnings yet this week</p>
              <p className="text-xs text-slate-300">Go online to start earning</p>
            </div>
          )}
        </motion.div>

        {/* ── Trust Score + Next Milestone row ────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Trust Score */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11 }}
            className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center gap-2"
          >
            <TrustScoreRing score={trustScore} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Trust Score</p>
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              {trustScore === null
                ? 'Complete jobs to earn score'
                : trustScore >= 80 ? 'Excellent — top partner'
                : trustScore >= 60 ? 'Good standing'
                : 'Needs improvement'}
            </p>
          </motion.div>

          {/* Milestone */}
          {nextMilestone ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="bg-amber-50 rounded-2xl p-4 shadow-sm ring-1 ring-amber-100 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Trophy size={14} strokeWidth={2} className="text-amber-600" />
                </div>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide leading-tight">
                  Next Bonus
                </p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-amber-700 leading-none">₹{nextMilestone.bonusRs}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {nextMilestone.jobs - completedJobs} more jobs
                </p>
              </div>
              <div className="mt-2.5 w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-amber-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${msProgress}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
              <p className="text-[9px] text-amber-500 mt-1">{completedJobs}/{nextMilestone.jobs} jobs</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 shadow-sm ring-1 ring-purple-100 flex flex-col items-center justify-center gap-2"
            >
              <Trophy size={24} strokeWidth={1.5} className="text-purple-500" />
              <p className="text-xs font-bold text-purple-700 text-center">All Milestones Reached</p>
            </motion.div>
          )}
        </div>

        {/* ── Badges ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Achievements</p>
          <div className="grid grid-cols-5 gap-2">
            {BADGES.map(({ id, label, Icon, threshold }) => {
              const earned = completedJobs >= threshold;
              return (
                <div key={id} className="flex flex-col items-center gap-1.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    earned
                      ? 'bg-gradient-to-br from-amber-100 to-orange-100 ring-1 ring-amber-200 shadow-sm'
                      : 'bg-slate-100'
                  }`}>
                    <Icon
                      size={20}
                      strokeWidth={earned ? 2 : 1.5}
                      className={earned ? 'text-amber-600' : 'text-slate-300'}
                    />
                  </div>
                  <p className={`text-[9px] font-bold text-center leading-tight ${
                    earned ? 'text-amber-700' : 'text-slate-300'
                  }`}>{label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Earned Wage Access ───────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.155 }}>
          <EarnedWageWidget />
        </motion.div>

        {/* ── Shift Slots (Predictive Availability) ────────────── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <ShiftSlotsWidget currentLat={myLat} currentLng={myLng} />
        </motion.div>

        {/* ── Wellness System ───────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
          <WellnessWidget />
        </motion.div>

        {/* ── Performance ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Performance</p>
          <div className="space-y-3">
            <PerformanceRow
              label="Acceptance Rate"
              value={acceptRate}
              max={100}
              display={acceptRate !== null ? `${acceptRate}%` : null}
              noDataLabel="No offers yet"
              good={acceptRate !== null && acceptRate >= 80}
              warn={acceptRate !== null && acceptRate < 60}
              trackColor={
                acceptRate === null ? 'bg-slate-200'
                : acceptRate >= 80 ? 'bg-green-500'
                : acceptRate >= 60 ? 'bg-amber-400'
                : 'bg-red-500'
              }
            />
            <PerformanceRow
              label="Cancellation Rate"
              value={cancelRate !== null ? cancelRate : null}
              max={100}
              display={cancelRate !== null ? `${cancelRate}%` : null}
              noDataLabel="No jobs yet"
              good={cancelRate !== null && cancelRate <= 5}
              warn={cancelRate !== null && cancelRate > 15}
              trackColor={
                cancelRate === null ? 'bg-slate-200'
                : cancelRate <= 5 ? 'bg-green-500'
                : cancelRate <= 15 ? 'bg-amber-400'
                : 'bg-red-500'
              }
              invert
            />
            <PerformanceRow
              label="Customer Rating"
              value={hasRatingData ? rating : null}
              max={5}
              display={hasRatingData ? `${rating.toFixed(1)} / 5.0` : null}
              noDataLabel="Not rated yet"
              good={hasRatingData && rating >= 4.5}
              warn={hasRatingData && rating < 3.5}
              trackColor={
                !hasRatingData ? 'bg-slate-200'
                : rating >= 4.5 ? 'bg-amber-400'
                : rating >= 4 ? 'bg-blue-500'
                : 'bg-red-500'
              }
            />
          </div>

          {(acceptRate !== null && acceptRate < 70) || (cancelRate !== null && cancelRate > 20) ? (
            <div className="mt-3 flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2.5 ring-1 ring-red-100">
              <AlertTriangle size={13} strokeWidth={2} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium leading-snug">
                {acceptRate !== null && acceptRate < 70
                  ? 'Low acceptance rate reduces job visibility. Try to accept more offers.'
                  : 'High cancellation rate may result in account penalties.'}
              </p>
            </div>
          ) : !hasOfferData && !hasJobData ? (
            <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5 ring-1 ring-blue-100">
              <ShieldCheck size={13} strokeWidth={2} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 font-medium leading-snug">
                Your performance stats will appear here after your first job.
              </p>
            </div>
          ) : null}
        </motion.div>

        {/* ── Recent Jobs ──────────────────────────────────────── */}
        <RecentJobsList orders={jobsData?.orders} onNav={nav} />

        {/* ── Leaderboard ──────────────────────────────────────── */}
        <LeaderboardWidget workerId={me?._id} />

        {/* ── Demand Zones ─────────────────────────────────────── */}
        {isOnline && <DemandZonesWidget />}

        {/* ── Quick Actions ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => nav('/plans')}
            className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 text-left ring-1 ring-amber-100 active:scale-[0.97] transition"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-2.5">
              <TrendingUp size={16} strokeWidth={2} className="text-amber-600" />
            </div>
            <p className="font-bold text-sm text-[#0F172A]">Go Pro</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Lower commission</p>
          </button>
          <button
            onClick={() => nav('/wallet')}
            className="bg-white rounded-2xl p-4 text-left ring-1 ring-slate-100 shadow-sm active:scale-[0.97] transition"
          >
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-2.5">
              <BadgeIndianRupee size={16} strokeWidth={2} className="text-green-600" />
            </div>
            <p className="font-bold text-sm text-[#0F172A]">Wallet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">₹{totalWallet} total</p>
          </button>
        </motion.div>
      </div>

      {/* ── Offer Modal ──────────────────────────────────────── */}
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
  );
}

/* ─── Trust Score Ring ───────────────────────────────────────── */

function TrustScoreRing({ score }) {
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const isNew = score === null;
  const displayScore = isNew ? 0 : score;
  const offset = circ * (1 - displayScore / 100);
  const color  = isNew ? '#CBD5E1' : score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444';

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
          <p className={`text-xs font-bold ${
            noData ? 'text-slate-300'
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
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  order.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
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
  const myRank  = data?.myRank?.rank  ?? 12;
  const total   = data?.myRank?.total ?? 847;
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
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isHighlighted ? 'bg-indigo-50' : ''
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
  very_high: { label: 'Very High', bg: 'bg-red-50',   ring: 'ring-red-100',   dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-400'    },
  high:      { label: 'High',      bg: 'bg-amber-50', ring: 'ring-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-400'  },
  medium:    { label: 'Moderate',  bg: 'bg-blue-50',  ring: 'ring-blue-100',  dot: 'bg-blue-400',  text: 'text-blue-700',  bar: 'bg-blue-300'   },
  low:       { label: 'Low',       bg: 'bg-slate-50', ring: 'ring-slate-100', dot: 'bg-slate-300', text: 'text-slate-500', bar: 'bg-slate-200'  },
};

function DemandZonesWidget() {
  const [expanded, setExpanded] = useState(false);
  const [coords, setCoords]     = useState(null);

  // Real GPS — watch position while component is mounted
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
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
        {[0,1,2,3,4,5].map((i) => (
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

function OfferModal({ offer, onAccept, onReject, accepting }) {
  const totalSec = offer.expiresAt
    ? Math.min(30, Math.max(1, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)))
    : 30;

  const [left, setLeft] = useState(totalSec);
  const totalRef = useRef(totalSec);

  useEffect(() => {
    const expires = offer.expiresAt
      ? new Date(offer.expiresAt).getTime()
      : Date.now() + totalSec * 1000;
    const tick = () => {
      const l = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) onReject();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [offer, onReject]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = left / totalRef.current;
  const urgent   = left <= 6;

  const svc     = SERVICE_ICON_MAP[offer.service] || { Icon: Wrench, bg: 'bg-slate-100', color: 'text-slate-600' };
  const SvcIcon = svc.Icon;

  /* Static map centred on pickup — shown as map background */
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [pickLng, pickLat] = offer.pickupCoords || [0, 0];
  const mapUrl = mapboxToken && pickLng && pickLat
    ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
      `pin-l+1d4ed8(${pickLng},${pickLat})/` +
      `${pickLng},${pickLat},14,0/800x500@2x` +
      `?access_token=${mapboxToken}&attribution=false&logo=false`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
    >
      {/* Map fills the top half */}
      <div className="flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
        {mapUrl ? (
          <img src={mapUrl} alt="map" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <motion.div
              className="w-32 h-32 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <MapPin size={36} strokeWidth={1.5} className="text-indigo-400 absolute" />
          </div>
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)' }} />
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
        {/* NEW JOB banner */}
        <motion.div
          className="absolute top-4 left-4 px-3.5 py-2 rounded-2xl backdrop-blur-md"
          style={{ background: 'rgba(99,102,241,0.8)', border: '1px solid rgba(99,102,241,0.4)' }}
          animate={{ boxShadow: ['0 0 0 0px rgba(99,102,241,0.4)', '0 0 0 12px rgba(99,102,241,0)', '0 0 0 0px rgba(99,102,241,0)'] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="text-white font-black text-xs tracking-widest">⚡ NEW JOB</span>
        </motion.div>
      </div>

      {/* Bottom card slides up */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 360 }}
        className="relative z-10 rounded-t-[32px] -mt-8"
        style={{ background: 'white', boxShadow: '0 -16px 60px rgba(0,0,0,0.25)' }}
      >
        {/* Animated progress bar */}
        <div className="absolute top-0 inset-x-0 h-1 rounded-t-[32px] overflow-hidden bg-slate-100">
          <motion.div
            className="h-full absolute left-0 top-0 rounded-full"
            style={{ background: urgent ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #6366f1, #0ea5e9)' }}
            animate={{ width: `${Math.max(0, progress * 100)}%` }}
            transition={{ duration: 0.25, ease: 'linear' }}
          />
        </div>

        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-0" />

        <div className="px-5 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Service label + dismiss */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-12 h-12 rounded-2xl ${svc.bg} flex items-center justify-center shrink-0`}
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <SvcIcon size={22} strokeWidth={1.75} className={svc.color} />
              </motion.div>
              <div>
                <p className="font-black text-slate-900 text-lg capitalize leading-tight">
                  {offer.service.replace(/_/g, ' ')}
                </p>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ring-1 ring-indigo-100">
                  Exclusive to you
                </span>
              </div>
            </div>
            <motion.button
              onClick={onReject}
              className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0"
              whileTap={{ scale: 0.9 }}
            >
              <X size={18} strokeWidth={2.5} className="text-slate-500" />
            </motion.button>
          </div>

          {/* Price — highlights with boost badge when customer boosts live */}
          <div className="flex items-center gap-2 mb-1">
            <motion.p
              key={offer.price}
              className={`font-black leading-none tabular-nums ${urgent ? 'text-red-600' : offer.boostedBy ? 'text-orange-600' : 'text-slate-900'}`}
              style={{ fontSize: 52 }}
              animate={offer.boostedBy
                ? { scale: [1, 1.18, 1], color: ['#ea580c', '#f97316', '#ea580c'] }
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
                <span className="text-[9px] font-bold text-orange-500 mt-0.5">Customer boosted offer!</span>
              </motion.div>
            ) : (
              <Zap size={24} strokeWidth={2.5} className={urgent ? 'text-red-500' : 'text-blue-600'} />
            )}
          </div>

          {/* Rating + Verified */}
          <div className="flex items-center gap-3 mb-5">
            <span className="flex items-center gap-1 text-sm font-bold text-[#0F172A]">
              <Star size={14} strokeWidth={0} className="fill-amber-400" />
              4.9
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-blue-600">
              <BadgeCheck size={15} strokeWidth={2.5} className="text-blue-600" />
              Verified
            </span>
          </div>

          {/* Route stops — Uber style vertical connector */}
          <div className="mb-5">
            {offer.etaMinutes || offer.distanceKm ? (
              <div className="flex gap-3 items-start mb-3">
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />
                  <div className="w-px flex-1 bg-slate-200 my-1 min-h-[20px]" />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-slate-100">
                  <p className="font-bold text-[#0F172A] text-sm">
                    {[offer.etaMinutes && `${offer.etaMinutes} min`, offer.distanceKm && `(${offer.distanceKm} km)`]
                      .filter(Boolean).join(' ')} away
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-1">
                    {offer.pickupAddress}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex gap-3 items-start">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0F172A] ring-2 ring-slate-300 mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0F172A] text-sm">Service location</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-1">
                  {offer.pickupAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Accept */}
          <motion.button
            onClick={onAccept}
            disabled={accepting}
            className="w-full h-[56px] bg-blue-600 text-white font-extrabold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-60"
            whileTap={{ scale: 0.98 }}
          >
            {accepting
              ? <Loader2 size={20} className="animate-spin" />
              : 'Accept'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
