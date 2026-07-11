import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Star, Repeat2, Calendar, FileDown, Loader2, MapPin, ArrowRight, ChevronLeft, ChevronRight,
  Bike, Car, Smartphone, Laptop, Tv, Heart, PartyPopper, Wrench } from 'lucide-react';
import { useListOrdersQuery } from '../services/api';
import { ErrorState } from '../components/common/QueryState';
import PullToRefresh from '../components/common/PullToRefresh';
import { API_BASE } from '../services/apiBase';
import { selectAuth } from '../modules/auth/authSlice';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonList, SkeletonOrderCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ACTIVE = new Set(['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress']);

const STATUS_MAP = {
  created: 'Placed', searching: 'Searching', assigned: 'Assigned', on_the_way: 'On the way',
  arrived: 'Arrived', in_progress: 'In progress', completed: 'Completed',
  cancelled: 'Cancelled', failed: 'Failed',
};

function mapSnapshot(order) {
  const c = order.pickupLocation?.coordinates;
  if (!MAPBOX_TOKEN || !c?.length) return null;
  const [lng, lat] = c;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/`
    + `pin-l+2563eb(${lng},${lat})/${lng},${lat},14.5,0/640x320@2x`
    + `?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
}

function fmtDate(d) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

// Service-type icon for the compact rows (like Uber's auto/bike thumbnails).
function serviceVisual(code = '') {
  const s = code.toLowerCase();
  if (/bike|puncture|chain|brake|scooter/.test(s))                         return { Icon: Bike, bg: 'bg-orange-50', color: 'text-orange-600' };
  if (/car|wash|detail|fuel|jump|breakdown|auto|van|fleet|vehicle/.test(s)) return { Icon: Car, bg: 'bg-blue-50', color: 'text-blue-600' };
  if (/screen|battery|charging|phone|mic|speaker|camera|water|software|device|data_recovery/.test(s)) return { Icon: Smartphone, bg: 'bg-violet-50', color: 'text-violet-600' };
  if (/laptop/.test(s))                                                     return { Icon: Laptop, bg: 'bg-indigo-50', color: 'text-indigo-600' };
  if (/cctv|tv|router|smart|home_automation|lock/.test(s))                 return { Icon: Tv, bg: 'bg-cyan-50', color: 'text-cyan-600' };
  if (/elder|medicine|grocery|hospital|companion|doctor|bill|document/.test(s)) return { Icon: Heart, bg: 'bg-rose-50', color: 'text-rose-600' };
  if (/event/.test(s))                                                      return { Icon: PartyPopper, bg: 'bg-amber-50', color: 'text-amber-600' };
  return { Icon: Wrench, bg: 'bg-slate-100', color: 'text-slate-600' };
}

/* ─── Compact past-trip row (icon + details + Rebook) ─────────────────────── */
function CompactRow({ order, nav }) {
  const { Icon, bg, color } = serviceVisual(order.service);
  const cancelled = order.status === 'cancelled' || order.status === 'failed';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-slate-100 last:border-0 group cursor-pointer" onClick={() => nav(`/orders/${order._id}`)}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bg}`}>
          <Icon size={24} className={color} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-[#0F172A] capitalize leading-tight truncate text-base group-hover:text-blue-600 transition-colors">{order.service?.replace(/_/g, ' ')}</p>
          <p className="text-sm font-medium text-slate-500 mt-1">{fmtDate(order.createdAt)}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-bold text-[#0F172A]">₹{order.pricing?.total ?? '0.00'}</span>{cancelled ? ' · Cancelled' : ''}
          </p>
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); nav(`/book/${order.service}`); }}
        className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0F172A] shrink-0 hover:bg-slate-100 transition-colors">
        <Repeat2 size={16} /> Rebook
      </button>
    </div>
  );
}

