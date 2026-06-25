import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const PROMOS = [
  {
    id: 'p1',
    title: 'Premium Vehicle Care',
    subtitle: 'Get your car showroom ready',
    img: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&h=300&q=80',
    cta: 'Book Now',
  },
  {
    id: 'p2',
    title: 'Monsoon Pet Grooming',
    subtitle: 'Keep your furry friends clean',
    img: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&h=300&q=80',
    cta: 'Explore',
  },
];

export default function PromoCarousel() {
  const nav = useNavigate();

  return (
    <div className="w-full overflow-hidden mb-6">
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 -mx-4 pb-2">
        {PROMOS.map((promo) => (
          <motion.div
            key={promo.id}
            className="snap-center shrink-0 w-[85%] md:w-[60%] h-[140px] sm:h-[160px] rounded-card-lg relative overflow-hidden shadow-soft"
            whileTap={{ scale: 0.98 }}
            onClick={() => nav('/services')}
          >
            <img src={promo.img} alt={promo.title} className="w-full h-full object-cover" />
            
            {/* Dark Scrim for text legibility (keeps white text popping) */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(20,21,42,0.85) 0%, transparent 100%)' }} />
            
            <div className="absolute inset-y-0 left-0 p-4 sm:p-5 flex flex-col justify-between max-w-[70%]">
              <div>
                <h3 className="text-white text-h3 leading-tight mb-1">{promo.title}</h3>
                <p className="text-white/80 text-caption leading-tight">{promo.subtitle}</p>
              </div>
              <button className="bg-[var(--accent)] text-[var(--accent-ink)] text-micro font-bold px-3 py-1.5 rounded-full w-max shadow-sm">
                {promo.cta}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Dot Indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {PROMOS.map((_, i) => (
          <div key={i} className={`h-1 rounded-full ${i === 0 ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-black/10'}`} />
        ))}
      </div>
    </div>
  );
}
