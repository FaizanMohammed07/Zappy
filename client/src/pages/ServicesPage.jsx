import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, Clock, ChevronRight,
  Wrench, Droplets, Bolt, Wind, Hammer, Users,
  Car, Sparkles, Paintbrush2, ShoppingBag, Scissors,
  Truck, Leaf, Shield, Tv, Wifi,
} from 'lucide-react';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonServiceCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_ICONS = {
  electrical: { Icon: Bolt,         bg: 'bg-amber-50',   text: 'text-amber-600',  ring: 'ring-amber-100'  },
  plumbing:   { Icon: Droplets,     bg: 'bg-blue-50',    text: 'text-blue-600',   ring: 'ring-blue-100'   },
  ac_repair:  { Icon: Wind,         bg: 'bg-cyan-50',    text: 'text-cyan-600',   ring: 'ring-cyan-100'   },
  carpenter:  { Icon: Hammer,       bg: 'bg-orange-50',  text: 'text-orange-600', ring: 'ring-orange-100' },
  helper:     { Icon: Users,        bg: 'bg-green-50',   text: 'text-green-600',  ring: 'ring-green-100'  },
  puncture:   { Icon: Car,          bg: 'bg-slate-50',   text: 'text-slate-600',  ring: 'ring-slate-200'  },
  cleaning:   { Icon: Sparkles,     bg: 'bg-purple-50',  text: 'text-purple-600', ring: 'ring-purple-100' },
  painting:   { Icon: Paintbrush2,  bg: 'bg-pink-50',    text: 'text-pink-600',   ring: 'ring-pink-100'   },
  delivery:   { Icon: Truck,        bg: 'bg-indigo-50',  text: 'text-indigo-600', ring: 'ring-indigo-100' },
  laundry:    { Icon: ShoppingBag,  bg: 'bg-rose-50',    text: 'text-rose-600',   ring: 'ring-rose-100'   },
  beauty:     { Icon: Scissors,     bg: 'bg-fuchsia-50', text: 'text-fuchsia-600',ring: 'ring-fuchsia-100'},
  gardening:  { Icon: Leaf,         bg: 'bg-emerald-50', text: 'text-emerald-600',ring: 'ring-emerald-100'},
  security:   { Icon: Shield,       bg: 'bg-red-50',     text: 'text-red-600',    ring: 'ring-red-100'    },
  appliance:  { Icon: Tv,           bg: 'bg-sky-50',     text: 'text-sky-600',    ring: 'ring-sky-100'    },
  internet:   { Icon: Wifi,         bg: 'bg-violet-50',  text: 'text-violet-600', ring: 'ring-violet-100' },
};

const CATEGORIES = [
  { key: 'all',     label: 'All' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'home',    label: 'Home' },
  { key: 'helper',  label: 'Helper' },
  { key: 'beauty',  label: 'Beauty' },
];


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
                  const svc = SERVICE_ICONS[s.code] || SERVICE_ICONS[s.category] || {
                    Icon: Wrench, bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200',
                  };
                  const { Icon } = svc;
                  return (
                    <motion.button
                      key={s.code}
                      onClick={() => nav(`/book/${s.code}`)}
                      className="card text-left group hover:shadow-lg transition-shadow"
                      variants={fadeInUp}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={`w-12 h-12 rounded-2xl ${svc.bg} ring-1 ${svc.ring} flex items-center justify-center mb-3`}>
                        <Icon size={20} strokeWidth={1.75} className={svc.text} />
                      </div>
                      <p className="font-bold text-[#0F172A] text-sm leading-tight">{s.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                        {s.description || 'Professional service at your doorstep'}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                        <span className={`text-[12px] font-extrabold ${svc.text}`}>
                          ₹{s.priceRangeMinPaise / 100}+
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Clock size={10} strokeWidth={2} />
                          ~{s.estimatedDurationMinutes}m
                        </span>
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
