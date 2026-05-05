import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Bell, Search, ChevronRight, Zap, Star, TrendingUp, Wrench,
  Droplets, Bolt, Wind, Hammer, Users, Car, Sparkles, Paintbrush2,
} from 'lucide-react';
import { selectAuth } from '../modules/auth/authSlice';
import { useListOrdersQuery } from '../services/api';
import { ZappyLogo } from '../components/common/ZappyLogo';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import {
  staggerContainer, fadeInUp, fadeIn, scaleIn,
} from '../lib/animations';

const SERVICES = [
  { key: 'electrical', name: 'Electrical', Icon: Bolt,         bg: 'bg-amber-50',   color: 'text-amber-600'  },
  { key: 'plumbing',   name: 'Plumbing',   Icon: Droplets,     bg: 'bg-blue-50',    color: 'text-blue-600'   },
  { key: 'ac_repair',  name: 'AC Repair',  Icon: Wind,         bg: 'bg-cyan-50',    color: 'text-cyan-600'   },
  { key: 'carpenter',  name: 'Carpenter',  Icon: Hammer,       bg: 'bg-orange-50',  color: 'text-orange-600' },
  { key: 'helper',     name: 'Helper',     Icon: Users,        bg: 'bg-green-50',   color: 'text-green-600'  },
  { key: 'puncture',   name: 'Puncture',   Icon: Car,          bg: 'bg-slate-50',   color: 'text-slate-600'  },
  { key: 'cleaning',   name: 'Cleaning',   Icon: Sparkles,     bg: 'bg-purple-50',  color: 'text-purple-600' },
  { key: 'painting',   name: 'Painting',   Icon: Paintbrush2,  bg: 'bg-pink-50',    color: 'text-pink-600'   },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ACTIVE_STATUSES = ['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'];

const STATUS_LABELS = {
  searching:   'Finding a worker',
  assigned:    'Worker assigned',
  on_the_way:  'Worker on the way',
  arrived:     'Worker has arrived',
  in_progress: 'Service in progress',
  created:     'Order placed',
};

export default function HomePage() {
  const nav = useNavigate();
  const { profile } = useSelector(selectAuth);
  const { data } = useListOrdersQuery(1);

  const activeOrder = data?.orders?.find((o) => ACTIVE_STATUSES.includes(o.status));
  const firstName = profile?.name?.split(' ')[0] || 'there';
  const greeting = getGreeting();

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9FAFB] pb-24">

        {/* Header */}
        <header className="bg-white border-b border-slate-100">
          <div className="page-container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ZappyLogo size={32} />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium leading-none">{greeting},</p>
                  <p className="text-[15px] font-bold text-[#0F172A] leading-tight">{firstName} 👋</p>
                </div>
              </div>
              <motion.button
                onClick={() => nav('/notifications')}
                className="relative w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Notifications"
              >
                <Bell size={18} strokeWidth={1.75} className="text-slate-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-zappy-600 rounded-full" />
              </motion.button>
            </div>

            {/* Search */}
            <motion.button
              onClick={() => nav('/services')}
              className="mt-4 w-full flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-btn px-4 py-3 text-left"
              whileHover={{ scale: 1.01, borderColor: '#CBD5E1' }}
              whileTap={{ scale: 0.99 }}
            >
              <Search size={16} strokeWidth={2} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-400 font-medium flex-1">Search for a service…</span>
              <span className="text-[11px] font-semibold text-zappy-600 bg-zappy-50 px-2 py-0.5 rounded-full">
                50+ services
              </span>
            </motion.button>
          </div>
        </header>

        <div className="page-container">

          {/* Active order banner */}
          {activeOrder && (
            <motion.div className="mt-4" variants={fadeIn} initial="initial" animate="animate">
              <motion.button
                onClick={() => nav(`/orders/${activeOrder._id}`)}
                className="w-full flex items-center gap-3 bg-zappy-600 rounded-card p-4 text-left shadow-soft"
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse-slow shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Live order</p>
                  <p className="text-sm font-semibold text-white truncate capitalize">
                    {activeOrder.service.replace(/_/g, ' ')} · {STATUS_LABELS[activeOrder.status] || activeOrder.status}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/70 shrink-0" />
              </motion.button>
            </motion.div>
          )}

          {/* Desktop: hero + promo side by side on lg+ */}
          <div className="mt-4 lg:grid lg:grid-cols-[1fr_280px] lg:gap-4 xl:grid-cols-[1fr_320px]">

            {/* Hero card */}
            <motion.div
              className="card-hero"
              variants={scaleIn}
              initial="initial"
              animate="animate"
            >
              <div className="relative z-10 max-w-[65%]">
                <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-1">Get instant help</p>
                <h2 className="text-[22px] font-bold text-white leading-tight">
                  Need help at home?
                </h2>
                <p className="text-sm text-white/70 mt-1 mb-5 leading-relaxed">
                  Trusted professionals, at your door in minutes.
                </p>
                <motion.button
                  onClick={() => nav('/services')}
                  className="inline-flex items-center gap-2 bg-white text-zappy-700 font-bold text-sm px-5 py-2.5 rounded-btn shadow-soft"
                  whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(15,23,42,0.15)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Zap size={14} strokeWidth={2.5} />
                  Book Now
                </motion.button>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-32 flex items-center justify-center opacity-10">
                <Wrench size={96} strokeWidth={1} className="text-white" />
              </div>
            </motion.div>

            {/* Promo cards — stacked on mobile, shown to the right on lg */}
            <div className="mt-3 lg:mt-0 grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-3">
              <motion.button
                onClick={() => nav('/plans')}
                className="card text-left bg-gradient-to-br from-amber-50 to-orange-50 ring-amber-100"
                whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(251,191,36,0.20)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <Star size={18} strokeWidth={2} className="text-amber-600" />
                </div>
                <p className="text-sm font-bold text-[#0F172A]">Go Premium</p>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">No surge, no fees</p>
              </motion.button>

              <motion.button
                onClick={() => nav('/wallet')}
                className="card text-left"
                whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(37,99,235,0.12)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-10 h-10 rounded-xl bg-zappy-50 flex items-center justify-center mb-3">
                  <TrendingUp size={18} strokeWidth={2} className="text-zappy-600" />
                </div>
                <p className="text-sm font-bold text-[#0F172A]">Wallet</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Balance & top-up</p>
              </motion.button>
            </div>
          </div>

          {/* Services grid */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0F172A] text-[15px]">Our Services</h3>
              <motion.button
                onClick={() => nav('/services')}
                className="text-xs font-semibold text-zappy-600 flex items-center gap-1"
                whileHover={{ x: 2 }}
              >
                View all <ChevronRight size={12} strokeWidth={2.5} />
              </motion.button>
            </div>
            <motion.div
              className="grid grid-cols-4 gap-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {SERVICES.map(({ key, name, Icon, bg, color }) => (
                <motion.button
                  key={key}
                  onClick={() => nav(`/book/${key}`)}
                  className="flex flex-col items-center gap-2 py-1"
                  variants={fadeInUp}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.93 }}
                >
                  <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center shadow-sm`}>
                    <Icon size={24} strokeWidth={1.75} className={color} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">{name}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>

        <BottomNav active="home" />
      </div>
    </PageTransition>
  );
}
