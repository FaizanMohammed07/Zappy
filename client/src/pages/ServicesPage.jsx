import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Clock, ChevronRight, X,
  Wrench, Droplets, Bolt, Hammer, Users, Car, Sparkles,
  Tv, Wifi, Smartphone, Battery, Layers, Bike, Fuel, AlertTriangle, Zap,
  Camera, Heart, Dog, Star, ShieldCheck, ShieldAlert, Cpu,
  MonitorSmartphone, Laptop, Lock,
} from 'lucide-react';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonServiceCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp, easeSoft } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_ICONS = {
  // ── Mobile ────────────────────────────────────────────────────────────────
  screen_replacement:    { Icon: Smartphone,    gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  battery_replacement:   { Icon: Battery,       gradient: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-50', text: 'text-emerald-600' },
  charging_issue:        { Icon: Bolt,          gradient: 'from-yellow-400 to-orange-500',  bg: 'bg-yellow-50',  text: 'text-yellow-600'  },
  speaker_mic_issue:     { Icon: Layers,        gradient: 'from-purple-500 to-violet-600',  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  microphone_issue:      { Icon: Layers,        gradient: 'from-violet-500 to-purple-600',  bg: 'bg-purple-50',  text: 'text-purple-600'  },
  software_issue:        { Icon: Wrench,        gradient: 'from-rose-400 to-red-500',       bg: 'bg-red-50',     text: 'text-red-600'     },
  water_damage:          { Icon: Droplets,      gradient: 'from-blue-400 to-cyan-500',      bg: 'bg-sky-50',     text: 'text-sky-600'     },
  camera_issue:          { Icon: Camera,        gradient: 'from-pink-500 to-rose-600',      bg: 'bg-pink-50',    text: 'text-pink-600'    },
  data_recovery:         { Icon: Layers,        gradient: 'from-teal-500 to-emerald-600',   bg: 'bg-teal-50',    text: 'text-teal-600'    },
  device_not_turning_on: { Icon: Smartphone,    gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  // ── Laptop ────────────────────────────────────────────────────────────────
  laptop_slow:             { Icon: Laptop,      gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  laptop_ssd_upgrade:      { Icon: Cpu,         gradient: 'from-blue-600 to-indigo-700',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  laptop_ram_upgrade:      { Icon: Cpu,         gradient: 'from-indigo-500 to-blue-600',    bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  laptop_keyboard_issue:   { Icon: Laptop,      gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  laptop_motherboard_issue:{ Icon: Cpu,         gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600'     },
  laptop_charging_issue:   { Icon: Bolt,        gradient: 'from-amber-400 to-orange-500',   bg: 'bg-orange-50',  text: 'text-orange-600'  },
  laptop_screen_issue:     { Icon: MonitorSmartphone, gradient: 'from-violet-500 to-purple-700', bg: 'bg-violet-50', text: 'text-violet-600' },
  laptop_virus_removal:    { Icon: ShieldAlert, gradient: 'from-red-500 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600'     },
  laptop_data_recovery:    { Icon: Layers,      gradient: 'from-emerald-500 to-teal-700',   bg: 'bg-emerald-50', text: 'text-emerald-600' },
  // ── Smart Devices ─────────────────────────────────────────────────────────
  smart_tv_install:      { Icon: Tv,            gradient: 'from-slate-700 to-slate-900',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  smart_tv_repair:       { Icon: Tv,            gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600'     },
  router_setup:          { Icon: Wifi,          gradient: 'from-blue-500 to-cyan-600',      bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  router_troubleshoot:   { Icon: Wifi,          gradient: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',     text: 'text-sky-600'     },
  cctv_install:          { Icon: Camera,        gradient: 'from-stone-600 to-stone-800',    bg: 'bg-stone-50',   text: 'text-stone-600'   },
  cctv_repair:           { Icon: Camera,        gradient: 'from-amber-600 to-orange-700',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  smart_lock_install:    { Icon: Lock,          gradient: 'from-indigo-600 to-violet-700',  bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  home_automation_setup: { Icon: Zap,           gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  // ── Vehicle ───────────────────────────────────────────────────────────────
  puncture:              { Icon: Car,           gradient: 'from-slate-500 to-slate-700',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  bike_chain_issue:      { Icon: Bike,          gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  bike_brake_issue:      { Icon: Bike,          gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600'     },
  bike_battery_issue:    { Icon: Battery,       gradient: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-50', text: 'text-emerald-600' },
  bike_wash:             { Icon: Bike,          gradient: 'from-cyan-400 to-blue-500',      bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  bike_breakdown:        { Icon: AlertTriangle, gradient: 'from-orange-500 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600'  },
  bike_service:          { Icon: Wrench,        gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  car_wash:              { Icon: Car,           gradient: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',     text: 'text-sky-600'     },
  car_detailing:         { Icon: Sparkles,      gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  battery_jump_start:    { Icon: Zap,           gradient: 'from-yellow-500 to-amber-600',   bg: 'bg-yellow-50',  text: 'text-yellow-600'  },
  car_puncture:          { Icon: Car,           gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  car_breakdown:         { Icon: AlertTriangle, gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600'     },
  fuel_delivery:         { Icon: Fuel,          gradient: 'from-orange-500 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600'  },
  car_service:           { Icon: Wrench,        gradient: 'from-blue-600 to-indigo-700',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  commercial_emergency:  { Icon: AlertTriangle, gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600'     },
  commercial_scheduled_maintenance: { Icon: Wrench, gradient: 'from-slate-600 to-slate-800', bg: 'bg-slate-50', text: 'text-slate-600'   },
  fleet_support:         { Icon: Car,           gradient: 'from-indigo-600 to-blue-700',    bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  auto_repair:           { Icon: Wrench,        gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  van_repair:            { Icon: Car,           gradient: 'from-stone-600 to-stone-800',    bg: 'bg-stone-50',   text: 'text-stone-600'   },
  // ── Family & Elder ────────────────────────────────────────────────────────
  medicine_pickup:       { Icon: Heart,         gradient: 'from-rose-500 to-pink-600',      bg: 'bg-rose-50',    text: 'text-rose-600'    },
  hospital_companion:    { Icon: ShieldCheck,   gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  grocery_assistance:    { Icon: Users,         gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600'   },
  bill_payment_assist:   { Icon: ShieldCheck,   gradient: 'from-teal-500 to-cyan-600',      bg: 'bg-teal-50',    text: 'text-teal-600'    },
  document_submission:   { Icon: ShieldCheck,   gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  home_visit_check:      { Icon: ShieldCheck,   gradient: 'from-indigo-500 to-blue-600',    bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  elder_doctor_visit:    { Icon: Heart,         gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600'     },
  elder_companion:       { Icon: Users,         gradient: 'from-purple-500 to-violet-600',  bg: 'bg-purple-50',  text: 'text-purple-600'  },
  elder_home_visit:      { Icon: ShieldCheck,   gradient: 'from-teal-500 to-emerald-600',   bg: 'bg-teal-50',    text: 'text-teal-600'    },
  elder_transport:       { Icon: Car,           gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  // ── Event Crew ────────────────────────────────────────────────────────────
  event_decorator:           { Icon: Sparkles,  gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  event_setup_crew:          { Icon: Users,     gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  event_cleaning_crew:       { Icon: Sparkles,  gradient: 'from-teal-500 to-cyan-600',      bg: 'bg-teal-50',    text: 'text-teal-600'    },
  event_helper:              { Icon: Users,     gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600'   },
  event_sound_crew:          { Icon: Layers,    gradient: 'from-slate-700 to-slate-900',    bg: 'bg-slate-50',   text: 'text-slate-600'   },
  event_lighting_crew:       { Icon: Zap,      gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  event_security_crew:       { Icon: ShieldCheck, gradient: 'from-red-500 to-rose-600',    bg: 'bg-red-50',     text: 'text-red-600'     },
  event_birthday_setup:      { Icon: Star,     gradient: 'from-pink-500 to-fuchsia-600',   bg: 'bg-pink-50',    text: 'text-pink-600'    },
  event_wedding_setup:       { Icon: Star,     gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  event_photography_assist:  { Icon: Camera,   gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  event_catering_assist:     { Icon: Users,    gradient: 'from-orange-400 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600'  },
  // ── Pet ───────────────────────────────────────────────────────────────────
  pet_grooming:          { Icon: Dog,           gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
  pet_walking:           { Icon: Bike,          gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600'   },
  pet_transport:         { Icon: Car,           gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  pet_sitting:           { Icon: Heart,         gradient: 'from-rose-500 to-pink-600',      bg: 'bg-rose-50',    text: 'text-rose-600'    },
  pet_vet_assist:        { Icon: ShieldCheck,   gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600'    },
  pet_training_assist:   { Icon: Star,          gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600'   },
};

const CATEGORIES = [
  { key: 'all',          label: 'All',          Icon: Sparkles    },
  { key: 'mobile',       label: 'Phone',         Icon: Smartphone  },
  { key: 'other',        label: 'Smart Devices', Icon: Tv          },
  { key: 'vehicle',      label: 'Vehicle',       Icon: Car         },
  { key: 'helper',       label: 'Family',        Icon: Heart       },
  { key: 'other2',       label: 'Events',        Icon: Star        },
  { key: 'other3',       label: 'Pets',          Icon: Dog         },
];

// Map DB category values to filter keys
const CAT_MAP = {
  mobile: ['mobile'],
  other:  ['other'],       // smart devices
  vehicle:['vehicle'],
  helper: ['helper'],      // family + elder
  other2: ['other'],       // events (also category: 'other')
  other3: ['other'],       // pets (also category: 'other')
};

const VERTICAL_COLORS = {
  mobile:       { bg: 'from-indigo-500 to-violet-600',  pill: 'bg-indigo-100 text-indigo-700'  },
  other:        { bg: 'from-slate-600 to-slate-800',    pill: 'bg-slate-100 text-slate-700'    },
  vehicle:      { bg: 'from-slate-600 to-slate-800',    pill: 'bg-slate-100 text-slate-700'    },
  helper:       { bg: 'from-rose-500 to-pink-600',      pill: 'bg-rose-100 text-rose-700'      },
  construction: { bg: 'from-stone-500 to-slate-600',    pill: 'bg-stone-100 text-stone-700'    },
};

function FloatingOrb({ style }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ filter: 'blur(40px)', ...style }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

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
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f9fafb 160px)' }}>

        {/* Premium Header */}
        <header className="sticky top-0 z-20 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' }}>
          <FloatingOrb style={{ width: 160, height: 160, background: 'rgba(99,102,241,0.25)', top: -60, right: -40 }} />
          <FloatingOrb style={{ width: 100, height: 100, background: 'rgba(139,92,246,0.2)', top: 10, left: -20 }} />

          <div className="relative page-container pt-4 pb-3">
            {/* Back + title row */}
            <div className="flex items-center gap-3 mb-4">
              <motion.button
                onClick={() => nav(-1)}
                className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
              >
                <ArrowLeft size={18} strokeWidth={2.5} className="text-white" />
              </motion.button>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Browse</p>
                <h1 className="text-white font-black text-lg leading-tight">All Services</h1>
              </div>
              {query && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => setQuery('')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={14} className="text-white" />
                </motion.button>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
              <Search size={15} strokeWidth={2} className="text-white/50 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/40 font-medium"
              />
            </div>

            {/* Category chips */}
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {CATEGORIES.map((c) => {
                const isActive = category === c.key;
                return (
                  <motion.button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-md'
                        : 'bg-white/10 text-white/70 hover:bg-white/15 border border-white/10'
                    }`}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{c.emoji}</span>
                    {c.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Bottom fade */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </header>

        <div className="page-container mt-5">
          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonServiceCard key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <motion.div
              className="flex flex-col items-center justify-center h-56 gap-4 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Wrench size={26} className="text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-[#0F172A] text-base">No services found</p>
                <p className="text-sm text-slate-400 mt-1">Try a different search or category</p>
              </div>
              {(query || category !== 'all') && (
                <motion.button
                  onClick={() => { setQuery(''); setCategory('all'); }}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full"
                  whileTap={{ scale: 0.95 }}
                >
                  Clear filters
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Results */}
          {!loading && filtered.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {filtered.length} {filtered.length === 1 ? 'service' : 'services'} available
                </p>
                {category !== 'all' && (
                  <motion.button
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setCategory('all')}
                    className="text-xs font-bold text-indigo-600 flex items-center gap-1"
                    whileTap={{ scale: 0.95 }}
                  >
                    Show all <X size={10} />
                  </motion.button>
                )}
              </div>

              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <AnimatePresence mode="popLayout">
                  {filtered.map((s) => {
                    const svc = SERVICE_ICONS[s.code] || SERVICE_ICONS[s.category] || {
                      Icon: Wrench, gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-600',
                    };
                    const { Icon } = svc;
                    const price = Math.round((s.priceRangeMinPaise || 0) / 100);

                    return (
                      <motion.button
                        key={s.code}
                        layout
                        onClick={() => nav(`/book/${s.code}`)}
                        className="group relative bg-white rounded-2xl overflow-hidden text-left"
                        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                        variants={fadeInUp}
                        whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.22, ease: easeSoft }}
                      >
                        {/* Gradient icon header */}
                        <div className={`relative w-full h-20 bg-gradient-to-br ${svc.gradient} flex items-center justify-center overflow-hidden`}>
                          {/* Subtle pattern overlay */}
                          <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)' }}
                          />
                          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                            <Icon size={20} strokeWidth={1.75} className="text-white" />
                          </div>

                          {/* Hover overlay */}
                          <motion.div
                            className="absolute inset-0 bg-black/10"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                          />

                          {/* "Book" pill — appears on hover */}
                          <motion.div
                            className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full"
                            initial={{ opacity: 0, y: 4 }}
                            whileHover={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            Book <ChevronRight size={8} strokeWidth={3} />
                          </motion.div>
                        </div>

                        {/* Content */}
                        <div className="p-3">
                          <p className="font-black text-[#0F172A] text-sm leading-tight line-clamp-1">{s.name}</p>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[30px]">
                            {s.description || 'Professional service at your doorstep'}
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between">
                            <span className={`text-[12px] font-extrabold ${svc.text}`}>
                              {price > 0 ? `₹${price}+` : 'Get quote'}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full">
                              <Clock size={9} strokeWidth={2} />
                              ~{s.estimatedDurationMinutes}m
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </div>

        <BottomNav active="home" />
      </div>
    </PageTransition>
  );
}
