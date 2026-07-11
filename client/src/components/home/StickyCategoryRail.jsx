import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { categoryMap } from '../../constants/categoryMap';

export default function StickyCategoryRail({ activeSection, onSelect }) {
  const [isVisible, setIsVisible] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const railRef = useRef(null);

  // Show rail when hero grid scrolls out of view
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY > 50) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  // Auto-scroll the active category into view in the rail
  useEffect(() => {
    if (activeSection && railRef.current) {
      const activeEl = document.getElementById(`rail-item-${activeSection}`);
      if (activeEl) {
        // Scroll the rail horizontally so the active item is centered
        const railRect = railRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();

        const scrollLeft = activeEl.offsetLeft - railRect.width / 2 + activeRect.width / 2;
        railRef.current.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, [activeSection, isVisible]);

  const handleSelect = (cat) => {
    if (cat.id === 'phones' || cat.id === 'laptops' || cat.id === 'cars' || cat.id === 'elders' || cat.id === 'pets' || cat.id === 'events' || cat.id === 'home') {
      setPlayingVideo(cat.id);
    } else {
      onSelect(cat.targetId);
    }
  };

  return (
    <>
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
            onClick={() => setPlayingVideo(null)}
          >
            <video
              src={`/${playingVideo}.mp4`}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onEnded={() => {
                const vid = playingVideo;
                setPlayingVideo(null);
                onSelect(vid === 'phones' ? 'shelf-phones' : vid === 'laptops' ? 'shelf-laptops' : vid === 'cars' ? 'shelf-cars' : vid === 'elders' ? 'shelf-elders' : vid === 'pets' ? 'shelf-pets' : vid === 'events' ? 'shelf-events' : 'shelf-home');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          // Top value accounts for the sticky header (60px mobile, 84px desktop)
          className="sticky top-[60px] md:top-[84px] z-20 w-full bg-white/90 backdrop-blur-xl border-b border-black/5 shadow-sm"
        >
          <div
            ref={railRef}
            className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2.5 px-4 max-w-7xl mx-auto"
            role="tablist"
          >
            {categoryMap.map((cat) => {
              const isActive = activeSection === cat.targetId;
              return (
                <button
                  key={cat.id}
                  id={`rail-item-${cat.targetId}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelect(cat)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group outline-none"
                >
                  <motion.div
                    className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-visible transition-all duration-300 flex items-center justify-center ${isActive
                      ? 'ring-2 ring-[#6D4DF6] ring-offset-2 scale-[1.05]'
                      : 'ring-1 ring-slate-200 bg-slate-50'
                      }`}
                  >
                    {/* Character Media */}
                    {cat.img.includes('.mp4') ? (
                      <video
                        src={cat.img}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-10 h-10 md:w-12 md:h-12 object-contain mix-blend-multiply"
                      />
                    ) : (
                      <img
                        src={cat.img}
                        alt={cat.label}
                        className="w-10 h-10 md:w-12 md:h-12 object-contain mix-blend-multiply"
                        loading="lazy"
                      />
                    )}

                    {/* Active Check Badge (Swiggy Style) */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-[#6D4DF6] rounded-full flex items-center justify-center ring-2 ring-white shadow-sm"
                        >
                          <Check size={10} strokeWidth={3} className="text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <span
                    className={`text-[10px] md:text-[11px] leading-tight truncate transition-colors duration-200 ${isActive ? 'font-bold text-[#6D4DF6]' : 'font-medium text-[#4A4D68]'
                      }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Edge fade masks for horizontal scroll */}
          <div className="absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
