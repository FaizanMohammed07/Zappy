import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { categoryMap } from '../../constants/categoryMap';

/**
 * Character service grid — 3D illustrated category tiles (Zepto-style).
 * Ported from the asif_app design. Typography is baked to the exact tokens it
 * used (caption 13px / micro 11px+0.04em, text-hi #14152A, text-mid #4A4D68,
 * surface #fff) so it renders identically without pulling in that token layer.
 */
const SERVICES = categoryMap;

export default function CharacterServiceGrid() {
  const nav = useNavigate();
  const [playingVideo, setPlayingVideo] = useState(null);

  const handleServiceClick = (svc) => {
    if (svc.id === 'phones' || svc.id === 'laptops' || svc.id === 'cars' || svc.id === 'elders' || svc.id === 'pets' || svc.id === 'events' || svc.id === 'home') {
      setPlayingVideo(svc.id);
    } else {
      nav(svc.id === 'more' ? '/services' : `/services?q=${encodeURIComponent(svc.label)}`);
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
                nav(`/services?q=${vid === 'phones' ? 'Phones' : vid === 'laptops' ? 'Laptops' : vid === 'cars' ? 'Cars' : vid === 'elders' ? 'Elder Care' : vid === 'pets' ? 'Pets' : vid === 'events' ? 'Events' : 'Home'}`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
    <div className="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-4 w-full">
      {SERVICES.map((svc, i) => (
        <motion.button
          key={svc.id}
          onClick={() => handleServiceClick(svc)}
          className="flex flex-col items-center gap-1.5 w-full outline-none group"
          whileTap="tap"
          initial="idle"
          animate="idle"
          whileHover="hover"
        >
          {/* Premium Floating Character (No hard background) */}
          <motion.div
            className="w-full aspect-square relative flex items-end justify-center pt-2 pb-3"
            variants={{
              idle: { scale: 1 },
              hover: { y: -6 },
              tap: { scale: 0.92 },
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {/* Magical Glowing Aura behind character */}
            <motion.div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[65%] h-[65%] rounded-full blur-[24px] opacity-40 transition-opacity duration-300 group-hover:opacity-80"
              style={{ backgroundColor: svc.shadow }} 
            />

            {/* Ground Contact Shadow */}
            <div className="absolute bottom-1 w-[45%] h-[8%] bg-black/15 blur-[4px] rounded-[100%] pointer-events-none transition-transform duration-300 group-hover:scale-110 group-hover:bg-black/20" />

            {svc.img.includes('.mp4') ? (
              <motion.video
                src={svc.img}
                poster={svc.thumb}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-contain z-10 transition-transform duration-300 group-hover:scale-[1.05] mix-blend-multiply"
                style={{ filter: 'brightness(1.3) contrast(1.5)' }}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
              />
            ) : (
              <motion.img
                src={svc.img}
                alt={svc.label}
                className="absolute inset-0 w-full h-full object-contain p-2 z-10 transition-transform duration-300 group-hover:scale-[1.05] mix-blend-multiply"
                loading="lazy"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
              />
            )}
          </motion.div>

          {/* Labels — exact asif_app typography */}
          <div className="text-center w-full mt-[6px]">
            <span className="block text-[13px] leading-[18px] font-bold text-[#14152A] truncate">
              {svc.label}
            </span>
            <span className="block text-[11px] leading-[14px] tracking-[0.04em] font-medium text-[var(--text-mid,#4A4D68)] truncate mt-[2px]">
              {svc.id === 'more' ? (
                <span className="font-semibold text-[var(--text-hi,#14152A)] tabular-nums">{svc.price}</span>
              ) : (
                <>from <span className="font-semibold text-[var(--text-hi,#14152A)] tabular-nums">{svc.price}</span></>
              )}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
    </>
  );
}
