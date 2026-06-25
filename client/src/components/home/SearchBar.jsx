import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mic, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SEARCH_TERMS = ['phone repair', 'car wash', 'pet grooming', 'AC service', 'plumbing'];

export default function SearchBar() {
  const [idx, setIdx] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % SEARCH_TERMS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 mb-4 w-full">
      <motion.div 
        className="flex-1 flex items-center h-12 bg-[var(--surface)] border border-black/5 rounded-[22px] px-4 shadow-md"
        whileTap={{ scale: 0.98 }}
        onClick={() => nav('/services')}
      >
        <Search size={18} className="text-mid shrink-0 mr-3" />
        
        <div className="relative flex-1 h-full overflow-hidden flex items-center">
          <span className="text-mid mr-1">Search</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={idx}
              className="text-hi font-medium"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              '{SEARCH_TERMS[idx]}'…
            </motion.span>
          </AnimatePresence>
        </div>

        <button className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surface-2)] shrink-0 hover:bg-black/5 transition-colors">
          <Mic size={16} className="text-mid" />
        </button>
      </motion.div>

      <motion.button 
        className="h-12 px-3 rounded-[22px] bg-[var(--surface)] border border-black/5 shadow-md flex items-center justify-center shrink-0"
        whileTap={{ scale: 0.95 }}
        onClick={() => nav('/services')}
      >
        <span className="text-xs font-black text-zappy-600 leading-tight text-center flex flex-col">
          <span>50+</span>
          <span className="flex items-center justify-center gap-0.5">Services <ArrowRight size={10} strokeWidth={3} /></span>
        </span>
      </motion.button>
    </div>
  );
}
