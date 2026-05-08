import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { ClipboardList, ChevronRight, Circle, ChevronLeft, FileDown, Star, Calendar, Loader2 } from 'lucide-react';
import { useListOrdersQuery } from '../services/api';
import { selectAuth } from '../modules/auth/authSlice';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonList, SkeletonOrderCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  created:     { label: 'Placed',       cls: 'chip-neutral' },
  searching:   { label: 'Searching',    cls: 'chip-blue'    },
  assigned:    { label: 'Assigned',     cls: 'chip-blue'    },
  on_the_way:  { label: 'On the Way',   cls: 'chip-blue'    },
  arrived:     { label: 'Arrived',      cls: 'chip-blue'    },
  in_progress: { label: 'In Progress',  cls: 'chip-success' },
  completed:   { label: 'Completed',    cls: 'chip-success' },
  cancelled:   { label: 'Cancelled',    cls: 'chip-red'     },
  failed:      { label: 'Failed',       cls: 'chip-red'     },
};

const ACTIVE    = new Set(['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress']);
const COMPLETED = new Set(['completed']);
const PAST      = new Set(['completed', 'cancelled', 'failed']);

const FILTER_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'past',      label: 'Cancelled' },
];

export default function OrdersListPage() {
  const nav = useNavigate();
  const { accessToken: token } = useSelector(selectAuth);
  const [page, setPage]               = useState(1);
  const [filter, setFilter]           = useState('all');
  const [downloadingId, setDownloadingId] = useState(null);
  const { data, isLoading, isFetching } = useListOrdersQuery(page);

  async function downloadInvoice(e, orderId) {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download invoice');
      }
      const html  = await res.text();
      const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url   = URL.createObjectURL(blob);
      // Open in a new tab so the user can print/save
      const win   = window.open(url, '_blank', 'noopener');
      if (!win) {
        // Popup blocked — fall back to file download
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${orderId.slice(-8)}.html`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(err.message || 'Could not download invoice');
    } finally {
      setDownloadingId(null);
    }
  }

  const allOrders  = data?.orders || [];
  const totalPages = data?.totalPages || 1;

  const orders = allOrders.filter((o) => {
    if (filter === 'active')    return ACTIVE.has(o.status);
    if (filter === 'completed') return COMPLETED.has(o.status);
    if (filter === 'past')      return o.status === 'cancelled' || o.status === 'failed';
    return true;
  });

  return (
    <PageTransition>
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f9fafb 120px)' }}>
        <header className="sticky top-0 z-20 backdrop-blur-md" style={{ background: 'rgba(15,23,42,0.97)' }}>
          <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
            <h1 className="font-black text-white flex-1 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-400" />
              My Bookings
            </h1>
            {data?.total != null && (
              <span className="text-[11px] font-bold text-white/50 bg-white/10 px-2.5 py-1 rounded-full">{data.total} total</span>
            )}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          {/* Filter tabs */}
          <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 flex gap-2 pb-3 pt-2 overflow-x-auto no-scrollbar">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setFilter(tab.id); setPage(1); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  filter === tab.id
                    ? 'bg-white text-[#0F172A]'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {tab.label}
                {tab.id === 'active' && allOrders.filter(o => ACTIVE.has(o.status)).length > 0 && (
                  <span className="ml-1.5 bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                    {allOrders.filter(o => ACTIVE.has(o.status)).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-4">
            <SkeletonList count={5} Item={SkeletonOrderCard} />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-8 text-center">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ClipboardList size={28} strokeWidth={1.5} className="text-slate-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.1 }}
            >
              <p className="font-bold text-[#0F172A] text-lg">No bookings yet</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Your past and active bookings<br />will appear here
              </p>
            </motion.div>
            <motion.button
              onClick={() => nav('/services')}
              className="btn-primary mt-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.18 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Book a Service
            </motion.button>
          </div>
        ) : (
          <motion.div
            className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-4 space-y-2.5"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {orders.map((order) => {
              const chip     = STATUS_MAP[order.status] || STATUS_MAP.created;
              const isActive = ACTIVE.has(order.status);
              const isCompleted = order.status === 'completed';
              const isScheduled = !!order.scheduledAt && new Date(order.scheduledAt) > new Date(order.createdAt);

              return (
                <motion.div
                  key={order._id}
                  className="rounded-2xl bg-white ring-1 ring-slate-100 overflow-hidden"
                  style={{ boxShadow: isActive ? '0 4px 20px rgba(37,99,235,0.1)' : '0 2px 8px rgba(0,0,0,0.04)' }}
                  variants={fadeInUp}
                  whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(15,23,42,0.1)' }}
                >
                  {/* Active indicator strip */}
                  {isActive && (
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
                  )}
                  {isCompleted && (
                    <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                  )}

                  <button
                    onClick={() => nav(`/orders/${order._id}`)}
                    className="w-full flex items-start gap-3 p-4 text-left"
                  >
                    {isActive && (
                      <div className="mt-1.5 shrink-0">
                        <Circle size={8} className="text-blue-500 fill-blue-500 animate-pulse" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0F172A] capitalize text-sm">
                            {order.service.replace(/_/g, ' ')}
                            {order.subCategory && (
                              <span className="ml-1.5 text-[10px] font-semibold text-slate-400 normal-case">
                                · {order.subCategory.replace(/_/g, ' ')}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {order.pickupLocation?.address}
                          </p>
                          {isScheduled && (
                            <p className="text-[10px] font-bold text-blue-600 mt-0.5 flex items-center gap-1">
                              <Calendar size={9} />
                              {new Date(order.scheduledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          )}
                        </div>
                        <span className={`chip ${chip.cls} shrink-0 text-[10px] font-bold`}>{chip.label}</span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        <div className="flex items-center gap-2">
                          {order.userRating && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <Star size={9} className="fill-amber-400 text-amber-400" />
                              {order.userRating}
                            </span>
                          )}
                          <p className="font-black text-[#0F172A] text-sm">₹{order.pricing?.total ?? '—'}</p>
                          <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center">
                            <ChevronRight size={12} className="text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Invoice download */}
                  {isCompleted && (
                    <div className="px-4 pb-3 border-t border-slate-50 flex items-center justify-between mt-1">
                      <button
                        onClick={(e) => downloadInvoice(e, order._id)}
                        disabled={downloadingId === order._id}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition disabled:opacity-60 mt-2"
                      >
                        {downloadingId === order._id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <FileDown size={11} strokeWidth={2.5} />}
                        {downloadingId === order._id ? 'Generating…' : 'Download Invoice'}
                      </button>
                      {order.userRating == null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); nav(`/orders/${order._id}`); }}
                          className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition mt-2"
                        >
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          Rate Service
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 pb-4">
                <motion.button
                  disabled={page === 1 || isFetching}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                  Previous
                </motion.button>
                <span className="text-xs font-semibold text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <motion.button
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Next
                  <ChevronRight size={13} strokeWidth={2.5} />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        <BottomNav active="bookings" />
      </div>
    </PageTransition>
  );
}
