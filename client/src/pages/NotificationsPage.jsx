import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bell, CheckCheck, Package, CreditCard,
  Zap, MapPin, Star, Gift, ShieldCheck, AlertTriangle,
  MessageCircle, Wallet, Trophy, Clock, ChevronRight, Sparkles,
} from 'lucide-react';
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../services/api';
import PageTransition from '../components/common/PageTransition';
import toast from 'react-hot-toast';

/* ── Type → visual config ────────────────────────────────────────── */
const TYPE_CONFIG = {
  order_placed:         { emoji: '🎉', label: 'New Order',      grad: 'from-blue-500 to-indigo-600',   ring: 'ring-blue-100',   bg: 'bg-blue-50'   },
  worker_assigned:      { emoji: '⚡', label: 'Worker Found',   grad: 'from-indigo-500 to-purple-600', ring: 'ring-indigo-100', bg: 'bg-indigo-50' },
  worker_on_the_way:    { emoji: '🛵', label: 'On the Way',     grad: 'from-sky-500 to-blue-600',      ring: 'ring-sky-100',    bg: 'bg-sky-50'    },
  worker_arriving_soon: { emoji: '📍', label: 'Almost Here',    grad: 'from-green-500 to-emerald-600', ring: 'ring-green-100',  bg: 'bg-green-50'  },
  worker_arrived:       { emoji: '✅', label: 'Worker Arrived', grad: 'from-green-500 to-teal-600',    ring: 'ring-green-100',  bg: 'bg-green-50'  },
  order_completed:      { emoji: '🏆', label: 'Completed',      grad: 'from-amber-500 to-orange-600',  ring: 'ring-amber-100',  bg: 'bg-amber-50'  },
  order_cancelled:      { emoji: '❌', label: 'Cancelled',      grad: 'from-red-500 to-rose-600',      ring: 'ring-red-100',    bg: 'bg-red-50'    },
  order_failed:         { emoji: '⚠️', label: 'Failed',         grad: 'from-red-500 to-orange-600',    ring: 'ring-red-100',    bg: 'bg-red-50'    },
  rating_request:       { emoji: '⭐', label: 'Rate Service',   grad: 'from-amber-400 to-yellow-500',  ring: 'ring-amber-100',  bg: 'bg-amber-50'  },
  wallet_credited:      { emoji: '💰', label: 'Money In',       grad: 'from-green-500 to-emerald-500', ring: 'ring-green-100',  bg: 'bg-green-50'  },
  cashback_received:    { emoji: '🎁', label: 'Cashback',       grad: 'from-pink-500 to-rose-500',     ring: 'ring-pink-100',   bg: 'bg-pink-50'   },
  referral_reward:      { emoji: '🎊', label: 'Referral Bonus', grad: 'from-purple-500 to-indigo-500', ring: 'ring-purple-100', bg: 'bg-purple-50' },
  kyc_approved:         { emoji: '🛡️', label: 'KYC Approved',  grad: 'from-green-600 to-teal-600',    ring: 'ring-green-100',  bg: 'bg-green-50'  },
  kyc_rejected:         { emoji: '🚫', label: 'KYC Issue',      grad: 'from-red-500 to-rose-600',      ring: 'ring-red-100',    bg: 'bg-red-50'    },
  late_arrival_penalty: { emoji: '⏱️', label: 'Penalty',        grad: 'from-red-600 to-orange-600',    ring: 'ring-red-100',    bg: 'bg-red-50'    },
  trip_started:         { emoji: '🚀', label: 'Trip Started',   grad: 'from-indigo-500 to-blue-600',   ring: 'ring-indigo-100', bg: 'bg-indigo-50' },
  refund_processed:     { emoji: '💸', label: 'Refund',         grad: 'from-green-500 to-teal-500',    ring: 'ring-green-100',  bg: 'bg-green-50'  },
  promotional:          { emoji: '🔥', label: 'Offer',          grad: 'from-orange-500 to-red-500',    ring: 'ring-orange-100', bg: 'bg-orange-50' },
  system_alert:         { emoji: '🔔', label: 'Alert',          grad: 'from-slate-500 to-slate-700',   ring: 'ring-slate-100',  bg: 'bg-slate-50'  },
};
const DEFAULT_CFG = { emoji: '🔔', label: 'Notification', grad: 'from-slate-500 to-slate-700', ring: 'ring-slate-100', bg: 'bg-slate-50' };

