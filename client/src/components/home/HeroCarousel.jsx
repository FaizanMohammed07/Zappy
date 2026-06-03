import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    id: 1,
    title: 'Expert Phone Repair',
    subtitle: 'Cracked screen? Battery issues? We fix it at your doorstep.',
    image: '/assets/hero_phone_repair_1780323166772.png',
    tag: 'Trending',
  },
  {
    id: 2,
    title: 'Premium Vehicle Care',
    subtitle: 'From jump starts to detailing. Your ride, our pride.',
    image: '/assets/hero_vehicle_care_1780323182530.png',
    tag: 'On-Demand',
  },
  {
    id: 3,
    title: 'Compassionate Care',
    subtitle: 'Trusted companions for your elders and family.',
    image: '/assets/hero_family_assist_1780323217410.png',
    tag: 'Highly Rated',
  },
  {
    id: 4,
    title: 'Pamper Your Pets',
    subtitle: 'Professional grooming and sitting for your furry friends.',
    image: '/assets/hero_pet_care_1780323201593.png',
    tag: 'New',
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[280px] sm:h-[350px] md:h-[360px] lg:h-[460px] xl:h-[520px] rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Background Image */}
          <img
            src={SLIDES[current].image}
            alt={SLIDES[current].title}
            className="w-full h-full object-cover"
          />
          
          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent" />

          {/* Content Overlay */}
          <div className="absolute inset-0 p-5 md:p-10 lg:p-14 flex flex-col justify-end">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="max-w-2xl"
            >
              <span className="inline-block px-3 py-1 mb-3 text-[10px] md:text-xs font-black uppercase tracking-wider text-white bg-indigo-600 rounded-full backdrop-blur-md shadow-sm">
                {SLIDES[current].tag}
              </span>
              <h2 className="text-2xl md:text-4xl lg:text-6xl font-black text-white leading-tight mb-2 md:mb-4">
                {SLIDES[current].title}
              </h2>
              <p className="text-sm md:text-lg lg:text-xl text-slate-300 mb-5 md:mb-8 line-clamp-2 md:line-clamp-none max-w-xl">
                {SLIDES[current].subtitle}
              </p>
              
              <motion.button
                onClick={() => nav('/services')}
                className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-4 bg-white text-indigo-900 font-bold px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl shadow-lg md:text-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center gap-2">
                  <Zap size={16} className="text-indigo-600" fill="currentColor" />
                  Book Now
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination Dots */}
      <div className="absolute top-4 md:top-8 left-0 right-0 flex justify-center gap-1.5 md:gap-2 z-10">
        {SLIDES.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 md:h-1.5 rounded-full transition-all duration-300 ${
              idx === current ? 'w-6 md:w-10 bg-white' : 'w-2 md:w-3 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
