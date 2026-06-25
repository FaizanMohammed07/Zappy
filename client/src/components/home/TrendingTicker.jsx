import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

const TICKERS = [
  "Ravi just booked a Phone Screen Repair · 2 min ago",
  "Priya booked an AC Service in Narsingi · 5 min ago",
  "Rahul rated his Car Wash 5 stars ⭐ · 12 min ago",
  "Sneha ordered Pet Grooming · 18 min ago",
];

export default function TrendingTicker() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % TICKERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[22px] px-4 py-3 flex items-center gap-3 shadow-sm mb-8">
      <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
        <TrendingUp size={12} className="text-[var(--accent)]" />
      </div>
      
      <div className="relative flex-1 h-[18px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            className="absolute inset-0 flex items-center text-[11px] sm:text-xs font-medium text-mid truncate"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {TICKERS[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
