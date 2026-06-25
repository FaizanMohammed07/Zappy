import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MapPin, ChevronDown, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ZappyLogo } from '../common/ZappyLogo';

export default function Header({ loc, onOpenLocSheet, firstName }) {
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-30 w-full h-14 md:h-16 flex items-center justify-between px-4 bg-white/80 backdrop-blur-xl border-b border-black/5">
      {/* Left: Logo */}
      <motion.button
        onClick={() => nav('/')}
        className="shrink-0 outline-none flex items-center"
        whileTap={{ scale: 0.95 }}
      >
        <ZappyLogo size={28} />
      </motion.button>

      {/* Center: Location Pill */}
      <motion.button
        onClick={onOpenLocSheet}
        className="flex-1 max-w-[200px] flex items-center justify-center gap-1.5 mx-2 outline-none"
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative flex items-center justify-center">
          {loc.loading ? (
            <Loader2 size={14} className="text-zappy-400 animate-spin" />
          ) : (
            <>
              <MapPin size={14} className="text-[var(--accent)] relative z-10" />
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] ring-1 ring-[var(--bg)]"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </>
          )}
        </div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[9px] font-black text-mid uppercase tracking-widest leading-none">Delivering to</span>
          <span className="text-xs font-bold text-hi truncate max-w-full leading-tight">
            {loc.loading ? 'Detecting...' : loc.primary}
          </span>
        </div>
        <ChevronDown size={14} className="text-mid shrink-0" />
      </motion.button>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <motion.button
          onClick={() => nav('/notifications')}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center border border-black/5"
          whileTap={{ scale: 0.9 }}
        >
          <Bell size={16} className="text-hi" />
        </motion.button>

        <motion.button
          onClick={() => nav('/profile')}
          className="w-9 h-9 rounded-full bg-[var(--violet)] flex items-center justify-center text-white text-xs font-black shadow-md border border-black/5"
          whileTap={{ scale: 0.9 }}
        >
          {firstName?.[0]?.toUpperCase() || <User size={14} />}
        </motion.button>
      </div>
    </header>
  );
}
