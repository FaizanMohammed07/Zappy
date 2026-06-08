import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Clock, ChevronRight, X,
  Wrench, Droplets, Bolt, Hammer, Users, Car, Sparkles,
  Tv, Wifi, Smartphone, Battery, Layers, Bike, Fuel, AlertTriangle, Zap,
  Camera, Heart, Dog, Star, ShieldCheck, ShieldAlert, Cpu,
  MonitorSmartphone, Laptop, Lock, ArrowUpRight
} from 'lucide-react';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonServiceCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp, easeSoft } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_ICONS = {
  // ── Mobile ────────────────────────────────────────────────────────────────
  screen_replacement:    { Icon: Smartphone,    gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600', img: '/images/services/phone_screen.png' },
  battery_replacement:   { Icon: Battery,       gradient: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-50', text: 'text-emerald-600', img: '/images/services/phone_battery.png' },
  charging_issue:        { Icon: Bolt,          gradient: 'from-yellow-400 to-orange-500',  bg: 'bg-yellow-50',  text: 'text-yellow-600', img: '/images/services/phone_charging.png' },
  speaker_mic_issue:     { Icon: Layers,        gradient: 'from-purple-500 to-violet-600',  bg: 'bg-violet-50',  text: 'text-violet-600' },
  microphone_issue:      { Icon: Layers,        gradient: 'from-violet-500 to-purple-600',  bg: 'bg-purple-50',  text: 'text-purple-600' },
  software_issue:        { Icon: Wrench,        gradient: 'from-rose-400 to-red-500',       bg: 'bg-red-50',     text: 'text-red-600', img: '/images/services/phone_software.png' },
  water_damage:          { Icon: Droplets,      gradient: 'from-blue-400 to-cyan-500',      bg: 'bg-sky-50',     text: 'text-sky-600', img: '/images/services/phone_water.png' },
  camera_issue:          { Icon: Camera,        gradient: 'from-pink-500 to-rose-600',      bg: 'bg-pink-50',    text: 'text-pink-600', img: '/images/services/phone_camera.png' },
  data_recovery:         { Icon: Layers,        gradient: 'from-teal-500 to-emerald-600',   bg: 'bg-teal-50',    text: 'text-teal-600', img: '/images/services/phone_data.png' },
  device_not_turning_on: { Icon: Smartphone,    gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600' },
  // ── Laptop ────────────────────────────────────────────────────────────────
  laptop_slow:             { Icon: Laptop,      gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600', img: '/images/services/laptop_slow.png' },
  laptop_ssd_upgrade:      { Icon: Cpu,         gradient: 'from-blue-600 to-indigo-700',    bg: 'bg-blue-50',    text: 'text-blue-600', img: '/images/services/laptop_ssd.png' },
  laptop_ram_upgrade:      { Icon: Cpu,         gradient: 'from-indigo-500 to-blue-600',    bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  laptop_keyboard_issue:   { Icon: Laptop,      gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600' },
  laptop_motherboard_issue:{ Icon: Cpu,         gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600' },
  laptop_charging_issue:   { Icon: Bolt,        gradient: 'from-amber-400 to-orange-500',   bg: 'bg-orange-50',  text: 'text-orange-600', img: '/images/services/laptop_charging.png' },
  laptop_screen_issue:     { Icon: MonitorSmartphone, gradient: 'from-violet-500 to-purple-700', bg: 'bg-violet-50', text: 'text-violet-600', img: '/images/services/laptop_screen.png' },
  laptop_virus_removal:    { Icon: ShieldAlert, gradient: 'from-red-500 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600', img: '/images/services/laptop_virus.png' },
  laptop_data_recovery:    { Icon: Layers,      gradient: 'from-emerald-500 to-teal-700',   bg: 'bg-emerald-50', text: 'text-emerald-600', img: '/images/services/laptop_data.png' },
  // ── Smart Devices ─────────────────────────────────────────────────────────
  smart_tv_install:      { Icon: Tv,            gradient: 'from-slate-700 to-slate-900',    bg: 'bg-slate-50',   text: 'text-slate-600', img: '/images/smart_tv.png' },
  smart_tv_repair:       { Icon: Tv,            gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600', img: '/images/smart_tv.png' },
  router_setup:          { Icon: Wifi,          gradient: 'from-blue-500 to-cyan-600',      bg: 'bg-cyan-50',    text: 'text-cyan-600', img: '/images/wifi_setup.png' },
  router_troubleshoot:   { Icon: Wifi,          gradient: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',     text: 'text-sky-600', img: '/images/wifi_setup.png' },
  cctv_install:          { Icon: Camera,        gradient: 'from-stone-600 to-stone-800',    bg: 'bg-stone-50',   text: 'text-stone-600', img: '/images/cctv_install.png' },
  cctv_repair:           { Icon: Camera,        gradient: 'from-amber-600 to-orange-700',   bg: 'bg-amber-50',   text: 'text-amber-600', img: '/images/cctv_install.png' },
  smart_lock_install:    { Icon: Lock,          gradient: 'from-indigo-600 to-violet-700',  bg: 'bg-indigo-50',  text: 'text-indigo-600', img: '/images/smart_lock.png' },
  home_automation_setup: { Icon: Zap,           gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600', img: '/images/home_auto.png' },
  // ── Vehicle ───────────────────────────────────────────────────────────────
  puncture:              { Icon: Car,           gradient: 'from-slate-500 to-slate-700',    bg: 'bg-slate-50',   text: 'text-slate-600' },
  bike_chain_issue:      { Icon: Bike,          gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600' },
  bike_brake_issue:      { Icon: Bike,          gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600' },
  bike_battery_issue:    { Icon: Battery,       gradient: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-50', text: 'text-emerald-600' },
  bike_wash:             { Icon: Bike,          gradient: 'from-cyan-400 to-blue-500',      bg: 'bg-cyan-50',    text: 'text-cyan-600' },
  bike_breakdown:        { Icon: AlertTriangle, gradient: 'from-orange-500 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600' },
  bike_service:          { Icon: Wrench,        gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600' },
  car_wash:              { Icon: Car,           gradient: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',     text: 'text-sky-600' },
  car_detailing:         { Icon: Sparkles,      gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  battery_jump_start:    { Icon: Zap,           gradient: 'from-yellow-500 to-amber-600',   bg: 'bg-yellow-50',  text: 'text-yellow-600' },
  car_puncture:          { Icon: Car,           gradient: 'from-slate-600 to-slate-800',    bg: 'bg-slate-50',   text: 'text-slate-600' },
  car_breakdown:         { Icon: AlertTriangle, gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600' },
  fuel_delivery:         { Icon: Fuel,          gradient: 'from-orange-500 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600' },
  car_service:           { Icon: Wrench,        gradient: 'from-blue-600 to-indigo-700',    bg: 'bg-blue-50',    text: 'text-blue-600' },
  commercial_emergency:  { Icon: AlertTriangle, gradient: 'from-red-600 to-rose-700',       bg: 'bg-red-50',     text: 'text-red-600' },
  commercial_scheduled_maintenance: { Icon: Wrench, gradient: 'from-slate-600 to-slate-800', bg: 'bg-slate-50', text: 'text-slate-600' },
  fleet_support:         { Icon: Car,           gradient: 'from-indigo-600 to-blue-700',    bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  auto_repair:           { Icon: Wrench,        gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600' },
  van_repair:            { Icon: Car,           gradient: 'from-stone-600 to-stone-800',    bg: 'bg-stone-50',   text: 'text-stone-600' },
  // ── Family & Elder ────────────────────────────────────────────────────────
  medicine_pickup:       { Icon: Heart,         gradient: 'from-rose-500 to-pink-600',      bg: 'bg-rose-50',    text: 'text-rose-600', img: '/images/medicine_delivery.png' },
  hospital_companion:    { Icon: ShieldCheck,   gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600', img: '/images/hospital_companion.png' },
  grocery_assistance:    { Icon: Users,         gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600', img: '/images/grocery_delivery.png' },
  bill_payment_assist:   { Icon: ShieldCheck,   gradient: 'from-teal-500 to-cyan-600',      bg: 'bg-teal-50',    text: 'text-teal-600' },
  document_submission:   { Icon: ShieldCheck,   gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600' },
  home_visit_check:      { Icon: ShieldCheck,   gradient: 'from-indigo-500 to-blue-600',    bg: 'bg-indigo-50',  text: 'text-indigo-600', img: '/images/home_visit.png' },
  elder_doctor_visit:    { Icon: Heart,         gradient: 'from-red-500 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-600', img: '/images/elder_care.png' },
  elder_companion:       { Icon: Users,         gradient: 'from-purple-500 to-violet-600',  bg: 'bg-purple-50',  text: 'text-purple-600', img: '/images/elder_care.png' },
  elder_home_visit:      { Icon: ShieldCheck,   gradient: 'from-teal-500 to-emerald-600',   bg: 'bg-teal-50',    text: 'text-teal-600', img: '/images/home_visit.png' },
  elder_transport:       { Icon: Car,           gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600', img: '/images/hospital_companion.png' },
  // ── Event Crew ────────────────────────────────────────────────────────────
  event_decorator:           { Icon: Sparkles,  gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600', img: '/images/events/event_romantic.png' },
  event_setup_crew:          { Icon: Users,     gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600', img: '/images/events/event_housewarming.png' },
  event_cleaning_crew:       { Icon: Sparkles,  gradient: 'from-teal-500 to-cyan-600',      bg: 'bg-teal-50',    text: 'text-teal-600' },
  event_helper:              { Icon: Users,     gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600' },
  event_sound_crew:          { Icon: Layers,    gradient: 'from-slate-700 to-slate-900',    bg: 'bg-slate-50',   text: 'text-slate-600' },
  event_lighting_crew:       { Icon: Zap,      gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600' },
  event_security_crew:       { Icon: ShieldCheck, gradient: 'from-red-500 to-rose-600',    bg: 'bg-red-50',     text: 'text-red-600' },
  event_birthday_setup:      { Icon: Star,     gradient: 'from-pink-500 to-fuchsia-600',   bg: 'bg-pink-50',    text: 'text-pink-600', img: '/images/events/event_birthday.png' },
  event_wedding_setup:       { Icon: Star,     gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600', img: '/images/events/event_anniversary.png' },
  event_photography_assist:  { Icon: Camera,   gradient: 'from-indigo-500 to-violet-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  event_catering_assist:     { Icon: Users,    gradient: 'from-orange-400 to-red-500',     bg: 'bg-orange-50',  text: 'text-orange-600' },
  // ── Pet ───────────────────────────────────────────────────────────────────
  pet_grooming:          { Icon: Dog,           gradient: 'from-amber-400 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-600' },
  pet_walking:           { Icon: Bike,          gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',   text: 'text-green-600' },
  pet_transport:         { Icon: Car,           gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-600' },
  pet_sitting:           { Icon: Heart,         gradient: 'from-rose-500 to-pink-600',      bg: 'bg-rose-50',    text: 'text-rose-600' },
  pet_vet_assist:        { Icon: ShieldCheck,   gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-600' },
  pet_training_assist:   { Icon: Star,          gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',   text: 'text-amber-600' },
};

const CATEGORIES = [
  { key: 'all',          label: 'All',           Icon: Sparkles    },
  { key: 'mobile',       label: 'Phone',         Icon: Smartphone  },
  { key: 'other',        label: 'Smart Devices', Icon: Tv          },
  { key: 'vehicle',      label: 'Vehicle',       Icon: Car         },
  { key: 'helper',       label: 'Family',        Icon: Heart       },
  { key: 'other2',       label: 'Events',        Icon: Star        },
  { key: 'other3',       label: 'Pets',          Icon: Dog         },
];

export default function ServicesPage() {
  const nav = useNavigate();
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/catalog/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServices(data.services || []);
    } catch {
      setLoadError(true);
      toast.error('Could not load services. Tap retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

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
      <div className="min-h-screen bg-[#F8FAFC] pb-40 font-sans selection:bg-indigo-500/30">
        
        {/* Immersive Header */}
        <header className="sticky top-0 z-30 pt-4 pb-2 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50">
          <div className="page-container">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
              <motion.button
                onClick={() => nav(-1)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/60 hover:bg-slate-200 transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <ArrowLeft size={18} className="text-slate-700" />
              </motion.button>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Zappy Catalog</span>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">All Services</h1>
              </div>
              <div className="w-10 h-10" /> {/* Balancer */}
            </div>

            {/* Premium Search */}
            <div className="relative group mb-5">
              <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur-xl group-focus-within:bg-indigo-500/10 transition-colors pointer-events-none" />
              <div className="relative flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-3.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you need help with?"
                  className="flex-1 bg-transparent outline-none text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                />
                <AnimatePresence>
                  {query && (
                    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => setQuery('')} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <X size={12} className="text-slate-500" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Category Pills (Bento Style) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
              {CATEGORIES.map((c) => {
                const isActive = category === c.key;
                return (
                  <motion.button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-[1rem] text-sm font-bold transition-all border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <c.Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                    {c.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="page-container mt-6">
          {/* Error state */}
          {!loading && loadError && (
            <motion.div className="flex flex-col items-center justify-center h-[40vh] gap-4 text-center"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center shadow-inner">
                <AlertTriangle size={32} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Couldn't load services</p>
                <p className="text-slate-500 text-sm mt-1">Check your connection and try again.</p>
              </div>
              <button onClick={fetchServices}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
                Retry
              </button>
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[24px] p-5 border border-slate-200/60 shadow-sm animate-pulse">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl mb-4" />
                  <div className="h-5 bg-slate-100 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-slate-100 rounded mb-6 w-full" />
                  <div className="flex justify-between mt-4 pt-4 border-t border-slate-100">
                    <div className="w-16 h-4 bg-slate-100 rounded" />
                    <div className="w-12 h-6 bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <motion.div
              className="flex flex-col items-center justify-center h-[40vh] gap-4 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-20 h-20 rounded-[2rem] bg-slate-100 flex items-center justify-center shadow-inner">
                <Wrench size={32} className="text-slate-400" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-xl">No services found</p>
                <p className="text-sm text-slate-500 mt-2">Try a different search or category.</p>
              </div>
              {(query || category !== 'all') && (
                <motion.button
                  onClick={() => { setQuery(''); setCategory('all'); }}
                  className="mt-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-xl transition-colors shadow-lg shadow-slate-900/20"
                  whileTap={{ scale: 0.95 }}
                >
                  Clear all filters
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Results Header */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {filtered.length} Services Available
              </p>
            </div>
          )}

          {/* Grid */}
          {!loading && filtered.length > 0 && (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" variants={staggerContainer} initial="initial" animate="animate">
              <AnimatePresence mode="popLayout">
                {filtered.map((s) => {
                  const svc = SERVICE_ICONS[s.code] || SERVICE_ICONS[s.category] || {
                    Icon: Wrench, gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-100', text: 'text-slate-700',
                  };
                  const { Icon } = svc;
                  const price = Math.round((s.priceRangeMinPaise || 0) / 100);

                  return (
                    <motion.button
                      key={s.code}
                      layout
                      onClick={() => nav(`/book/${s.code}`)}
                      className="group relative bg-white rounded-[24px] text-left border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-slate-300/80 overflow-hidden flex flex-col h-full"
                      variants={fadeInUp}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Image Thumbnail */}
                      <div className="relative w-full h-36 bg-slate-100 overflow-hidden shrink-0">
                        {svc.img ? (
                          <img src={svc.img} alt={s.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${svc.gradient} opacity-20`} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                        
                        {/* Glassmorphic Icon layered over image */}
                        <div className="absolute bottom-3 left-4 w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                          <Icon size={22} strokeWidth={2.5} className="text-white" />
                        </div>

                        {/* Arrow indicator top right */}
                        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-white/20">
                          <ArrowUpRight size={16} className="text-white" />
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-black text-slate-900 text-[17px] leading-tight mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">{s.name}</h3>
                        <p className="text-[13px] text-slate-500 font-medium line-clamp-2 leading-relaxed mb-4 min-h-[40px] flex-1">
                          {s.description || 'Professional service at your doorstep'}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starting at</span>
                            <span className="text-base font-black text-slate-900">
                              {price > 0 ? `₹${price}` : 'Get Quote'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-500">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-[11px] font-bold">~{s.estimatedDurationMinutes}m</span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
        <BottomNav active="search" />
      </div>
    </PageTransition>
  );
}
