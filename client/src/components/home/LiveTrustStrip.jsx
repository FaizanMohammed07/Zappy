import { motion } from 'framer-motion';
import { Star, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LiveTrustStrip() {
  const [workers, setWorkers] = useState(46);

  // Simulate live worker count changes
  useEffect(() => {
    const id = setInterval(() => {
      setWorkers(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full overflow-hidden mb-5">
      <motion.div 
        className="flex items-center gap-3 w-max"
        animate={{ x: [0, -100, 0] }} // Very subtle drift
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        {/* Worker Count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-sm backdrop-blur-md">
          <motion.div 
            className="w-2 h-2 rounded-full bg-[var(--success)]"
            animate={{ opacity: [1, 0.4, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-caption font-medium text-hi">{workers} workers live near you</span>
        </div>

        {/* ETA */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-sm backdrop-blur-md">
          <Clock size={12} className="text-[var(--violet)]" />
          <span className="text-caption font-medium text-hi">Avg arrival 18 min</span>
        </div>

        {/* Ratings */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-sm backdrop-blur-md">
          <Star size={12} className="text-[var(--star)] fill-[var(--star)]" />
          <span className="text-caption font-medium text-hi tabular-nums">4.8 <span className="text-mid text-micro">(12k+ jobs)</span></span>
        </div>
      </motion.div>
    </div>
  );
}
