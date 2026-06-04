import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Bell, Search, ChevronRight, ChevronDown, Zap, Star, Wrench,
  Droplets, Bolt, Hammer, Users, Car, Sparkles,
  Flame, Trophy, Smartphone, Battery, Layers,
  Bike, Fuel, AlertTriangle, ArrowUpRight,
  Clock, Wallet, User, ShieldCheck,
  CheckCircle, Lock, TrendingUp, MapPin, Loader2,
  Laptop, Tv, Wifi, Camera, Heart, PartyPopper, Dog,
  ShieldAlert, Cpu, MonitorSmartphone,
} from 'lucide-react';
import { selectAuth, selectIsAuthed } from '../modules/auth/authSlice';
import { useListOrdersQuery, useGetGamificationQuery, useGetRecommendationsQuery } from '../services/api';
import { ZappyLogo } from '../components/common/ZappyLogo';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import AdBanner from '../components/common/AdBanner';
import { springSnap, fadeInUp, staggerContainer } from '../lib/animations';
import IntroSplash from '../components/common/IntroSplash';
import HeroCarousel from '../components/home/HeroCarousel';
import OffersSection from '../components/home/OffersSection';

/* ─── Most booked — Electronics Rescue ────────────────────────────────── */
const MOST_BOOKED = [
  { key: 'screen_replacement',  name: 'Screen Replacement', img: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.88, price: 399, mrp: 499, instant: true },
  { key: 'battery_replacement', name: 'Battery Replacement',img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.83, price: 299, mrp: null, instant: true },
  { key: 'laptop_slow',         name: 'Laptop Speed Fix',   img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.79, price: 499, mrp: 599, instant: false },
  { key: 'charging_issue',      name: 'Charging Port Fix',  img: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.76, price: 199, mrp: null, instant: true },
  { key: 'data_recovery',       name: 'Data Recovery',      img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.81, price: 799, mrp: 999, instant: false },
];

