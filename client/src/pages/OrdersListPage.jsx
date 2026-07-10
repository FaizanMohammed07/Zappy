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
    <div className="flex items-center gap-3 py-4 border-b border-slate-100 last:border-0">
      <button onClick={() => nav(`/orders/${order._id}`)} className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon size={24} className={color} />
      </button>
      <button onClick={() => nav(`/orders/${order._id}`)} className="flex-1 min-w-0 text-left">
        <p className="font-bold text-[#0F172A] capitalize leading-tight truncate">{order.service?.replace(/_/g, ' ')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{fmtDate(order.createdAt)}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          <span className="font-semibold text-[#0F172A]">₹{order.pricing?.total ?? '0.00'}</span>{cancelled ? ' · Cancelled' : ''}
        </p>
      </button>
      <button onClick={() => nav(`/book/${order.service}`)}
        className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold text-[#0F172A] shrink-0 active:bg-slate-50">
        <Repeat2 size={14} /> Rebook
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
    <motion.div variants={fadeInUp} className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden shadow-sm">
      <button onClick={() => nav(`/orders/${order._id}`)} className="block w-full text-left">
        {url ? (
          <img src={url} alt="trip map" className="w-full h-40 object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
            <MapPin size={28} className="text-slate-500" />
          </div>
        )}
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[#0F172A] text-lg capitalize leading-tight">{order.service?.replace(/_/g, ' ')}</h3>
        </div>
        <p className="text-sm text-slate-500 mt-1">{fmtDate(order.createdAt)}</p>
        <p className="text-sm text-slate-500 mt-0.5">
          <span className="font-bold text-[#0F172A]">₹{order.pricing?.total ?? '0.00'}</span>
          {isCancelled ? ' · Cancelled' : isCompleted ? ' · Completed' : ` · ${STATUS_MAP[order.status] || ''}`}
          {order.userRating ? <span className="ml-1 inline-flex items-center gap-0.5"><Star size={11} className="fill-amber-400 text-amber-400" />{order.userRating}</span> : null}
        </p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {isCompleted && order.userRating == null && (
            <button onClick={() => nav(`/orders/${order._id}`)}
              className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold text-[#0F172A] active:bg-slate-50">
              <Star size={14} /> Rate
            </button>
          )}
          <button onClick={() => nav(`/book/${order.service}`)}
            className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold text-[#0F172A] active:bg-slate-50">
            <Repeat2 size={14} /> Rebook
          </button>
          {isCompleted && (
            <button onClick={(e) => onInvoice(e, order._id)} disabled={downloadingId === order._id}
              className="flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold text-slate-500 active:bg-slate-50 disabled:opacity-50 ml-auto">
              {downloadingId === order._id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
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
      className="block w-full text-left rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0F172A] capitalize">{order.service?.replace(/_/g, ' ')}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{order.pickupLocation?.address}</p>
        </div>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">{STATUS_MAP[order.status]}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="font-black text-[#0F172A]">₹{order.pricing?.total ?? '—'}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-blue-600">Track <ArrowRight size={13} /></span>
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
      <div className="min-h-screen bg-slate-50 pb-40">
       <div className="mx-auto w-full max-w-[480px]">
        <PullToRefresh onRefresh={() => refetch()}>
        <header className="px-5 pt-8 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
          <h1 className="text-3xl font-black text-[#0F172A]">Activity</h1>
        </header>

        {isError ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <div className="px-5 pt-4"><SkeletonList count={4} Item={SkeletonOrderCard} /></div>
        ) : allOrders.length === 0 ? (
          <div className="px-5 pt-6">
            <h2 className="text-lg font-bold text-[#0F172A] mb-3">Upcoming</h2>
            <button onClick={() => nav('/services')} className="w-full text-left rounded-2xl ring-1 ring-slate-200 bg-white p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#0F172A] text-base">You have no upcoming bookings</p>
                <p className="text-sm text-blue-600 font-semibold mt-1 flex items-center gap-1">Book a service <ArrowRight size={14} /></p>
              </div>
              <Calendar size={34} className="text-slate-300" />
            </button>
          </div>
        ) : (
          <motion.div className="px-5 pt-2 space-y-6" variants={staggerContainer} initial="initial" animate="animate">
            {/* Upcoming */}
            <section>
              <h2 className="text-lg font-bold text-[#0F172A] mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <button onClick={() => nav('/services')} className="w-full text-left rounded-2xl ring-1 ring-slate-200 bg-white p-5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#0F172A] text-base">You have no upcoming bookings</p>
                    <p className="text-sm text-blue-600 font-semibold mt-1 flex items-center gap-1">Book a service <ArrowRight size={14} /></p>
                  </div>
                  <Calendar size={34} className="text-slate-300" />
                </button>
              ) : (
                <div className="space-y-3">{upcoming.map((o) => <UpcomingCard key={o._id} order={o} nav={nav} />)}</div>
              )}
            </section>

            {/* Past — first trip is a big map card (Uber-style), rest are compact rows */}
            {past.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-[#0F172A] mb-3">Past</h2>
                <div className="space-y-4">
                  <PastCard order={past[0]} nav={nav} onInvoice={downloadInvoice} downloadingId={downloadingId} />
                  {past.length > 1 && (
                    <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm px-4">
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
