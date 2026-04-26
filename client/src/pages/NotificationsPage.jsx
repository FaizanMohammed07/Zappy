import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Package, CreditCard, FileText, Info, CheckCheck } from 'lucide-react';
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../services/api';
import PageTransition from '../components/common/PageTransition';
import { SkeletonList, SkeletonNotification } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const TYPE_CONFIG = {
  order_update: { Icon: Package,     bg: 'bg-blue-50',    icon: 'text-blue-600' },
  offer:        { Icon: Bell,        bg: 'bg-zappy-50',   icon: 'text-zappy-600' },
  payment:      { Icon: CreditCard,  bg: 'bg-green-50',   icon: 'text-green-600' },
  kyc:          { Icon: FileText,    bg: 'bg-amber-50',   icon: 'text-amber-600' },
  system:       { Icon: Info,        bg: 'bg-slate-100',  icon: 'text-slate-500' },
};

const DEFAULT_TYPE = { Icon: Bell, bg: 'bg-slate-100', icon: 'text-slate-500' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}

export default function NotificationsPage() {
  const nav = useNavigate();
  const { data, isLoading } = useListNotificationsQuery({});
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAll() {
    try {
      await markAll().unwrap();
    } catch {
      toast.error('Failed to mark all as read');
    }
  }

  async function handleTap(n) {
    if (!n.read) await markRead(n._id).unwrap().catch(() => {});
    if (n.link) nav(n.link);
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9FAFB]">
        <header className="page-header">
          <div className="page-header-inner">
            <motion.button
              onClick={() => nav(-1)}
              className="back-btn"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </motion.button>
            <h1 className="h-card flex-1">Notifications</h1>
            {unreadCount > 0 && (
              <motion.button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-zappy-600"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <CheckCheck size={13} strokeWidth={2.5} />
                Mark all read
              </motion.button>
            )}
          </div>
        </header>

        {isLoading ? (
          <div className="page-container pt-2">
            <SkeletonList count={6} Item={SkeletonNotification} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-8">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Bell size={28} strokeWidth={1.5} className="text-slate-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.1 }}
            >
              <p className="font-bold text-[#0F172A] text-lg">All caught up</p>
              <p className="text-sm text-slate-400 mt-1">No new notifications right now</p>
            </motion.div>
          </div>
        ) : (
          <div className="page-container">
            {unreadCount > 0 && (
              <div className="pt-4 pb-2">
                <p className="text-xs font-semibold text-slate-400">{unreadCount} unread</p>
              </div>
            )}
            <motion.div
              className="bg-white rounded-card shadow-card ring-1 ring-slate-100 overflow-hidden divide-y divide-slate-100"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || DEFAULT_TYPE;
                const { Icon } = cfg;
                return (
                  <motion.button
                    key={n._id}
                    onClick={() => handleTap(n)}
                    className={`w-full text-left px-4 py-4 flex items-start gap-3 transition ${
                      !n.read ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-50'
                    }`}
                    variants={fadeInUp}
                    whileTap={{ scale: 0.995 }}
                  >
                    <motion.div
                      className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}
                      whileHover={{ scale: 1.1 }}
                    >
                      <Icon size={18} strokeWidth={1.75} className={cfg.icon} />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.read ? 'font-semibold text-[#0F172A]' : 'font-medium text-slate-600'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{n.body}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-zappy-600 mt-1.5 shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
