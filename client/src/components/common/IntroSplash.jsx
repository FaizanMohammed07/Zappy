import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZappyLogo } from './ZappyLogo';

export default function IntroSplash({ onComplete }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenIntro');
    if (!hasSeen) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        localStorage.setItem('hasSeenIntro', 'true');
        if (onComplete) onComplete();
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      if (onComplete) onComplete();
    }
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="intro-splash"
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: '#4f46e5' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-24 h-24 bg-white/20 rounded-[1.75rem] flex items-center justify-center mb-6">
              <ZappyLogo size={52} className="text-white" />
            </div>

            <motion.h1
              className="text-5xl font-black tracking-tighter text-white"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              Zappy
            </motion.h1>

            <motion.p
              className="text-white/60 font-bold text-sm mt-3 tracking-[0.25em] uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              Services Redefined
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
