import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const VEHICLE_IMAGES = [
  {
    id: 1,
    src: '/promos/promo_car_wash.png',
    title: 'Premium Car Wash',
    subtitle: 'At your doorstep, in 60 mins',
    price: 'From ₹349'
  },
  {
    id: 2,
    src: '/promos/promo_bike_wash.png',
    title: 'Bike Detailing',
    subtitle: 'Showroom shine guaranteed',
    price: 'From ₹199'
  },
  {
    id: 3,
    src: '/promos/promo_puncture.png',
    title: 'Emergency Puncture',
    subtitle: 'On-road fast assistance',
    price: 'From ₹99'
  }
];

export function PromoBannerVehicle() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % VEHICLE_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-8 mb-4">
      <div 
        className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
        onClick={() => nav('/services')}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={VEHICLE_IMAGES[currentIndex].src}
            alt={VEHICLE_IMAGES[currentIndex].title}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 p-5 md:p-6 w-full">
          <div className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/30 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">
            Vehicle Care
          </div>
          <AnimatePresence mode="wait">
            <motion.h3 
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-white text-2xl md:text-3xl font-black tracking-tight mb-1"
            >
              {VEHICLE_IMAGES[currentIndex].title}
            </motion.h3>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p 
              key={`sub-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white/90 text-sm md:text-base font-medium mb-4"
            >
              {VEHICLE_IMAGES[currentIndex].subtitle}
            </motion.p>
          </AnimatePresence>
          <div className="flex items-center justify-between">
            <button className="bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg">
              Explore
            </button>
            <AnimatePresence mode="wait">
              <motion.span 
                key={`price-${currentIndex}`}
                className="text-white font-black text-lg"
              >
                {VEHICLE_IMAGES[currentIndex].price}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Indicators */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {VEHICLE_IMAGES.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PromoBannerElectronics() {
  const nav = useNavigate();
  return (
    <div className="mt-6 mb-8">
      <div 
        className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
        onClick={() => nav('/services')}
      >
        <img
          src="/promos/promo_electronics.png"
          alt="Electronics Repair"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 p-5 md:p-6 w-full">
          <div className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/30 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">
            Expert Techs
          </div>
          <h3 className="text-white text-2xl md:text-3xl font-black tracking-tight mb-1">
            Phone & Laptop Repair
          </h3>
          <p className="text-white/90 text-sm md:text-base font-medium mb-4">
            Certified parts, 6 months warranty.
          </p>
          <div className="flex items-center justify-between">
            <button className="bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg">
              Explore
            </button>
            <span className="text-white font-black text-lg">
              From ₹499
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAMILY_IMAGES = [
  {
    id: 1,
    src: '/promos/promo_elderly_care.png',
    title: 'Elderly Care',
    subtitle: 'Compassionate care at home',
    price: 'From ₹499/day'
  },
  {
    id: 2,
    src: '/promos/promo_babysitter.png',
    title: 'Expert Babysitting',
    subtitle: 'Safe, playful & professional',
    price: 'From ₹349/day'
  },
  {
    id: 3,
    src: '/promos/promo_physio.png',
    title: 'Physiotherapy',
    subtitle: 'Recover faster at home',
    price: 'From ₹699'
  }
];

export function PromoBannerFamily() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % FAMILY_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-8 mb-4">
      <div 
        className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
        onClick={() => nav('/services')}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={FAMILY_IMAGES[currentIndex].src}
            alt={FAMILY_IMAGES[currentIndex].title}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 p-5 md:p-6 w-full">
          <div className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/30 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">
            Family Assist
          </div>
          <AnimatePresence mode="wait">
            <motion.h3 
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-white text-2xl md:text-3xl font-black tracking-tight mb-1"
            >
              {FAMILY_IMAGES[currentIndex].title}
            </motion.h3>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p 
              key={`sub-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white/90 text-sm md:text-base font-medium mb-4"
            >
              {FAMILY_IMAGES[currentIndex].subtitle}
            </motion.p>
          </AnimatePresence>
          <div className="flex items-center justify-between">
            <button className="bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg">
              Explore
            </button>
            <AnimatePresence mode="wait">
              <motion.span 
                key={`price-${currentIndex}`}
                className="text-white font-black text-lg"
              >
                {FAMILY_IMAGES[currentIndex].price}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Indicators */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {FAMILY_IMAGES.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PromoBannerEvents() {
  const nav = useNavigate();
  return (
    <div className="mt-6 mb-8">
      <div 
        className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
        onClick={() => nav('/events')}
      >
        <img
          src="/promos/promo_events_decor.png"
          alt="Event Decorations"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 p-5 md:p-6 w-full">
          <div className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/30 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">
            Event Commerce
          </div>
          <h3 className="text-white text-2xl md:text-3xl font-black tracking-tight mb-1">
            Premium Party Decor
          </h3>
          <p className="text-white/90 text-sm md:text-base font-medium mb-4">
            Birthdays & Anniversaries
          </p>
          <div className="flex items-center justify-between">
            <button className="bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg">
              Explore
            </button>
            <span className="text-white font-black text-lg">
              From ₹1499
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
