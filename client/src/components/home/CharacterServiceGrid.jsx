import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SERVICES = [
  { id: 'phones', label: 'Phones', img: '/images/characters/phones.png', price: '₹99', tint: 'rgba(37, 99, 235, 0.12)', shadow: 'rgba(37, 99, 235, 0.18)' },
  { id: 'laptops', label: 'Laptops', img: '/images/characters/laptops.png', price: '₹149', tint: 'rgba(109, 77, 246, 0.12)', shadow: 'rgba(109, 77, 246, 0.18)' },
  { id: 'cars', label: 'Cars', img: '/images/characters/cars.png', price: '₹199', tint: 'rgba(14, 165, 160, 0.12)', shadow: 'rgba(14, 165, 160, 0.18)' },
  { id: 'elders', label: 'Elders', img: '/images/characters/elders.png', price: '₹299', tint: 'rgba(225, 29, 116, 0.12)', shadow: 'rgba(225, 29, 116, 0.18)' },
  { id: 'pets', label: 'Pets', img: '/images/characters/pets.png', price: '₹149', tint: 'rgba(245, 158, 11, 0.12)', shadow: 'rgba(245, 158, 11, 0.18)' },
  { id: 'events', label: 'Events', img: '/images/characters/events.png', price: '₹499', tint: 'rgba(192, 38, 211, 0.12)', shadow: 'rgba(192, 38, 211, 0.18)' },
  { id: 'home', label: 'Home', img: '/images/characters/home.png', price: '₹99', tint: 'rgba(8, 145, 178, 0.12)', shadow: 'rgba(8, 145, 178, 0.18)' },
  { id: 'more', label: 'More', img: '/images/characters/more.png', price: 'View all', tint: 'rgba(138, 142, 168, 0.12)', shadow: 'rgba(138, 142, 168, 0.18)' },
];

export default function CharacterServiceGrid() {
  const nav = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-3 mb-6 w-full">
      {SERVICES.map((svc, i) => (
        <motion.button
          key={svc.id}
          onClick={() => nav(svc.id === 'more' ? '/services' : `/book/${svc.id}`)}
          className="flex flex-col items-center gap-1.5 w-full outline-none group"
          whileTap="tap"
          initial="idle"
          animate="idle"
          whileHover="hover"
        >
          {/* Tile Surface */}
          <motion.div
            className="w-full aspect-square rounded-[20px] bg-[var(--surface)] relative overflow-hidden flex items-end justify-center pt-2 pb-3"
            style={{ 
              boxShadow: `0 8px 24px ${svc.shadow}`,
            }}
            variants={{
              idle: { scale: 1 },
              hover: { y: -2, boxShadow: `0 12px 32px ${svc.shadow}` },
              tap: { scale: 0.94, boxShadow: `0 4px 12px ${svc.shadow}` }
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {/* Tinted background wash (12%) */}
            <div className="absolute inset-0 pointer-events-none transition-colors duration-300 group-hover:opacity-80" style={{ backgroundColor: svc.tint }} />

            
            {/* Contact shadow under character to ground it on light background */}
            <div className="absolute bottom-1.5 w-[60%] h-[12%] bg-black/15 blur-[6px] rounded-[100%] pointer-events-none" />

            {/* Faint inner top-highlight */}
            <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

            {/* 3D Character with idle float */}
            <motion.img
              src={svc.img}
              alt={svc.label}
              className="w-[85%] h-auto object-contain relative z-10"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            />
          </motion.div>

          {/* Labels */}
          <div className="text-center w-full mt-1.5">
            <span className="block text-caption font-bold text-hi leading-tight truncate">
              {svc.label}
            </span>
            <span className="block text-micro font-medium text-mid leading-tight truncate mt-0.5">
              {svc.id === 'more' ? (
                svc.price
              ) : (
                <>from <span className="font-semibold text-hi tabular-nums">{svc.price}</span></>
              )}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
