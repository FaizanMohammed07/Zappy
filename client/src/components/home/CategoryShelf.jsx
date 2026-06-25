import { motion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CategoryShelf({ title, tag, items }) {
  const nav = useNavigate();

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-hi tracking-tight">{title}</h2>
          {tag && (
            <span className="px-2 py-0.5 bg-[var(--surface-2)] text-[var(--violet-ink)] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[var(--border)]">
              {tag}
            </span>
          )}
        </div>
        <button 
          onClick={() => nav('/services')}
          className="text-xs font-bold text-mid hover:text-[var(--violet)] flex items-center gap-1 transition-colors"
        >
          See all <ArrowRight size={14} />
        </button>
      </div>

      {/* Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-4 snap-x snap-mandatory">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            className="shrink-0 w-[160px] md:w-[200px] snap-start bg-[var(--surface)] rounded-[20px] border border-[var(--border)] shadow-md overflow-hidden cursor-pointer"
            whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
            whileTap={{ scale: 0.96, boxShadow: 'var(--shadow-sm)' }}
            onClick={() => nav('/book/service')}
          >
            {/* Image */}
            <div className="relative w-full aspect-[16/10] bg-[var(--bg)]">
              <img 
                src={item.image} 
                alt={item.name} 
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {item.discount && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[var(--accent)] text-[var(--accent-ink)] text-[10px] font-black rounded shadow-sm">
                  {item.discount}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-3">
              <h3 className="text-caption font-bold text-hi leading-tight mb-1 truncate">{item.name}</h3>
              <div className="flex items-center gap-1 mb-2">
                <Star size={10} className="text-[var(--star)] fill-[var(--star)]" />
                <span className="text-caption font-semibold text-hi tabular-nums">{item.rating}</span>
                <span className="text-micro text-mid tabular-nums">({item.reviews})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-caption font-semibold text-mid">from</span>
                <span className="text-body font-bold text-hi tabular-nums">{item.price}</span>
                {item.mrp && (
                  <span className="text-micro text-mid line-through tabular-nums">{item.mrp}</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
