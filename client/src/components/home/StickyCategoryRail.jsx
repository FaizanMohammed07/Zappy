import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { categoryMap } from '../../constants/categoryMap';

// Sticky header heights (must match the <header> in HomePage: h-[60px] md:h-[84px]).
const HEADER_H_MOBILE = 60;
const HEADER_H_DESKTOP = 84;

/**
 * Swiggy-style "What's on your mind" rail.
 *
 * Appearance is driven by an IntersectionObserver on a 1px sentinel placed right
 * after the character grid — NOT a scrollY listener (which is fragile and breaks
 * when the page scrolls on an inner element). Pinning is pure CSS `position:
 * sticky`. A zero-height sticky anchor holds the bar so it reserves no layout
 * space while hidden; the visible bar is absolutely positioned inside it and
 * overlays the content that scrolls beneath once pinned.
 */
export default function StickyCategoryRail({ activeSection, onSelect }) {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef(null);
  const railRef = useRef(null);
  const prefersReduced = useReducedMotion();

  // Show the rail once the sentinel (after the grid) scrolls above the header.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const headerH = window.matchMedia('(min-width: 768px)').matches
      ? HEADER_H_DESKTOP
      : HEADER_H_MOBILE;

    const io = new IntersectionObserver(
      ([entry]) => {
        // Visible only when the sentinel has scrolled ABOVE the header bottom
        // (not merely off the bottom of the viewport).
        setShow(!entry.isIntersecting && entry.boundingClientRect.top < headerH);
      },
      { rootMargin: `-${headerH}px 0px 0px 0px`, threshold: [0, 1] },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  // Center the active thumbnail within the rail only (block:'nearest' keeps the
  // page from scrolling). Runs whenever the active shelf changes.
  useEffect(() => {
    if (!activeSection) return;
    const el = document.getElementById(`rail-item-${activeSection}`);
    el?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }, [activeSection, prefersReduced]);

  return (
    <>
      {/* 1px sentinel — sits in normal flow right after the grid. */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* Zero-height sticky anchor: pins under the header, reserves no space. */}
      <div className="sticky top-[60px] md:top-[84px] z-30 h-0">
        <div
          role="tablist"
          aria-hidden={!show}
          className={`absolute inset-x-0 top-0 border-t border-black/5 bg-white/90 backdrop-blur-xl shadow-[0_8px_20px_-12px_rgba(15,23,42,0.28)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:translate-y-0 ${
            show
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div
            ref={railRef}
            className="relative flex items-center gap-5 md:gap-8 overflow-x-auto no-scrollbar px-4 py-3 max-w-7xl mx-auto [scroll-snap-type:x_proximity]"
          >
            {categoryMap.map((cat) => {
              const isActive = activeSection === cat.targetId;
              return (
                <button
                  key={cat.id}
                  id={`rail-item-${cat.targetId}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelect(cat.targetId)}
                  className="flex flex-col items-center gap-1.5 shrink-0 outline-none [scroll-snap-align:center]"
                >
                  <motion.span
                    className={`relative flex items-center justify-center w-14 h-14 md:w-[68px] md:h-[68px] rounded-full transition-shadow duration-200 ${
                      isActive
                        ? 'ring-2 ring-[#6D4DF6] ring-offset-2 ring-offset-white'
                        : 'ring-1 ring-slate-200'
                    }`}
                    style={{ backgroundColor: cat.tint }}
                    animate={{ scale: isActive && !prefersReduced ? 1.05 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    <img
                      src={cat.thumb}
                      alt=""
                      loading="lazy"
                      className="w-11 h-11 md:w-14 md:h-14 object-contain mix-blend-multiply"
                    />

                    {/* Active tick badge (Swiggy style) */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-[#6D4DF6] flex items-center justify-center ring-2 ring-white shadow-sm"
                        >
                          <Check size={10} strokeWidth={3} className="text-white" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>

                  <span
                    className={`text-[12px] md:text-[13px] leading-tight max-w-[72px] text-center truncate transition-colors duration-200 ${
                      isActive
                        ? 'font-semibold text-[#6D4DF6]'
                        : 'font-medium text-[var(--text-mid,#4A4D68)]'
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Edge-fade masks for the horizontal scroll */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </>
  );
}
