import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Share2, MessageCircle, Link2, Gift,
  Users, Clock, IndianRupee, ChevronRight, ArrowLeft,
  UserCheck, Sparkles, CircleDot, GitBranch,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { selectAuth } from '../modules/auth/authSlice';
import {
  useGetReferralCodeQuery,
  useGetReferralHistoryQuery,
} from '../services/api';
import {
  pageVariants, pageTransition, staggerContainer, fadeInUp, fadeIn, scaleIn,
} from '../lib/animations';

// ── helpers ──────────────────────────────────────────────────────────────────

function rupees(paise) {
  return Math.floor((paise || 0) / 100);
}

function maskName(name = '') {
  if (!name || name.length <= 2) return name || '---';
  return name[0] + '*'.repeat(Math.max(name.length - 2, 3)) + name[name.length - 1];
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

// ── Floating particle / orb background ───────────────────────────────────────

const ORBS = [
  { w: 320, h: 320, x: '-10%', y: '-20%', color: '#6366f1', blur: 80, opacity: 0.18, dur: 8 },
  { w: 240, h: 240, x: '70%',  y: '10%',  color: '#8b5cf6', blur: 60, opacity: 0.14, dur: 11 },
  { w: 180, h: 180, x: '20%',  y: '55%',  color: '#3b82f6', blur: 50, opacity: 0.12, dur: 9  },
  { w: 140, h: 140, x: '85%',  y: '60%',  color: '#a78bfa', blur: 40, opacity: 0.10, dur: 13 },
];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: `${Math.floor(Math.random() * 95)}%`,
  y: `${Math.floor(Math.random() * 90)}%`,
  size: 2 + (i % 3),
  dur: 4 + (i % 5),
  delay: i * 0.4,
}));

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.w,
            height: orb.h,
            left: orb.x,
            top: orb.y,
            background: orb.color,
            filter: `blur(${orb.blur}px)`,
            opacity: orb.opacity,
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [orb.opacity, orb.opacity * 1.5, orb.opacity] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{ width: p.size, height: p.size, left: p.x, top: p.y, opacity: 0.25 }}
          animate={{ opacity: [0.1, 0.5, 0.1], y: [0, -12, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Reward Tree (SVG + framer-motion) ────────────────────────────────────────

const TREE_NODES = [
  { id: 'root', cx: 120, cy: 160, label: 'You',   r: 22, delay: 0 },
  { id: 'n1',   cx: 60,  cy: 90,  label: null,     r: 16, delay: 0.3 },
  { id: 'n2',   cx: 180, cy: 90,  label: null,     r: 16, delay: 0.5 },
  { id: 'n3',   cx: 30,  cy: 35,  label: null,     r: 12, delay: 0.8 },
  { id: 'n4',   cx: 100, cy: 35,  label: null,     r: 12, delay: 1.0 },
];

const TREE_EDGES = [
  { x1: 120, y1: 138, x2: 60,  y2: 106, delay: 0.2 },
  { x1: 120, y1: 138, x2: 180, y2: 106, delay: 0.4 },
  { x1: 60,  y1: 74,  x2: 30,  y2: 47,  delay: 0.7 },
  { x1: 60,  y1: 74,  x2: 100, y2: 47,  delay: 0.9 },
];

function RewardTree({ count = 0 }) {
  // show nodes progressively based on referral count (max 4 beyond root)
  const visibleNodes = Math.min(count, 4);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="240" height="180" viewBox="0 0 240 180" fill="none">
        {/* Edges */}
        {TREE_EDGES.map((e, i) => {
          const show = i < visibleNodes;
          return (
            <motion.line
              key={i}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={show ? { opacity: 0.6, pathLength: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5, delay: show ? e.delay : 0 }}
            />
          );
        })}

        {/* Nodes */}
        {TREE_NODES.map((n, i) => {
          const isRoot = n.id === 'root';
          const show = isRoot || i <= visibleNodes;
          return (
            <motion.g key={n.id}>
              <motion.circle
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                fill={isRoot ? '#6366f1' : '#312e81'}
                stroke={isRoot ? '#a5b4fc' : '#6366f1'}
                strokeWidth={isRoot ? 2.5 : 1.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={show ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20, delay: n.delay }}
              />
              {isRoot && (
                <motion.circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r + 6}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              )}
              {show && !isRoot && (
                <motion.circle
                  cx={n.cx}
                  cy={n.cy}
                  r={4}
                  fill="#a5b4fc"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.4, 1] }}
                  transition={{ delay: n.delay + 0.15, duration: 0.4 }}
                />
              )}
              {isRoot && (
                <motion.text
                  x={n.cx}
                  y={n.cy + 4}
                  textAnchor="middle"
                  fill="#e0e7ff"
                  fontSize={10}
                  fontWeight="600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  You
                </motion.text>
              )}
            </motion.g>
          );
        })}
      </svg>
      <p className="text-xs text-indigo-300">
        {count === 0
          ? 'Invite friends to grow your tree'
          : `${count} friend${count !== 1 ? 's' : ''} joined — tree growing`}
      </p>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { icon: Share2,    title: 'Share your code',   desc: 'Send your unique referral code to friends and family.' },
  { icon: UserCheck, title: 'Friend books',       desc: 'They sign up and complete their first booking.' },
  { icon: Gift,      title: 'You both earn',      desc: 'You get ₹150 wallet credit. They get ₹50 off.' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReferralPage() {
  const navigate = useNavigate();
  const auth = useSelector(selectAuth);

  const { data: referralData, isLoading } = useGetReferralCodeQuery(undefined, {
    skip: !auth.accessToken,
  });
  const { data: historyData } = useGetReferralHistoryQuery(undefined, {
    skip: !auth.accessToken,
  });

  const code = referralData?.code ?? 'LOADING';
  const stats = referralData?.stats ?? { totalReferrals: 0, pendingReferrals: 0, earnedPaise: 0 };
  const history = historyData?.referrals ?? [];

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const linkTimerRef = useRef(null);

  const referralLink = `${window.location.origin}/signup?ref=${code}`;

  function handleCopyCode() {
    if (!code || code === 'LOADING') return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Code copied!');
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2200);
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setLinkCopied(true);
      toast.success('Link copied!');
      clearTimeout(linkTimerRef.current);
      linkTimerRef.current = setTimeout(() => setLinkCopied(false), 2200);
    });
  }

  function handleWebShare() {
    if (navigator.share) {
      navigator.share({
        title: 'Join Zappy — get ₹50 off your first service',
        text: `Use my code ${code} on Zappy and save ₹50 on your first home service booking!`,
        url: referralLink,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Use my Zappy referral code *${code}* and get ₹50 off your first home service booking!\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const earned = rupees(stats.earnedPaise);

  return (
    <motion.div
      className="min-h-screen bg-slate-950 text-white pb-40"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 pt-12 pb-16 px-5 overflow-hidden">
        <HeroBackground />

        {/* Back button */}
        <motion.button
          className="relative z-10 flex items-center gap-1.5 text-indigo-300 mb-8"
          onClick={() => navigate(-1)}
          whileTap={{ scale: 0.94 }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </motion.button>

        <motion.div
          className="relative z-10 max-w-md mx-auto text-center"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 tracking-wide uppercase"
          >
            <Sparkles size={13} />
            Refer &amp; Earn
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-3xl font-extrabold tracking-tight text-white mb-3 leading-snug"
          >
            Invite friends,
            <br />
            <span className="text-indigo-300">earn ₹100 each</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-indigo-200/80 text-sm leading-relaxed"
          >
            Share your code. When a friend books their <span className="text-white font-semibold">first service</span>,
            you earn ₹100 — and they get ₹50 added to their wallet automatically.
          </motion.p>

          {/* Pending bonus callout */}
          {stats.pendingReferrals > 0 && (
            <motion.div
              variants={fadeInUp}
              className="mt-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3"
            >
              <span className="text-xl">⏳</span>
              <div>
                <p className="text-xs font-black text-amber-400 uppercase tracking-wide">Bonus Waiting</p>
                <p className="text-sm font-bold text-white">
                  {stats.pendingReferrals} friend{stats.pendingReferrals > 1 ? 's' : ''} signed up — waiting for their first order
                </p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  ₹{stats.pendingReferrals * 100} locked in — unlocks when they book
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-8 space-y-5">

        {/* ── Referral Code Card ─────────────────────────────────── */}
        <motion.div
          variants={scaleIn}
          initial="initial"
          animate="animate"
          className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl shadow-indigo-950/40"
        >
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
            Your referral code
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1 bg-indigo-950/60 border border-indigo-500/40 rounded-xl px-4 py-3 flex items-center justify-center">
              {isLoading ? (
                <div className="h-7 w-28 bg-indigo-800/40 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-black tracking-[0.18em] text-indigo-100 select-all">
                  {code}
                </span>
              )}
            </div>

            <motion.button
              onClick={handleCopyCode}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
              whileTap={{ scale: 0.94 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Check size={16} className="text-green-300" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Copy size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
              {copied ? 'Copied' : 'Copy'}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Stats Row ──────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-3 gap-3"
        >
          {[
            { Icon: Users,       label: 'Joined',   value: stats.totalReferrals,   color: 'text-violet-400' },
            { Icon: IndianRupee, label: 'Earned',   value: `₹${earned}`,           color: 'text-emerald-400' },
            { Icon: Clock,       label: 'Pending',  value: stats.pendingReferrals, color: 'text-amber-400' },
          ].map(({ Icon, label, value, color }) => (
            <motion.div
              key={label}
              variants={fadeInUp}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center gap-1.5"
            >
              <Icon size={18} className={color} />
              <span className={`text-lg font-bold ${color}`}>{value}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Share Section ─────────────────────────────────────── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Share with friends
          </p>

          <div className="flex flex-col gap-3">
            <motion.button
              onClick={handleWebShare}
              className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-3.5 rounded-xl transition-colors w-full"
              whileTap={{ scale: 0.97 }}
            >
              <Share2 size={17} />
              Share via apps
              <ChevronRight size={15} className="ml-auto opacity-60" />
            </motion.button>

            <motion.button
              onClick={handleWhatsApp}
              className="flex items-center gap-3 bg-[#1a3a28] hover:bg-[#1f4a31] border border-green-700/40 text-green-300 font-semibold text-sm px-4 py-3.5 rounded-xl transition-colors w-full"
              whileTap={{ scale: 0.97 }}
            >
              <MessageCircle size={17} />
              Send on WhatsApp
              <ChevronRight size={15} className="ml-auto opacity-60" />
            </motion.button>

            <motion.button
              onClick={handleCopyLink}
              className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-sm px-4 py-3.5 rounded-xl transition-colors w-full"
              whileTap={{ scale: 0.97 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {linkCopied ? (
                  <motion.span key="lc" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check size={17} className="text-green-400" />
                  </motion.span>
                ) : (
                  <motion.span key="ll" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Link2 size={17} />
                  </motion.span>
                )}
              </AnimatePresence>
              {linkCopied ? 'Link copied!' : 'Copy referral link'}
              <ChevronRight size={15} className="ml-auto opacity-60" />
            </motion.button>
          </div>
        </motion.div>

        {/* ── Reward Tree ───────────────────────────────────────── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={16} className="text-indigo-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Your reward network
            </p>
          </div>
          <RewardTree count={stats.totalReferrals} />
        </motion.div>

        {/* ── How It Works ──────────────────────────────────────── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
            How it works
          </p>

          <div className="relative">
            {/* vertical connector */}
            <div className="absolute left-[19px] top-6 bottom-6 w-px bg-indigo-500/20" />

            <div className="space-y-5">
              {STEPS.map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.28 }}
                >
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center">
                    <Icon size={16} className="text-indigo-400" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Referral History ──────────────────────────────────── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Referral history
          </p>

          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CircleDot size={32} className="text-slate-700" />
              <p className="text-sm text-slate-600">No referrals yet</p>
              <p className="text-xs text-slate-700 max-w-[220px]">
                Share your code and your referrals will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item, i) => (
                <motion.div
                  key={item._id ?? i}
                  className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-3 py-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.22 }}
                >
                  {/* avatar */}
                  <div className="w-9 h-9 rounded-full bg-indigo-900 border border-indigo-600/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-300">
                      {(item.name || '?')[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {maskName(item.name)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Joined {item.joinedAt ? timeAgo(item.joinedAt) : '—'}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    {item.earnedPaise > 0 ? (
                      <span className="text-sm font-bold text-emerald-400">
                        +₹{rupees(item.earnedPaise)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Bottom CTA ────────────────────────────────────────── */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="pt-2 pb-4"
        >
          <motion.button
            onClick={handleWebShare}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-3 transition-all"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
          >
            <Gift size={20} />
            Invite &amp; Earn ₹150
          </motion.button>
          <p className="text-center text-xs text-slate-600 mt-3">
            Credited to your Zappy wallet after friend's first booking completes.
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}
