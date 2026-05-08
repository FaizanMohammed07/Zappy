import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, MapPin, Wallet, User } from 'lucide-react';
import { useListNotificationsQuery } from '../../services/api';
import { useSelector } from 'react-redux';
import { selectIsAuthed } from '../../modules/auth/authSlice';

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
    <nav className="bottom-nav">
      {TABS.map(({ key, label, path, Icon }) => {
        const isActive = key === currentKey;
        return (
          <button
            key={key}
            onClick={() => nav(path)}
            className={`bottom-nav-item${isActive ? ' active' : ''}`}
            aria-label={label}
          >
            <div className="relative">
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.75}
                className={isActive ? 'text-zappy-600' : 'text-slate-400'}
              />
              {key === 'profile' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
