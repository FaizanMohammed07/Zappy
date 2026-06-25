import { motion } from 'framer-motion';
import { Repeat2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RECENT = [
  { id: 'screen_replacement', label: 'Screen Replacement', date: '2 weeks ago', icon: '📱' },
  { id: 'bike_wash', label: 'Bike Wash', date: '1 month ago', icon: '🏍️' },
  { id: 'smart_tv_install', label: 'Smart TV Setup', date: '2 months ago', icon: '📺' },
];

export default function RecentRail() {
  const nav = useNavigate();

  if (RECENT.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Repeat2 size={16} className="text-[var(--violet)]" />
        <span className="text-xs font-black text-hi uppercase tracking-widest">Book Again</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {RECENT.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => nav(`/book/${item.id}`)}
            className="shrink-0 w-44 md:w-56 p-3 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-between group"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg)] flex items-center justify-center text-lg shadow-inner">
                {item.icon}
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-hi leading-tight mb-0.5">{item.label}</span>
                <span className="block text-[10px] font-medium text-low">{item.date}</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-mid group-hover:text-[var(--violet)] transition-colors" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