/* ── Time helpers ─────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return Math.floor(h / 24) === 1 ? 'Yesterday' : `${Math.floor(h / 24)}d ago`;
}

function groupByDay(items) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups    = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    if (d >= today)          groups.today.push(n);
    else if (d >= yesterday) groups.yesterday.push(n);
    else                     groups.earlier.push(n);
  }
  return groups;
}

/* ── Animated empty state ─────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[65vh] gap-6 text-center px-8">
      {/* Orbiting rings + bell */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Rings */}
        {[60, 80, 100].map((size, i) => (
          <motion.div
            key={size}
            className="absolute rounded-full border border-slate-200"
            style={{ width: size, height: size }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 2.4 + i * 0.6, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
        {/* Center icon */}
        <motion.div
          className="relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)' }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Bell size={32} strokeWidth={1.5} className="text-slate-400" />
          {/* Tiny particle dots */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <motion.div
              key={deg}
              className="absolute w-1.5 h-1.5 rounded-full bg-indigo-300"
              style={{ top: '50%', left: '50%' }}
              animate={{
                x: [0, Math.cos((deg * Math.PI) / 180) * 44],
                y: [0, Math.sin((deg * Math.PI) / 180) * 44],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      </div>

      <div>
        <motion.p
          className="font-black text-[#0F172A] text-xl mb-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          All caught up! ✨
        </motion.p>
        <motion.p
          className="text-sm text-slate-400 leading-relaxed"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Order updates, payments, offers — everything<br />shows up here in real time.
        </motion.p>
      </div>

      {/* Preview cards */}
      <motion.div
        className="w-full max-w-xs space-y-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        {[
          { emoji: '⚡', text: 'Worker assigned — Sufiyan (4.8★)', sub: 'On the way · ETA 6 min' },
          { emoji: '💰', text: '₹180 credited to wallet', sub: 'Cashback from your last order' },
          { emoji: '🎉', text: 'Order placed successfully', sub: 'Puncture repair · ₹140' },
        ].map((item, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white ring-1 ring-slate-100 text-left"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)', opacity: 1 - i * 0.25 }}
            animate={{ x: [4, 0] }}
            transition={{ delay: 0.4 + i * 0.1 }}
          >
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{item.text}</p>
              <p className="text-[10px] text-slate-400 truncate">{item.sub}</p>
            </div>
          </motion.div>
        ))}
        <p className="text-[10px] text-slate-300 text-center pt-1">Preview — your real notifications appear above</p>
      </motion.div>
    </div>
  );
}

/* ── Single notification card ────────────────────────────────────── */
function NotifCard({ n, onTap, isNew }) {
  const cfg   = TYPE_CONFIG[n.type] || DEFAULT_CFG;
  const unread = !n.readAt;

  return (
    <motion.button
      onClick={() => onTap(n)}
      className={`w-full text-left flex items-start gap-3 px-4 py-4 transition-colors relative ${
        unread ? 'bg-white' : 'bg-slate-50/60'
      }`}
      initial={isNew ? { x: -20, opacity: 0 } : false}
      animate={{ x: 0, opacity: 1 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Unread left-border accent */}
      {unread && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full bg-gradient-to-b from-indigo-400 to-purple-500" />
      )}

      {/* Emoji icon with gradient background */}
      <div className="relative shrink-0">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl`}
          style={{ background: `linear-gradient(135deg,var(--tw-gradient-from),var(--tw-gradient-to))` }}
        >
          <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${cfg.grad} flex items-center justify-center`}>
            <span className="text-xl">{cfg.emoji}</span>
          </div>
        </div>
        {unread && (
          <motion.div
            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-white"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.ring} ring-1 uppercase tracking-wide text-slate-600`}>
            {cfg.label}
          </span>
        </div>
        <p className={`text-sm leading-snug ${unread ? 'font-bold text-[#0F172A]' : 'font-medium text-slate-600'}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.body}</p>
        )}
        <p className="text-[10px] text-slate-300 mt-1.5 font-medium">{timeAgo(n.createdAt)}</p>
      </div>

      {/* Arrow if has deepLink */}
      {n.deepLink && (
        <ChevronRight size={14} strokeWidth={2} className="text-slate-300 mt-1.5 shrink-0" />
      )}
    </motion.button>
  );
}

/* ── Section header ───────────────────────────────────────────────── */
function SectionLabel({ label }) {
  return (
    <div className="px-4 pt-5 pb-2 flex items-center gap-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const nav = useNavigate();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const { data, isLoading, isFetching } = useListNotificationsQuery({ page: 1, unreadOnly: filter === 'unread' });
  const [markRead]   = useMarkNotificationReadMutation();
  const [markAllMut] = useMarkAllNotificationsReadMutation();

  // Backend returns { items, unread } — map to what the page uses
  const notifications = data?.items || [];
  const unreadCount   = data?.unread ?? 0;

  async function handleMarkAll() {
    try { await markAllMut().unwrap(); toast.success('All marked as read'); }
    catch { toast.error('Failed'); }
  }

  async function handleTap(n) {
    if (!n.readAt) await markRead(n._id).unwrap().catch(() => {});
    if (n.deepLink) nav(n.deepLink);
  }

  const groups = groupByDay(notifications);
  const hasAny = notifications.length > 0;

  return (
    <PageTransition>
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f0f4ff 0%,#f9fafb 120px)' }}>

        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <motion.button
              onClick={() => nav(-1)}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
              whileTap={{ scale: 0.92 }}
            >
              <ArrowLeft size={18} strokeWidth={2.5} className="text-slate-700" />
            </motion.button>

            <div className="flex-1">
              <p className="font-black text-[#0F172A] text-base">Notifications</p>
              {unreadCount > 0 && (
                <p className="text-[10px] text-indigo-500 font-bold">{unreadCount} unread</p>
              )}
            </div>

            {unreadCount > 0 && (
              <motion.button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl ring-1 ring-indigo-100"
                whileTap={{ scale: 0.95 }}
              >
                <CheckCheck size={12} strokeWidth={2.5} />
                Mark all read
              </motion.button>
            )}
          </div>

          {/* Filter tabs */}
          {hasAny && (
            <div className="px-4 pb-3 flex gap-2">
              {[['all', 'All'], ['unread', 'Unread']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    filter === key
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {label}
                  {key === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isFetching && <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-purple-500 animate-pulse" />}
        </header>

        {/* Content */}
        {isLoading ? (
          /* Skeleton */
          <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 bg-white rounded-2xl ring-1 ring-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded-full w-3/4 animate-pulse" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasAny ? (
          <EmptyState />
        ) : (
          <div className="max-w-lg mx-auto">
            {/* Today */}
            {groups.today.length > 0 && (
              <div>
                <SectionLabel label="Today" />
                <div className="mx-4 rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100 divide-y divide-slate-50" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  {groups.today.map((n) => (
                    <NotifCard key={n._id} n={n} onTap={handleTap} isNew />
                  ))}
                </div>
              </div>
            )}

            {/* Yesterday */}
            {groups.yesterday.length > 0 && (
              <div>
                <SectionLabel label="Yesterday" />
                <div className="mx-4 rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100 divide-y divide-slate-50" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  {groups.yesterday.map((n) => (
                    <NotifCard key={n._id} n={n} onTap={handleTap} />
                  ))}
                </div>
              </div>
            )}

            {/* Earlier */}
            {groups.earlier.length > 0 && (
              <div>
                <SectionLabel label="Earlier" />
                <div className="mx-4 rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100 divide-y divide-slate-50" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  {groups.earlier.map((n) => (
                    <NotifCard key={n._id} n={n} onTap={handleTap} />
                  ))}
                </div>
              </div>
            )}

            <div className="h-20" />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
