import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, MapPin, Wallet, User } from 'lucide-react';
import { useListNotificationsQuery } from '../../services/api';
import { useSelector } from 'react-redux';
import { selectIsAuthed } from '../../modules/auth/authSlice';
import { motion } from 'framer-motion';

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
    <div className="fixed bottom-0 left-0 right-0 z-[100] pb-6 px-4 pointer-events-none flex justify-center">
      <motion.nav 
        className="w-full max-w-[420px] bg-white/80 backdrop-blur-xl border border-black/5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.1)] rounded-[24px] h-[68px] flex items-center justify-between px-2 pointer-events-auto relative"
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
              className="relative flex-1 h-full flex flex-col items-center justify-center gap-1 outline-none tap-highlight-transparent group"
              aria-label={label}
            >
              <div className="relative z-20 flex items-center justify-center">
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className="relative flex flex-col items-center justify-center"
                >
                  <Icon
                    size={24}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-colors duration-300 ${isActive ? 'text-[var(--violet)] drop-shadow-sm' : 'text-mid group-hover:text-hi'}`}
                    fill={isActive ? 'currentColor' : 'none'}
                  />
                  {key === 'profile' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow-md ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </motion.div>
              </div>
              
              <span
                className={`text-[10px] font-bold tracking-wide transition-colors duration-300 ${isActive ? 'text-[var(--violet)]' : 'text-mid'}`}
              >
                {label}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -bottom-[2px] w-12 h-[3px] bg-[var(--violet)] rounded-t-full shadow-[0_-4px_12px_rgba(109,77,246,0.4)]"
                  transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
