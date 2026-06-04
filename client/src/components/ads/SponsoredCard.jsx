import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useTrackAdImpressionMutation, useTrackAdClickMutation } from '../../services/api';

// Session-level impression dedup (never double-count on re-render)
const _impressed = new Set();

/**
 * SponsoredCard — wraps any content block with sponsored badge + tracking.
 * Works for event themes, service listings, cross-sell cards, etc.
 *
 * Props:
 *   ad        { _id, content, type }  — ad object from API
 *   placement  string                 — which slot this is in
 *   children   ReactNode              — the actual card content
 *   className  string
 */
export default function SponsoredCard({ ad, placement, children, className = '' }) {
  const nav = useNavigate();
  const ref = useRef(null);
  const [trackImpression] = useTrackAdImpressionMutation();
  const [trackClick]      = useTrackAdClickMutation();

  // Intersection-observer based impression tracking
  useEffect(() => {
    if (!ad?._id || _impressed.has(String(ad._id))) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !_impressed.has(String(ad._id))) {
          _impressed.add(String(ad._id));
          trackImpression({ id: String(ad._id), placement }).catch(() => {});
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad?._id, placement]);

  function handleClick() {
    trackClick({ id: String(ad._id), placement }).catch(() => {});
    if (ad.content?.ctaLink) {
      if (ad.content.ctaLink.startsWith('http')) window.open(ad.content.ctaLink, '_blank', 'noopener');
      else nav(ad.content.ctaLink);
    }
  }

  if (!ad) return children || null;

  return (
    <motion.div ref={ref} className={`relative cursor-pointer ${className}`} onClick={handleClick}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
      {children}
      {/* Sponsored badge */}
      <div className="absolute top-2 left-2 z-10">
        <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          <Zap size={8} className="text-yellow-400 fill-yellow-400" />
          Sponsored
        </span>
      </div>
    </motion.div>
  );
}

/**
 * SponsoredBadge — inline badge only (when card is already wrapped elsewhere)
 */
export function SponsoredBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
      <Zap size={8} className="text-amber-500 fill-amber-500" />
      Sponsored
    </span>
  );
}
