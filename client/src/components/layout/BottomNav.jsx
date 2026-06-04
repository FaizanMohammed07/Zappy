import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, MapPin, Wallet, User } from 'lucide-react';
import { useListNotificationsQuery } from '../../services/api';
import { useSelector } from 'react-redux';
import { selectIsAuthed } from '../../modules/auth/authSlice';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { key: 'home',     label: 'Home',     path: '/',          Icon: Home },
  { key: 'bookings', label: 'Bookings', path: '/orders',     Icon: ClipboardList },
  { key: 'track',    label: 'Track',    path: '/track',      Icon: MapPin },
  { key: 'wallet',   label: 'Wallet',   path: '/wallet',     Icon: Wallet },
  { key: 'profile',  label: 'Profile',  path: '/profile',    Icon: User },
];

export default function BottomNav({ active }) {
  const nav        = useNavigate();
  const loc        = useLocation();
  const isAuthed   = useSelector(selectIsAuthed);
  const currentKey = active || TABS.find((t) => t.path === loc.pathname)?.key || 'home';

  const { data: notifData } = useListNotificationsQuery(
    { page: 1, unreadOnly: true },
    { skip: !isAuthed, pollingInterval: 60000 }
  );
  const unreadCount = notifData?.notifications?.length || 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] pb-6 px-4 pointer-events-none">
      <motion.nav 
        className="mx-auto max-w-[400px] bg-[#0b0f19]/90 backdrop-blur-xl border border-white/10 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] rounded-3xl h-16 flex items-center justify-between px-2 pointer-events-auto relative"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {TABS.map(({ key, label, path, Icon }) => {
          const isActive = key === currentKey;
          return (
            <button
              key={key}
              onClick={() => nav(path)}
              className="relative w-full h-full flex flex-col items-center justify-center outline-none tap-highlight-transparent"
              aria-label={label}
            >
              <div className="relative z-20 flex items-center justify-center">
                <motion.div
                  animate={{ y: isActive ? -28 : 0 }}
                  transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                  className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300 ${isActive ? 'bg-[#0b0f19] border border-slate-700/60 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.1)]' : 'bg-transparent'}`}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-colors duration-300 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-400 hover:text-slate-200'}`}
                  />
                  {key === 'profile' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow-md ring-2 ring-[#0b0f19]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </motion.div>
              </div>
              
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 15, scale: 0.5 }}
                    animate={{ opacity: 1, y: -2, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.5 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
                    className="absolute bottom-2.5 text-[10px] font-bold text-cyan-400 tracking-wider uppercase drop-shadow-md"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              
              {isActive && (
                <motion.div
                  layoutId="indicator"
                  className="absolute bottom-0 w-8 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-t-full shadow-[0_-4px_12px_rgba(34,211,238,0.6)]"
                  transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
