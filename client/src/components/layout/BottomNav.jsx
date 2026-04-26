import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, MapPin, Wallet, User } from 'lucide-react';

const TABS = [
  { key: 'home',     label: 'Home',     path: '/',          Icon: Home },
  { key: 'bookings', label: 'Bookings', path: '/orders',     Icon: ClipboardList },
  { key: 'track',    label: 'Track',    path: '/track',      Icon: MapPin },
  { key: 'wallet',   label: 'Wallet',   path: '/wallet',     Icon: Wallet },
  { key: 'profile',  label: 'Profile',  path: '/profile',    Icon: User },
];

export default function BottomNav({ active }) {
  const nav = useNavigate();
  const loc = useLocation();
  const currentKey = active || TABS.find((t) => t.path === loc.pathname)?.key || 'home';

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
            <Icon
              size={20}
              strokeWidth={isActive ? 2.5 : 1.75}
              className={isActive ? 'text-zappy-600' : 'text-slate-400'}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
