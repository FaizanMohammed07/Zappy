import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/**
 * Character service grid — 3D illustrated category tiles (Zepto-style).
 * Ported from the asif_app design. Typography is baked to the exact tokens it
 * used (caption 13px / micro 11px+0.04em, text-hi #14152A, text-mid #4A4D68,
 * surface #fff) so it renders identically without pulling in that token layer.
 */
const SERVICES = [
  { id: 'phones',  label: 'Phones',  img: '/images/characters/phone2.mp4',  price: '₹99',  tint: 'rgba(37, 99, 235, 0.12)',  shadow: 'rgba(37, 99, 235, 0.18)' },
  { id: 'laptops', label: 'Laptops', img: '/images/characters/laptops2.mp4', price: '₹149', tint: 'rgba(109, 77, 246, 0.12)',  shadow: 'rgba(109, 77, 246, 0.18)' },
  { id: 'cars',    label: 'Cars',    img: '/images/characters/cars2.mp4',    price: '₹199', tint: 'rgba(14, 165, 160, 0.12)',  shadow: 'rgba(14, 165, 160, 0.18)' },
  { id: 'elders',  label: 'Elders',  img: '/images/characters/elders.mp4',  price: '₹299', tint: 'rgba(225, 29, 116, 0.12)',  shadow: 'rgba(225, 29, 116, 0.18)' },
  { id: 'pets',    label: 'Pets',    img: '/images/characters/pet.mp4#t=1',    price: '₹149', tint: 'rgba(245, 158, 11, 0.12)',  shadow: 'rgba(245, 158, 11, 0.18)' },
  { id: 'events',  label: 'Events',  img: '/images/characters/event.mp4#t=1',  price: '₹499', tint: 'rgba(192, 38, 211, 0.12)',  shadow: 'rgba(192, 38, 211, 0.18)' },
  { id: 'home',    label: 'Home',    img: '/images/characters/home.mp4',    price: '₹99',  tint: 'rgba(8, 145, 178, 0.12)',   shadow: 'rgba(8, 145, 178, 0.18)' },
  { id: 'more',    label: 'More',    img: '/images/characters/more.mp4',    price: 'View all', tint: 'rgba(138, 142, 168, 0.12)', shadow: 'rgba(138, 142, 168, 0.18)' },
];

export default function CharacterServiceGrid() {
  const nav = useNavigate();

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-4 w-full">
      {SERVICES.map((svc, i) => (
        <motion.button
          key={svc.id}
          onClick={() => nav(svc.id === 'more' ? '/services' : `/services?q=${encodeURIComponent(svc.label)}`)}
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
          <div className="text-center w-full mt-1.5">
            <span className="block text-[13px] leading-[18px] font-bold text-[#14152A] truncate">
              {svc.label}
            </span>
            <span className="block text-[11px] leading-[14px] tracking-[0.04em] font-medium text-[#4A4D68] truncate mt-0.5">
              {svc.id === 'more' ? (
                svc.price
              ) : (
                <>from <span className="font-semibold text-[#14152A] tabular-nums">{svc.price}</span></>
              )}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
