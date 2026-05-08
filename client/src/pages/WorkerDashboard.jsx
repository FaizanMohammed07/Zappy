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
  ArrowDownRight, Minus,
} from 'lucide-react';
import {
  useGetWorkerMeQuery, useGoOnlineMutation, useGoOfflineMutation,
  useGetEarningsQuery, useWorkerAcceptMutation, useWorkerRejectMutation,
  useGetKycStatusQuery, useGetWorkerOrdersQuery, useGetDemandZonesQuery,
} from '../services/api';
import { useWorkerOfferSocket } from '../hooks/useSocket';
import { setOffer, clearOffer, setOnline, selectWorker } from '../modules/worker/workerSlice';
import { selectAuth, logout } from '../modules/auth/authSlice';
import { useGeolocation } from '../hooks/useGeolocation';
import { getSocket } from '../services/socket';
import { ZappyLogo } from '../components/common/ZappyLogo';
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
  electrical: { Icon: Bolt,        bg: 'bg-amber-100',  color: 'text-amber-600'  },
  plumbing:   { Icon: Droplets,    bg: 'bg-blue-100',   color: 'text-blue-600'   },
  ac_repair:  { Icon: Wind,        bg: 'bg-cyan-100',   color: 'text-cyan-600'   },
  carpenter:  { Icon: Hammer,      bg: 'bg-orange-100', color: 'text-orange-600' },
  helper:     { Icon: Users,       bg: 'bg-green-100',  color: 'text-green-600'  },
  puncture:   { Icon: Car,         bg: 'bg-slate-100',  color: 'text-slate-500'  },
  cleaning:   { Icon: Sparkles,    bg: 'bg-purple-100', color: 'text-purple-600' },
  painting:   { Icon: Paintbrush2, bg: 'bg-pink-100',   color: 'text-pink-600'   },
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

  const { data: meData, refetch: refetchMe } = useGetWorkerMeQuery(undefined, { pollingInterval: 15000 });
  const { data: todayData }   = useGetEarningsQuery('today');
  const { data: weekData }    = useGetEarningsQuery('week');
  const { data: kycData }     = useGetKycStatusQuery();
  const { data: jobsData }    = useGetWorkerOrdersQuery(1);

  const [goOnline]  = useGoOnlineMutation();
  const [goOffline] = useGoOfflineMutation();
  const [acceptOffer, { isLoading: accepting }] = useWorkerAcceptMutation();
  const [rejectOffer] = useWorkerRejectMutation();

  const { getCurrent, watch } = useGeolocation();
  const watchRef   = useRef(null);
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

  useWorkerOfferSocket(handleOffer, handleOfferCancelled, handleForceAssigned);

  // Continuous location broadcast — socket (fast) + REST fallback (reliable)
  const lastRestRef = useRef(0);
  useEffect(() => {
    if (!isOnline || !token) { watchRef.current?.(); watchRef.current = null; return; }
    const socket = getSocket(token);
    let lastSocket = 0;

    watchRef.current = watch(
      (pos) => {
        setGpsOn(true);
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

      {/* ── Gradient Header ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#1565c0] pb-8">
        <div className="max-w-lg mx-auto px-4 pt-5">

          {/* top bar */}
          <div className="flex items-center justify-between mb-5">
            <ZappyLogo size={24} />
            <button
              onClick={() => { dispatch(logout()); nav('/worker/login'); }}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60 border border-white/20 px-3 py-1.5 rounded-full hover:bg-white/10 transition"
            >
              <LogOut size={11} strokeWidth={2} />
              Logout
            </button>
          </div>

          {/* profile row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-extrabold text-xl shrink-0 ring-2 ring-white/30">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-xs font-medium">{getGreeting()}</p>
              <p className="text-white font-extrabold text-xl leading-tight truncate">{me?.name ?? '…'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                  <Star size={10} className="fill-amber-300" />
                  {hasRatingData ? rating.toFixed(1) : 'New'}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/60 text-xs">{completedJobs} jobs</span>
                {me?.skills?.[0] && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-white/60 text-xs capitalize">{me.skills[0].replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
            </div>
            {kycApproved && (
              <div className="flex items-center gap-1 bg-green-500/20 border border-green-400/30 px-2.5 py-1.5 rounded-full shrink-0">
                <BadgeCheck size={12} strokeWidth={2.5} className="text-green-300" />
                <span className="text-[10px] font-bold text-green-300">Verified</span>
              </div>
            )}
          </div>

          {/* earnings hero strip */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 grid grid-cols-3 divide-x divide-white/10">
            <div className="pr-3">
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">Today</p>
              <p className="text-white font-extrabold text-2xl leading-none">₹{todayRs}</p>
              <p className="text-white/50 text-[10px] mt-1">{todayJobs} jobs</p>
            </div>
            <div className="px-3">
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">This Week</p>
              <p className="text-white font-extrabold text-2xl leading-none">₹{weekRs}</p>
              <p className="text-white/50 text-[10px] mt-1">avg ₹{weekAvgRs}</p>
            </div>
            <div className="pl-3">
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">All Time</p>
              <p className="text-white font-extrabold text-2xl leading-none">₹{totalWallet}</p>
              <p className="text-white/50 text-[10px] mt-1">total earned</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ───────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3 pb-10">

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
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                isBusy ? 'bg-amber-50' : isOnline ? 'bg-green-50' : 'bg-slate-100'
              }`}>
                {isBusy
                  ? <Briefcase size={18} strokeWidth={2} className="text-amber-600" />
                  : isOnline
                    ? <Navigation size={18} strokeWidth={2} className="text-green-600" />
                    : <WifiOff size={18} strokeWidth={2} className="text-slate-400" />}
              </div>
              <div>
                <p className="font-bold text-[#0F172A] text-sm">
                  {isBusy ? 'Currently on a job' : isOnline ? 'Online — accepting jobs' : 'Offline'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${gpsOn ? 'bg-green-500' : 'bg-red-400'}`} />
                  <p className="text-[10px] text-slate-400 font-medium">
                    {gpsOn ? 'GPS active' : 'GPS off'}
                    {fmtTimer && ` · ${fmtTimer}`}
                  </p>
                </div>
              </div>
            </div>

            {!isBusy && (
              <button
                onClick={toggleOnline}
                disabled={toggling || !canGoOnline}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 shrink-0 disabled:opacity-50 ${
                  isOnline ? 'bg-green-500' : 'bg-slate-200'
                }`}
              >
                {toggling
                  ? <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />
                  : <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
                      isOnline ? 'left-[calc(100%-26px)]' : 'left-0.5'
                    }`} />
                }
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Earnings Chart ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">7-Day Earnings</p>
            <button onClick={() => nav('/wallet')} className="text-xs font-bold text-blue-600 flex items-center gap-0.5">
              Full history <ChevronRight size={10} strokeWidth={2.5} />
            </button>
          </div>

          {hasChartData ? (
            <div className="flex items-end gap-2" style={{ height: 72 }}>
              {chart7d.map((d, i) => {
                const barH = Math.max(Math.round((d.earningsPaise / chartMax) * 56), 3);
                const isToday = i === chart7d.length - 1;
                const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                const dayLabel = DAY[new Date(d.date + 'T00:00').getDay()];
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                    {isToday && d.earningsPaise > 0 && (
                      <p className="text-[8px] font-bold text-blue-600">₹{Math.round(d.earningsPaise / 100)}</p>
                    )}
                    <motion.div
                      className={`w-full rounded-lg ${isToday ? 'bg-blue-600' : 'bg-slate-200'}`}
                      initial={{ height: 0 }}
                      animate={{ height: barH }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
                    />
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                      {isToday ? 'Now' : dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <BarChart2 size={28} strokeWidth={1.5} className="text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">No earnings yet this week</p>
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

        {/* ── Performance ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
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
      <div className="flex-1 relative bg-slate-300 overflow-hidden">
        {mapUrl
          ? <img src={mapUrl} alt="map" className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 flex items-center justify-center">
              <MapPin size={36} strokeWidth={1.5} className="text-slate-400" />
            </div>
          )
        }
        {/* Countdown pill — top right of map */}
        <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm ${urgent ? 'bg-red-500' : 'bg-[#0F172A]/80'}`}>
          <Clock size={12} strokeWidth={2.5} className="text-white" />
          <span className="text-white font-extrabold text-sm tabular-nums">{left}s</span>
        </div>
      </div>

      {/* Bottom card slides up */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
        className="bg-white rounded-t-[28px] -mt-7 shadow-[0_-8px_40px_rgba(0,0,0,0.15)] relative z-10"
      >
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 h-1 rounded-t-[28px] overflow-hidden bg-slate-100">
          <motion.div
            className={`h-full absolute left-0 top-0 ${urgent ? 'bg-red-500' : 'bg-blue-600'}`}
            animate={{ width: `${Math.max(0, progress * 100)}%` }}
            transition={{ duration: 0.25, ease: 'linear' }}
          />
        </div>

        <div className="px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">

          {/* Service label + Exclusive badge + X dismiss */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl ${svc.bg} flex items-center justify-center shrink-0`}>
                <SvcIcon size={20} strokeWidth={1.75} className={svc.color} />
              </div>
              <div>
                <p className="font-extrabold text-[#0F172A] text-base capitalize leading-tight">
                  {offer.service.replace(/_/g, ' ')}
                </p>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Exclusive
                </span>
              </div>
            </div>
            <button
              onClick={onReject}
              className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0 hover:bg-slate-200 transition active:scale-95"
            >
              <X size={18} strokeWidth={2.5} className="text-slate-500" />
            </button>
          </div>

          {/* Price + surge icon */}
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-[52px] font-extrabold leading-none tabular-nums ${urgent ? 'text-red-600' : 'text-[#0F172A]'}`}>
              ₹{offer.price}
            </p>
            <Zap size={24} strokeWidth={2.5} className={urgent ? 'text-red-500' : 'text-blue-600'} />
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
