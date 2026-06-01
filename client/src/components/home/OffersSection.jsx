import React from 'react';
import { motion } from 'framer-motion';
import { Tag, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OFFERS = [
  {
    id: 1,
    title: 'Flat 20% Off',
    subtitle: 'On your first AC Service or Repair',
    code: 'ZAPPY20',
    icon: Sparkles,
    bg: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    textColor: 'text-indigo-100',
  },
  {
    id: 2,
    title: 'Free Checkup',
    subtitle: 'With any premium car wash',
    code: 'AUTO100',
    icon: Tag,
    bg: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    textColor: 'text-blue-100',
  },
  {
    id: 3,
    title: '₹100 Cashback',
    subtitle: 'Pay via Zappy Wallet for instant cashback',
    code: 'WALLET100',
    icon: Clock,
    bg: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    textColor: 'text-amber-100',
  },
];

export default function OffersSection() {
  const nav = useNavigate();

  return (
    <div className="mt-8 mb-4 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[17px] md:text-xl lg:text-2xl font-black text-slate-900">Special Offers</h3>
        <button 
          onClick={() => nav('/offers')}
          className="text-xs md:text-sm font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 transition-colors"
        >
          View All <ArrowRight size={14} strokeWidth={3} />
        </button>
      </div>
      
      <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        {OFFERS.map((offer) => (
          <motion.div
            key={offer.id}
            className="shrink-0 w-[260px] md:w-[320px] lg:w-[400px] rounded-2xl p-5 md:p-6 lg:p-8 relative overflow-hidden text-white shadow-lg md:shadow-xl"
            style={{ background: offer.bg }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.96 }}
          >
            {/* Background Decorations */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <offer.icon size={24} className="text-white" />
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/10 shadow-sm">
                  <span className="text-[11px] md:text-xs font-black tracking-widest">{offer.code}</span>
                </div>
              </div>
              
              <h4 className="text-2xl lg:text-3xl font-black mb-1.5 leading-tight">{offer.title}</h4>
              <p className={`text-sm lg:text-base font-medium ${offer.textColor}`}>{offer.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
