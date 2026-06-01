import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZappyLogo } from './ZappyLogo';

export default function IntroSplash({ onComplete }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenIntro');
    // For development/testing purposes, you might want to uncomment the line below to clear it
    // localStorage.removeItem('hasSeenIntro');
    
    if (!hasSeen) {
      setIsVisible(true);
      // Play for 5 seconds total before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
        localStorage.setItem('hasSeenIntro', 'true');
        if (onComplete) onComplete();
      }, 5500);
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a] text-white overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Animated Background */}
          <motion.div
            className="absolute inset-0 opacity-40"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.5), transparent 70%)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Main Logo Reveal */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1, type: "spring", stiffness: 100 }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.5)] border border-white/20">
              <ZappyLogo size={48} />
            </div>
            
            <motion.h1 
              className="text-4xl font-black tracking-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              Zappy
            </motion.h1>
            
            <motion.p
              className="text-indigo-300 font-medium text-lg mt-2 tracking-widest uppercase"
              initial={{ opacity: 0, letterSpacing: "0px" }}
              animate={{ opacity: 1, letterSpacing: "4px" }}
              transition={{ delay: 1.8, duration: 1.5 }}
            >
              World Class Service
            </motion.p>
          </motion.div>

          {/* Animated Line */}
          <motion.div
            className="absolute bottom-20 w-px bg-gradient-to-b from-transparent via-indigo-500 to-transparent"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 100, opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
