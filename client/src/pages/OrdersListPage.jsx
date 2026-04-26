import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, ChevronRight, Circle, ChevronLeft } from 'lucide-react';
import { useListOrdersQuery } from '../services/api';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonList, SkeletonOrderCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';

const STATUS_MAP = {
  created:     { label: 'Placed',       cls: 'chip-neutral' },
  searching:   { label: 'Searching',    cls: 'chip-blue' },
  assigned:    { label: 'Assigned',     cls: 'chip-blue' },
  on_the_way:  { label: 'On the Way',   cls: 'chip-blue' },
  arrived:     { label: 'Arrived',      cls: 'chip-blue' },
  in_progress: { label: 'In Progress',  cls: 'chip-success' },
  completed:   { label: 'Completed',    cls: 'chip-success' },
  cancelled:   { label: 'Cancelled',    cls: 'chip-red' },
  failed:      { label: 'Failed',       cls: 'chip-red' },
};

const ACTIVE = new Set(['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress']);

export default function OrdersListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListOrdersQuery(page);

  const orders = data?.orders || [];
  const totalPages = data?.totalPages || 1;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9FAFB] pb-24">
        <header className="page-header">
          <div className="page-header-inner">
            <h1 className="h-card flex-1">My Bookings</h1>
            {data?.total != null && (
              <span className="chip-neutral text-[11px]">{data.total} total</span>
            )}
          </div>
        </header>

        {isLoading ? (
          <div className="page-container pt-4">
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
            className="page-container pt-4 space-y-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {orders.map((order) => {
              const chip = STATUS_MAP[order.status] || STATUS_MAP.created;
              const isActive = ACTIVE.has(order.status);

              return (
                <motion.button
                  key={order._id}
                  onClick={() => nav(`/orders/${order._id}`)}
                  className={`w-full card text-left flex items-start gap-3 ${isActive ? 'ring-zappy-200' : ''}`}
                  variants={fadeInUp}
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isActive && (
                    <div className="mt-1 shrink-0">
                      <Circle size={8} className="text-zappy-500 fill-zappy-500 animate-pulse-slow" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#0F172A] capitalize text-sm">
                          {order.service.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {order.pickupLocation?.address}
                        </p>
                      </div>
                      <span className={`chip ${chip.cls} shrink-0`}>{chip.label}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#0F172A] text-sm">₹{order.pricing?.total ?? '—'}</p>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </div>
                  </div>
                </motion.button>
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
