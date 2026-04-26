import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Clock, ChevronRight, Wrench } from 'lucide-react';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonServiceCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { key: 'all',     label: 'All' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'home',    label: 'Home' },
  { key: 'helper',  label: 'Helper' },
  { key: 'beauty',  label: 'Beauty' },
];

const CATEGORY_STYLES = {
  vehicle: { bg: 'bg-slate-50',   text: 'text-slate-600',   ring: 'ring-slate-200' },
  home:    { bg: 'bg-zappy-50',   text: 'text-zappy-600',   ring: 'ring-zappy-100' },
  helper:  { bg: 'bg-success-50', text: 'text-success-600', ring: 'ring-success-100' },
  beauty:  { bg: 'bg-accent-50',  text: 'text-accent-600',  ring: 'ring-accent-100' },
  other:   { bg: 'bg-slate-50',   text: 'text-slate-600',   ring: 'ring-slate-200' },
};

export default function ServicesPage() {
  const nav = useNavigate();
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/catalog/services');
        const data = await res.json();
        setServices(data.services || []);
      } catch {
        toast.error('Could not load services');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, query, category]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9FAFB] pb-24">
        <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="page-container pt-4 pb-3">
            <div className="flex items-center gap-3 mb-4">
              <motion.button
                onClick={() => nav(-1)}
                className="back-btn"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                aria-label="Back"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </motion.button>
              <h1 className="h-card flex-1">Services</h1>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-btn px-4 py-2.5 focus-within:border-zappy-600 focus-within:ring-2 focus-within:ring-zappy-600/20 transition-all">
              <Search size={15} strokeWidth={2} className="text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className="flex-1 bg-transparent outline-none text-sm text-[#111827] placeholder:text-slate-400 font-medium"
              />
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {CATEGORIES.map((c) => (
                <motion.button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    category === c.key
                      ? 'bg-zappy-600 text-white shadow-soft'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {c.label}
                </motion.button>
              ))}
            </div>
          </div>
        </header>

        <div className="page-container mt-4">
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonServiceCard key={i} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <motion.div
              className="flex flex-col items-center justify-center h-48 gap-3 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Wrench size={24} className="text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-[#0F172A]">No services found</p>
                <p className="text-sm text-slate-400 mt-1">Try a different search or category</p>
              </div>
            </motion.div>
          )}

          {!loading && filtered.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-400 mb-3">
                {filtered.length} {filtered.length === 1 ? 'service' : 'services'} available
              </p>
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {filtered.map((s) => {
                  const style = CATEGORY_STYLES[s.category] || CATEGORY_STYLES.other;
                  return (
                    <motion.button
                      key={s.code}
                      onClick={() => nav(`/book/${s.code}`)}
                      className="card text-left group"
                      variants={fadeInUp}
                      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={`w-11 h-11 rounded-xl ${style.bg} ring-1 ${style.ring} flex items-center justify-center mb-3`}>
                        <Wrench size={18} strokeWidth={1.75} className={style.text} />
                      </div>
                      <p className="font-semibold text-[#0F172A] text-sm leading-tight">{s.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                        {s.description || 'Professional service at your doorstep'}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[12px] font-bold text-zappy-600">
                          ₹{s.priceRangeMinPaise / 100}–{s.priceRangeMaxPaise / 100}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Clock size={10} strokeWidth={2} />
                          ~{s.estimatedDurationMinutes}m
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-zappy-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Book now <ChevronRight size={11} strokeWidth={2.5} />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </>
          )}
        </div>

        <BottomNav active="home" />
      </div>
    </PageTransition>
  );
}