/* ─── Vehicle care highlights ──────────────────────────────────────────── */
const VEHICLE_HIGHLIGHTS = [
  { key: 'puncture',         name: 'Puncture Repair',  img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.82, price: 149, mrp: null, instant: true  },
  { key: 'car_wash',         name: 'Car Wash',         img: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.75, price: 349, mrp: null, instant: true  },
  { key: 'battery_jump_start',name: 'Jump Start',      img: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.91, price: 299, mrp: null, instant: true  },
  { key: 'bike_service',     name: 'Bike Full Service',img: 'https://images.unsplash.com/photo-1558981396-7f5e96fd2378?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.77, price: 499, mrp: 599, instant: false },
  { key: 'car_detailing',    name: 'Car Detailing',    img: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=400&h=300&q=80', rating: 4.85, price: 1499, mrp: 1799, instant: false },
];

/* ─── Service tile data ────────────────────────────────────────────────── */
// Electronics Rescue — Mobile
const PHONE_TILES = [
  { key: 'screen_replacement',  name: 'Screen Fix',    img: '/images/services/phone_screen.png',  eta: '25 mins' },
  { key: 'battery_replacement', name: 'Battery',       img: '/images/services/phone_battery.png', eta: '30 mins' },
  { key: 'charging_issue',      name: 'Charging',      img: '/images/services/phone_charging.png',eta: '20 mins' },
  { key: 'camera_issue',        name: 'Camera',        img: '/images/services/phone_camera.png',  eta: null      },
  { key: 'software_issue',      name: 'Software',      img: '/images/services/phone_software.png',eta: null      },
  { key: 'water_damage',        name: 'Water Damage',  img: '/images/services/phone_water.png',   eta: null      },
  { key: 'data_recovery',       name: 'Data Recovery', img: '/images/services/phone_data.png',    eta: null      },
];

// Electronics Rescue — Laptop
const LAPTOP_TILES = [
  { key: 'laptop_slow',             name: 'Slow Laptop',    img: '/images/services/laptop_slow.png',     eta: '45 mins' },
  { key: 'laptop_ssd_upgrade',      name: 'SSD Upgrade',    img: '/images/services/laptop_ssd.png',      eta: null      },
  { key: 'laptop_screen_issue',     name: 'Screen Repair',  img: '/images/services/laptop_screen.png',   eta: null      },
  { key: 'laptop_virus_removal',    name: 'Virus Removal',  img: '/images/services/laptop_virus.png',    eta: null      },
  { key: 'laptop_data_recovery',    name: 'Data Recovery',  img: '/images/services/laptop_data.png',     eta: null      },
  { key: 'laptop_charging_issue',   name: 'Charging Fix',   img: '/images/services/laptop_charging.png', eta: '40 mins' },
];

// Smart Devices
const SMART_TILES = [
  { key: 'smart_tv_install',    name: 'Smart TV',         Icon: Tv,       grad: 'from-slate-700 to-slate-900',   eta: '60 mins' },
  { key: 'router_setup',        name: 'WiFi Setup',       Icon: Wifi,     grad: 'from-blue-500 to-cyan-600',     eta: '30 mins' },
  { key: 'cctv_install',        name: 'CCTV Install',     Icon: Camera,   grad: 'from-stone-600 to-stone-800',   eta: null      },
  { key: 'smart_lock_install',  name: 'Smart Lock',       Icon: Lock,     grad: 'from-indigo-600 to-violet-700', eta: null      },
  { key: 'home_automation_setup',name: 'Home Auto',       Icon: Zap,      grad: 'from-amber-500 to-orange-600',  eta: null      },
];

// Vehicle Care
const VEHICLE_TILES = [
  { key: 'puncture',           name: 'Puncture',      Icon: AlertTriangle, grad: 'from-slate-600 to-slate-800',  shadow: 'rgba(100,116,139,0.4)', eta: '18 mins' },
  { key: 'battery_jump_start', name: 'Jump Start',    Icon: Zap,           grad: 'from-yellow-500 to-amber-600', shadow: 'rgba(245,158,11,0.4)',  eta: '15 mins' },
  { key: 'bike_wash',          name: 'Bike Wash',     Icon: Bike,          grad: 'from-cyan-500 to-blue-600',    shadow: 'rgba(6,182,212,0.35)', eta: '30 mins' },
  { key: 'car_wash',           name: 'Car Wash',      Icon: Car,           grad: 'from-sky-500 to-blue-700',     shadow: 'rgba(14,165,233,0.35)',eta: '35 mins' },
  { key: 'car_breakdown',      name: 'Breakdown',     Icon: Hammer,        grad: 'from-red-500 to-rose-700',     shadow: 'rgba(239,68,68,0.35)', eta: '20 mins' },
  { key: 'fuel_delivery',      name: 'Fuel Delivery', Icon: Fuel,          grad: 'from-orange-500 to-red-500',   shadow: 'rgba(249,115,22,0.4)', eta: '25 mins' },
];

// Family & Elder Assist
const FAMILY_TILES = [
  { key: 'medicine_pickup',    name: 'Medicine',      Icon: Heart,       grad: 'from-rose-500 to-pink-600',     eta: '40 mins' },
  { key: 'hospital_companion', name: 'Hospital Help', Icon: ShieldCheck, grad: 'from-blue-500 to-indigo-600',   eta: null      },
  { key: 'grocery_assistance', name: 'Grocery',       Icon: Users,       grad: 'from-green-500 to-emerald-600', eta: '45 mins' },
  { key: 'elder_companion',    name: 'Elder Care',    Icon: Heart,       grad: 'from-violet-500 to-purple-600', eta: null      },
  { key: 'home_visit_check',   name: 'Home Visit',    Icon: CheckCircle, grad: 'from-teal-500 to-cyan-600',     eta: null      },
];

// Event Commerce tiles — navigate to event commerce module
const EVENT_TILES = [
  { key: 'birthday',      name: 'Birthday',    Icon: PartyPopper, grad: 'from-pink-500 to-fuchsia-600',  category: 'birthday'      },
  { key: 'anniversary',   name: 'Anniversary', Icon: Star,        grad: 'from-rose-500 to-pink-500',     category: 'anniversary'   },
  { key: 'baby-shower',   name: 'Baby Shower', Icon: Sparkles,    grad: 'from-blue-400 to-indigo-500',   category: 'baby-shower'   },
  { key: 'romantic',      name: 'Romantic',    Icon: Heart,       grad: 'from-red-400 to-rose-500',      category: 'romantic'      },
  { key: 'housewarming',  name: 'Housewarming',Icon: Layers,      grad: 'from-amber-400 to-orange-500',  category: 'housewarming'  },
];

// Pet Assistance
const PET_TILES = [
  { key: 'pet_grooming',       name: 'Grooming',    Icon: Dog,        grad: 'from-amber-400 to-orange-500',  eta: '60 mins' },
  { key: 'pet_walking',        name: 'Walking',     Icon: Bike,       grad: 'from-green-500 to-emerald-600', eta: '20 mins' },
  { key: 'pet_sitting',        name: 'Pet Sitting', Icon: Heart,      grad: 'from-rose-500 to-pink-600',     eta: null      },
  { key: 'pet_vet_assist',     name: 'Vet Help',    Icon: ShieldCheck,grad: 'from-blue-500 to-indigo-600',   eta: null      },
  { key: 'pet_transport',      name: 'Transport',   Icon: Car,        grad: 'from-violet-500 to-purple-600', eta: null      },
];

const HERO_POSTERS = [
  { Icon: Smartphone, label: 'Phone Repair',  grad: 'from-indigo-500 via-violet-600 to-purple-700' },
  { Icon: Car,        label: 'Vehicle Care',  grad: 'from-slate-600 via-slate-700 to-slate-900'    },
  { Icon: Heart,      label: 'Family Assist', grad: 'from-rose-500 via-pink-500 to-fuchsia-600'    },
  { Icon: Dog,        label: 'Pet Care',      grad: 'from-amber-400 via-orange-500 to-red-500'     },
];

const ACTIVE_STATUSES = ['created','searching','assigned','on_the_way','arrived','in_progress'];
const STATUS_LABELS = {
  searching: 'Finding a worker', assigned: 'Worker assigned', on_the_way: 'On the way',
  arrived: 'Arrived', in_progress: 'In progress', created: 'Order placed',
};
const LEVEL_COLORS = {
  Rookie: 'from-slate-400 to-slate-500',    Explorer: 'from-green-400 to-emerald-500',
  Regular: 'from-blue-400 to-blue-600',     Pro: 'from-violet-400 to-purple-600',
  Expert: 'from-amber-400 to-orange-500',   Elite: 'from-rose-400 to-red-500',
  Champion: 'from-pink-400 to-fuchsia-600', Legend: 'from-yellow-300 to-amber-500',
};

/* ─── Live worker badge ────────────────────────────────────────────────── */
function LiveBadge() {
  const [n, setN] = useState(47);
  useEffect(() => {
    const id = setInterval(() => setN(x => x + (Math.random() > 0.5 ? 1 : -1)), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 ring-1 ring-green-200">
      <motion.span className="w-1.5 h-1.5 rounded-full bg-green-500"
        animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }} />
      <span className="text-[11px] font-bold text-green-700">{n} workers live</span>
    </div>
  );
}

/* ─── UC-style image service card ──────────────────────────────────────── */
function ServiceImageCard({ item, nav }) {
  return (
    <motion.button
      onClick={() => nav(`/book/${item.key}`)}
      className="shrink-0 w-44 flex flex-col text-left"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="w-full h-36 rounded-2xl overflow-hidden bg-slate-100 mb-2.5 relative">
        <img
          src={item.img}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={e => { e.target.style.display = 'none'; }}
        />
        {item.instant && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
            <Zap size={8} className="text-green-600" strokeWidth={2.5} />
            <span className="text-[9px] font-black text-green-600">Instant</span>
          </div>
        )}
      </div>
      <p className="text-[13px] font-bold text-slate-900 leading-tight mb-1">{item.name}</p>
      <div className="flex items-center gap-1 mb-1">
        <Star size={10} className="text-amber-400 fill-amber-400" />
        <span className="text-[11px] font-semibold text-slate-700">{item.rating.toFixed(2)}</span>
        {item.instant && (
          <>
            <span className="text-slate-300 mx-0.5">·</span>
            <Zap size={8} className="text-green-600" strokeWidth={2.5} />
            <span className="text-[10px] font-semibold text-green-600">Instant</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-black text-slate-900">₹{item.price}</span>
        {item.mrp && <span className="text-[11px] text-slate-400 line-through">₹{item.mrp}</span>}
      </div>
    </motion.button>
  );
}

/* ─── Gradient poster tile ─────────────────────────────────────────────── */
function PosterTile({ svc, nav }) {
  const { key, name, Icon, grad, shadow, eta } = svc;
  return (
    <motion.button onClick={() => nav(`/book/${key}`)} className="w-[84px] sm:w-[96px] md:w-[112px] lg:w-[128px] flex flex-col items-center gap-2 group shrink-0"
      whileHover={{ y: -4 }} whileTap={{ scale: 0.92 }} transition={springSnap}>
      <div className={`w-full aspect-square rounded-2xl bg-gradient-to-br ${grad} relative overflow-hidden`}
        style={{ boxShadow: shadow ? `0 6px 20px ${shadow}` : '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full bg-white/10" />
        <div className="absolute -left-2 -bottom-3 w-10 h-10 rounded-full bg-white/10" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.4) 0px,rgba(255,255,255,0.4) 1px,transparent 1px,transparent 8px)',
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={22} strokeWidth={1.75} className="text-white drop-shadow-sm relative z-10" />
        </div>
        {eta && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <Clock size={7} className="text-white/90" />
              <span className="text-[9px] font-black text-white">{eta}</span>
            </div>
          </div>
        )}
        <motion.div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
      </div>
      <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">{name}</span>
    </motion.button>
  );
}

/* ─── Compact poster tile ──────────────────────────────────────────────── */
function CompactTile({ svc, nav }) {
  const { key, name, Icon, grad, eta } = svc;
  // nav can be a function (event tiles) or a useNavigate instance (service tiles)
  const handleClick = typeof nav === 'function' && nav.length === 0 ? nav : () => nav(`/book/${key}`);
  return (
    <motion.button onClick={handleClick} className="w-[72px] sm:w-[84px] md:w-[96px] lg:w-[104px] flex flex-col items-center gap-1.5 group shrink-0"
      whileHover={{ y: -3 }} whileTap={{ scale: 0.93 }}>
      <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${grad} relative overflow-hidden`}
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
        <div className="absolute -right-2 -top-2 w-10 h-10 rounded-full bg-white/10" />
        <div className="absolute -left-1 -bottom-2 w-7 h-7 rounded-full bg-white/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={18} strokeWidth={1.75} className="text-white relative z-10" />
        </div>
        {eta && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-black/25 backdrop-blur-sm rounded-full px-1 py-px flex items-center gap-0.5">
              <Clock size={6} className="text-white/90" />
              <span className="text-[8px] font-black text-white">{eta}</span>
            </div>
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight">{name}</span>
    </motion.button>
  );
}

/* ─── Compact image tile ───────────────────────────────────────────────── */
function CompactImageTile({ svc, nav }) {
  const { key, name, img, eta } = svc;
  return (
    <motion.button onClick={() => nav(`/book/${key}`)} className="w-[84px] sm:w-[100px] md:w-[112px] lg:w-[120px] flex flex-col items-center gap-2 group shrink-0"
      whileHover={{ y: -4 }} whileTap={{ scale: 0.94 }}>
      <div className="w-full aspect-square rounded-2xl bg-slate-100 relative overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
        <img src={img} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-80" />
        {eta && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-black/50 backdrop-blur-md rounded-full px-1.5 py-0.5 flex items-center gap-1 border border-white/10">
              <Clock size={7} className="text-white" />
              <span className="text-[8px] font-black text-white">{eta}</span>
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 z-10 text-center">
           <span className="text-[10px] sm:text-xs font-bold text-white leading-tight drop-shadow-md">{name}</span>
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Section header ───────────────────────────────────────────────────── */
function SectionHeader({ title, badge, badgeColor = 'bg-indigo-50 text-indigo-600 ring-indigo-100', onSeeAll }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[17px] font-black text-slate-900">{title}</h3>
        {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${badgeColor}`}>{badge}</span>}
      </div>
      {onSeeAll && (
        <motion.button onClick={onSeeAll} className="text-xs font-bold text-indigo-600 flex items-center gap-0.5" whileHover={{ x: 2 }}>
          See all <ChevronRight size={12} strokeWidth={3} />
        </motion.button>
      )}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────── */
export default function HomePage() {
  const nav = useNavigate();
  const { profile } = useSelector(selectAuth);
  const isAuthed     = useSelector(selectIsAuthed);

  const { data }          = useListOrdersQuery(1, { skip: !isAuthed });
  const { data: gamData } = useGetGamificationQuery(undefined, { skip: !isAuthed });
  const { data: recData } = useGetRecommendationsQuery(undefined, { skip: !isAuthed });

  const activeOrder    = data?.orders?.find(o => ACTIVE_STATUSES.includes(o.status));
  const firstName      = profile?.name?.split(' ')[0] || 'there';
  const gam            = gamData?.gamification;
  const recommendations = recData?.recommendations || [];

  // Re-engagement banner (#99): show "book again" nudge if last completed order was >7 days ago
  const lastCompleted = data?.orders?.find(o => o.status === 'completed');
  const daysSinceLastOrder = lastCompleted
    ? Math.floor((Date.now() - new Date(lastCompleted.completedAt || lastCompleted.createdAt).getTime()) / 86_400_000)
    : null;
  const showReengagement = daysSinceLastOrder !== null && daysSinceLastOrder >= 7 && !activeOrder;

  /* ── GPS location detection ───────────────────────────────────────── */
  const [loc, setLoc] = useState({ primary: 'Detecting location…', secondary: null, loading: true });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoc({ primary: 'Location unavailable', secondary: null, loading: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`,
          );
          const data = await res.json();
          const a = data.address || {};
          const primary   = a.neighbourhood || a.suburb || a.village || a.town || a.city || 'Your Location';
          const secondary = [a.city || a.town, a.state].filter(Boolean).join(', ') || null;
          setLoc({ primary, secondary, loading: false });
        } catch {
          setLoc({ primary: 'Location found', secondary: null, loading: false });
        }
      },
      () => setLoc({ primary: 'Moinabad, India', secondary: null, loading: false }),
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 120000 },
    );
  }, []);

  return (
    <PageTransition>
      <IntroSplash />
      <div className="min-h-screen pb-40 bg-white">

        {/* ─── Premium Navbar ───────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white" style={{ boxShadow: '0 1px 0 0 #f1f5f9, 0 4px 20px rgba(0,0,0,0.05)' }}>
          {/* Top accent gradient line */}
          <div className="h-[4px] bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

          <div className="max-w-[1600px] w-full mx-auto px-4 h-[60px] md:h-[80px] flex items-center gap-3 md:gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => nav('/')}>
              <ZappyLogo size={32} className="md:w-10 md:h-10" />
              <span className="hidden lg:block text-2xl font-black tracking-tighter text-slate-900">Zappy</span>
            </div>

            {/* Location widget ─ world-class GPS chip */}
            <motion.button
              className="flex-1 md:flex-none md:w-[280px] min-w-0 flex items-center gap-3 px-4 h-10 md:h-12 rounded-xl relative overflow-hidden text-left"
              style={{
                background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
                border: '1px solid rgba(99,102,241,0.15)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Animated GPS pin */}
              <div className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                <MapPin size={16} strokeWidth={2.5} className="text-indigo-600 relative z-10" />
                {loc.loading && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border border-indigo-400"
                      animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border border-indigo-400"
                      animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
                    />
                  </>
                )}
                {!loc.loading && (
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  />
                )}
              </div>

              {/* Location text */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-0.5">
                  Delivering to
                </p>
                <AnimatePresence mode="wait">
                  {loc.loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5">
                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
                      <span className="text-[13px] font-semibold text-slate-400">Detecting…</span>
                    </motion.div>
                  ) : (
                    <motion.div key="found" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-black text-slate-900 truncate">{loc.primary}</span>
                      {loc.secondary && (
                        <span className="text-[11px] text-slate-400 font-medium truncate hidden sm:block">
                          {loc.secondary}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <ChevronDown size={14} className="text-indigo-400 shrink-0" />
            </motion.button>

            {/* ─── Desktop Search bar ───────────────────────────────────────────── */}
            <div className="hidden md:block flex-1 max-w-2xl mx-auto">
              <motion.button
                onClick={() => nav('/services')}
                className="w-full flex items-center gap-3 rounded-2xl px-5 h-12 text-left"
                style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}
                whileHover={{ borderColor: '#6366f1', background: '#fafbff' }}
                whileTap={{ scale: 0.99 }}
              >
                <Search size={18} strokeWidth={2} className="text-slate-400 shrink-0" />
                <span className="text-[15px] font-medium text-slate-400 flex-1">Search for a service…</span>
                <motion.span
                  className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full shrink-0"
                  animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.5, repeat: Infinity }}
                >
                  50+ services
                </motion.span>
              </motion.button>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Bell */}
              <motion.button
                onClick={() => nav('/notifications')}
                className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 hover:bg-slate-100 transition-colors"
                whileTap={{ scale: 0.88 }}
              >
                <Bell size={18} strokeWidth={1.75} className="text-slate-600" />
                <motion.span
                  className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"
                  animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.button>

              {/* Avatar */}
              <motion.button
                onClick={() => nav('/profile')}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black shadow-md hover:shadow-lg transition-shadow"
                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
                whileTap={{ scale: 0.88 }}
              >
                {firstName[0]?.toUpperCase() || <User size={16} />}
              </motion.button>
            </div>
          </div>
        </header>

        {/* ─── Mobile Search bar ───────────────────────────────────────────── */}
        <div className="md:hidden bg-white px-4 pt-3 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <motion.button
            onClick={() => nav('/services')}
            className="w-full flex items-center gap-3 rounded-xl px-4 h-11 text-left"
            style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}
            whileHover={{ borderColor: '#6366f1', background: '#fafbff' }}
            whileTap={{ scale: 0.99 }}
          >
            <Search size={16} strokeWidth={2} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-400 flex-1">Search for a service…</span>
            <motion.span
              className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full shrink-0"
              animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.5, repeat: Infinity }}
            >
              50+ services
            </motion.span>
          </motion.button>
        </div>

        {/* ─── Hero section ─────────────────────────────────────────── */}
        <div className="max-w-[1600px] w-full mx-auto px-4 pt-5 pb-5">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <motion.h1
                className="text-[26px] font-black text-slate-900 leading-[1.2] mb-2"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              >
                Trusted assistance,<br />at your doorstep
              </motion.h1>
              <motion.p className="text-sm text-slate-500 font-medium"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                Phones · Laptops · Cars · Elders · Pets · Events
              </motion.p>
            </div>
            <div className="mt-2">
              <LiveBadge />
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <HeroCarousel />
          </motion.div>
        </div>

        {/* ─── Trust stats ──────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
          <div className="max-w-[1600px] w-full mx-auto px-4 py-3 flex items-center justify-around">
            {[
              { val: '50K+', label: 'Bookings',     color: 'text-indigo-600' },
              { val: '4.8',  label: 'Avg Rating',   color: 'text-amber-500'  },
              { val: '500+', label: 'Verified Pros', color: 'text-green-600' },
              { val: '<60s', label: 'Avg Match',     color: 'text-violet-600' },
            ].map(({ val, label, color }) => (
              <div key={label} className="text-center">
                <p className={`text-sm font-black ${color}`}>{val}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-[1600px] w-full mx-auto">

          {/* ─── Re-engagement banner (#99) ──────────────────────────── */}
          <AnimatePresence>
            {showReengagement && lastCompleted && (
              <motion.div className="px-4 mt-4"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <motion.button
                  onClick={() => nav(`/book/${lastCompleted.service}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left"
                  style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid rgba(34,197,94,0.25)' }}
                  whileTap={{ scale: 0.98 }}>
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <Clock size={16} strokeWidth={2} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Book again?</p>
                    <p className="text-sm font-bold text-green-900 capitalize truncate mt-0.5">
                      {lastCompleted.service?.replace(/_/g, ' ')} · {daysSinceLastOrder}d ago
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-green-500 shrink-0" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Active order banner ────────────────────────────────── */}
          <AnimatePresence>
            {activeOrder && (
              <motion.div className="px-4 mt-4"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <motion.button
                  onClick={() => nav(`/orders/${activeOrder._id}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                  <motion.div className="absolute inset-0 opacity-20"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }}
                    animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} />
                  <motion.div className="w-3 h-3 rounded-full bg-green-400 shrink-0"
                    animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  <div className="flex-1 min-w-0 relative z-10">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Live Order</p>
                    <p className="text-sm font-bold text-white truncate capitalize mt-0.5">
                      {activeOrder.service.replace(/_/g, ' ')} · {STATUS_LABELS[activeOrder.status]}
                    </p>
                  </div>
                  <ArrowUpRight size={16} className="text-white/70 shrink-0 relative z-10" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Gamification ────────────────────────────────────────── */}
          {gam && (
            <motion.div className="px-4 mt-4">
              <div className="p-4 rounded-2xl bg-white ring-1 ring-slate-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-3">
                  <motion.div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${LEVEL_COLORS[gam.levelName] || 'from-slate-400 to-slate-500'} flex items-center justify-center shrink-0`}
                    whileHover={{ rotate: 8 }} transition={springSnap}>
                    <Trophy size={18} strokeWidth={2} className="text-white" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-black text-slate-900">{gam.levelName}</p>
                      <span className="text-[10px] text-slate-400">{gam.xp} XP</span>
                      {gam.streak >= 2 && (
                        <motion.span className="flex items-center gap-0.5 text-[10px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full ring-1 ring-orange-100"
                          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <Flame size={9} className="fill-orange-500" /> {gam.streak}
                        </motion.span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <motion.div className={`h-full rounded-full bg-gradient-to-r ${LEVEL_COLORS[gam.levelName] || 'from-slate-400 to-slate-500'}`}
                        initial={{ width: '0%' }} animate={{ width: `${Math.min(100, gam.progressPercent || 0)}%` }}
                        transition={{ duration: 1, delay: 0.3 }} />
                    </div>
                    {gam.nextLevelName && <p className="text-[10px] text-slate-400 mt-1">{gam.xpToNext} XP to <strong>{gam.nextLevelName}</strong></p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Quick cards ─────────────────────────────────────────── */}
          <div className="px-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            <motion.button onClick={() => nav('/plans')} className="rounded-2xl p-4 text-left"
              style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid rgba(245,158,11,0.2)', boxShadow: '0 4px 16px rgba(245,158,11,0.1)' }}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <Star size={16} strokeWidth={2} className="text-amber-600 fill-amber-400" />
              </div>
              <p className="text-sm font-black text-slate-900">Go Premium</p>
              <p className="text-[11px] text-amber-700 mt-0.5 font-medium">No surge · No fees</p>
            </motion.button>
            <motion.button onClick={() => nav('/wallet')} className="rounded-2xl p-4 text-left"
              style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid rgba(59,130,246,0.15)', boxShadow: '0 4px 16px rgba(59,130,246,0.08)' }}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Wallet size={16} strokeWidth={2} className="text-blue-600" />
              </div>
              <p className="text-sm font-black text-slate-900">Wallet</p>
              <p className="text-[11px] text-blue-700 mt-0.5 font-medium">Balance &amp; top-up</p>
            </motion.button>
          </div>

          {/* ─── Offers ──────────────────────────────────────────────── */}
          <OffersSection />

          {/* Ad Banners */}
          <div className="px-4"><AdBanner className="mt-4" /></div>

          {/* ─── Electronics Rescue — Most Booked ────────────────────── */}
          <div className="mt-7">
            <div className="px-4">
              <SectionHeader title="Electronics Rescue" badge="Most Booked" badgeColor="bg-indigo-50 text-indigo-600 ring-indigo-100" onSeeAll={() => nav('/services')} />
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">
              {MOST_BOOKED.map((item, i) => (
                <ServiceImageCard key={i} item={item} nav={nav} />
              ))}
              <div className="shrink-0 w-12 flex items-center justify-center">
                <motion.button onClick={() => nav('/services')} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}><ChevronRight size={18} strokeWidth={2.5} className="text-slate-600" /></motion.button>
              </div>
            </div>
          </div>

          {/* ─── Phone Repair grid ────────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Phone Repair" badge="Android & iPhone" badgeColor="bg-indigo-50 text-indigo-600 ring-indigo-100" onSeeAll={() => nav('/services')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', border: '1px solid rgba(99,102,241,0.12)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {PHONE_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><CompactImageTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Laptop Services ──────────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Laptop Services" badge="All Brands" badgeColor="bg-slate-100 text-slate-600 ring-slate-200" onSeeAll={() => nav('/services')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', border: '1px solid rgba(100,116,139,0.15)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {LAPTOP_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><CompactImageTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Smart Devices ────────────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Smart Devices" badge="Install & Fix" badgeColor="bg-amber-50 text-amber-700 ring-amber-100" onSeeAll={() => nav('/services')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {SMART_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><CompactTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Vehicle Care — Image cards ───────────────────────────── */}
          <div className="mt-7">
            <div className="px-4">
              <SectionHeader title="Vehicle Care" badge="On-Road Help" badgeColor="bg-cyan-50 text-cyan-700 ring-cyan-100" onSeeAll={() => nav('/services')} />
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">
              {VEHICLE_HIGHLIGHTS.map((item, i) => <ServiceImageCard key={i} item={item} nav={nav} />)}
              <div className="shrink-0 w-12 flex items-center justify-center">
                <motion.button onClick={() => nav('/services')} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}><ChevronRight size={18} strokeWidth={2.5} className="text-slate-600" /></motion.button>
              </div>
            </div>
          </div>

          {/* ─── Vehicle tiles ────────────────────────────────────────── */}
          <div className="px-4 mt-5">
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid rgba(14,165,233,0.15)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {VEHICLE_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><PosterTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Family & Elder Assist ────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Family Assist" badge="Trusted Help" badgeColor="bg-rose-50 text-rose-600 ring-rose-100" onSeeAll={() => nav('/services')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: '1px solid rgba(244,63,94,0.12)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {FAMILY_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><CompactTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Event Decorations ─────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Event Decorations" badge="🎉 Book a Theme" badgeColor="bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100" onSeeAll={() => nav('/events')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#fdf4ff,#fae8ff)', border: '1px solid rgba(168,85,247,0.12)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {EVENT_TILES.map(svc => (
                  <motion.div key={svc.key} variants={fadeInUp}>
                    <CompactTile svc={{ ...svc, eta: null }} nav={() => nav(`/events/browse?category=${svc.category}`)} />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* ─── Pet Assistance ───────────────────────────────────────── */}
          <div className="px-4 mt-7">
            <SectionHeader title="Pet Assistance" badge="GPS Tracked" badgeColor="bg-amber-50 text-amber-700 ring-amber-100" onSeeAll={() => nav('/services')} />
            <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <motion.div className="flex flex-wrap justify-start md:justify-center gap-4 md:gap-8 xl:gap-10" variants={staggerContainer} initial="initial" animate="animate">
                {PET_TILES.map(svc => <motion.div key={svc.key} variants={fadeInUp}><CompactTile svc={svc} nav={nav} /></motion.div>)}
              </motion.div>
            </div>
          </div>

          {/* ─── Trust strip ──────────────────────────────────────────── */}
          <div className="px-4 mt-7 mb-4">
            <div className="rounded-2xl p-4 ring-1 ring-slate-200/60" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
              <div className="flex items-center justify-around">
                {[
                  { Icon: ShieldCheck, label: 'Insured Work',  color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  { Icon: CheckCircle, label: 'Verified Pros', color: 'text-green-600',  bg: 'bg-green-50'  },
                  { Icon: Lock,        label: 'Secure Pay',    color: 'text-blue-600',   bg: 'bg-blue-50'   },
                  { Icon: TrendingUp,  label: '4.8 Rated',     color: 'text-amber-600',  bg: 'bg-amber-50'  },
                ].map(({ Icon, label, color, bg }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                      <Icon size={16} strokeWidth={1.75} className={color} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 text-center uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <BottomNav active="home" />
      </div>
    </PageTransition>
  );
}