/* ─── Premium past-trip card (Uber-style) ─────────────────────────────────── */
function PastCard({ order, nav, onInvoice, downloadingId }) {
  const url = mapSnapshot(order);
  const isCancelled = order.status === 'cancelled' || order.status === 'failed';
  const isCompleted = order.status === 'completed';

  return (
    <motion.div variants={fadeInUp} className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      <button onClick={() => nav(`/orders/${order._id}`)} className="block w-full text-left relative overflow-hidden group">
        {url ? (
          <img src={url} alt="trip map" className="w-full h-48 sm:h-56 md:h-64 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-48 sm:h-56 md:h-64 bg-slate-100 flex items-center justify-center">
            <MapPin size={32} className="text-slate-300" />
          </div>
        )}
      </button>
      <div className="p-5 sm:p-6 md:p-8 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-bold text-[#0F172A] text-xl sm:text-2xl capitalize leading-tight tracking-tight">{order.service?.replace(/_/g, ' ')}</h3>
          {order.userRating && (
            <span className="inline-flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full text-sm font-bold text-amber-600 border border-amber-100">
              <Star size={14} className="fill-amber-500 text-amber-500" /> {order.userRating}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2">{fmtDate(order.createdAt)}</p>
        <p className="text-sm sm:text-base text-slate-500 mt-1">
          <span className="font-bold text-[#0F172A]">₹{order.pricing?.total ?? '0.00'}</span>
          <span className="mx-2 text-slate-300">•</span>
          {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : STATUS_MAP[order.status] || ''}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 pt-6 border-t border-slate-100">
          {isCompleted && order.userRating == null && (
            <button onClick={() => nav(`/orders/${order._id}`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 active:bg-slate-100 transition-colors">
              <Star size={16} /> Rate
            </button>
          )}
          <button onClick={() => nav(`/book/${order.service}`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-black text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-slate-900 active:bg-slate-800 transition-colors">
            <Repeat2 size={16} /> Rebook
          </button>
          {isCompleted && (
            <button onClick={(e) => onInvoice(e, order._id)} disabled={downloadingId === order._id}
              className="flex-1 sm:flex-none sm:ml-auto flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50">
              {downloadingId === order._id ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              Invoice
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Active/upcoming card ────────────────────────────────────────────────── */
function UpcomingCard({ order, nav }) {
  return (
    <motion.button variants={fadeInUp} onClick={() => nav(`/orders/${order._id}`)}
      className="block w-full text-left rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 p-5 sm:p-6 transition-colors group">
      <div className="flex items-start sm:items-center gap-4">
        <div className="relative shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50">
          <span className="relative block w-3.5 h-3.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0F172A] text-lg sm:text-xl capitalize group-hover:text-blue-600 transition-colors">{order.service?.replace(/_/g, ' ')}</p>
          <p className="text-sm font-medium text-slate-500 truncate mt-1">{order.pickupLocation?.address}</p>
        </div>
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 shrink-0 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">{STATUS_MAP[order.status]}</span>
      </div>
      <div className="flex items-center justify-between mt-5 pt-5 border-t border-slate-100">
        <span className="font-bold text-[#0F172A] text-xl">₹{order.pricing?.total ?? '—'}</span>
        <span className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50/50 px-4 py-2 rounded-xl group-hover:bg-blue-50 transition-colors">Track <ArrowRight size={16} /></span>
      </div>
    </motion.button>
  );
}

export default function OrdersListPage() {
  const nav = useNavigate();
  const { accessToken: token } = useSelector(selectAuth);
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState(null);
  const { data, isLoading, isFetching, isError, refetch } = useListOrdersQuery(page);

  async function downloadInvoice(e, orderId) {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to download invoice'); }
      const blob = new Blob([await res.text()], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener');
      if (!win) { const a = document.createElement('a'); a.href = url; a.download = `invoice-${orderId.slice(-8)}.html`; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { toast.error(err.message || 'Could not download invoice'); }
    finally { setDownloadingId(null); }
  }

  const allOrders = data?.orders || [];
  const totalPages = data?.totalPages || 1;
  const upcoming = allOrders.filter((o) => ACTIVE.has(o.status));
  const past = allOrders.filter((o) => !ACTIVE.has(o.status));

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F8FAFC] pb-40">
       <div className="mx-auto w-full max-w-[480px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1200px] transition-all duration-300">
        <PullToRefresh onRefresh={() => refetch()}>
        <header className="px-4 sm:px-6 md:px-8 pt-12 pb-6 md:pt-16 md:pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight">Activity</h1>
        </header>

        {isError ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <div className="px-4 sm:px-6 md:px-8 pt-4"><SkeletonList count={4} Item={SkeletonOrderCard} /></div>
        ) : allOrders.length === 0 ? (
          <div className="px-4 sm:px-6 md:px-8 pt-2 max-w-2xl">
            <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] mb-4">Upcoming</h2>
            <button onClick={() => nav('/services')} className="w-full text-left rounded-3xl bg-white border border-slate-200 p-6 md:p-8 flex items-center justify-between hover:bg-slate-50 transition-colors group">
              <div>
                <p className="font-bold text-[#0F172A] text-lg md:text-xl">No upcoming bookings</p>
                <p className="text-sm md:text-base font-semibold text-blue-600 mt-2 flex items-center gap-1 group-hover:gap-2 transition-all">Book a service <ArrowRight size={16} /></p>
              </div>
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                <Calendar size={28} className="text-slate-400" />
              </div>
            </button>
          </div>
        ) : (
          <motion.div className="px-4 sm:px-6 md:px-8 pt-2 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12" variants={staggerContainer} initial="initial" animate="animate">
            {/* Upcoming */}
            <section className="lg:col-span-5 xl:col-span-4">
              <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] mb-4 md:mb-5">Upcoming</h2>
              {upcoming.length === 0 ? (
                <button onClick={() => nav('/services')} className="w-full text-left rounded-3xl bg-white border border-slate-200 p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div>
                    <p className="font-bold text-[#0F172A] text-lg">No upcoming bookings</p>
                    <p className="text-sm font-semibold text-blue-600 mt-1.5 flex items-center gap-1 group-hover:gap-2 transition-all">Book a service <ArrowRight size={16} /></p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Calendar size={26} className="text-slate-400" />
                  </div>
                </button>
              ) : (
                <div className="space-y-4 md:space-y-6">{upcoming.map((o) => <UpcomingCard key={o._id} order={o} nav={nav} />)}</div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section className="lg:col-span-7 xl:col-span-8 mt-6 lg:mt-0">
                <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] mb-4 md:mb-5">Past</h2>
                <div className="space-y-6">
                  <PastCard order={past[0]} nav={nav} onInvoice={downloadInvoice} downloadingId={downloadingId} />
                  {past.length > 1 && (
                    <div className="rounded-3xl bg-white border border-slate-200 px-5 sm:px-6 md:px-8">
                      {past.slice(1).map((o) => <CompactRow key={o._id} order={o} nav={nav} />)}
                    </div>
                  )}
                </div>
              </section>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1 pb-4">
                <button disabled={page === 1 || isFetching} onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40">
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs font-semibold text-slate-400">Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </motion.div>
        )}
        </PullToRefresh>
       </div>

        <BottomNav active="bookings" />
      </div>
    </PageTransition>
  );
}
