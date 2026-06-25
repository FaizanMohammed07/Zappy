import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Laptop, Car, Heart, Dog, PartyPopper, Wrench, Grid3X3 } from 'lucide-react';

const SERVICES = [
  { id: 'phones', label: 'Phones', icon: Smartphone, price: '₹99', grad: 'from-blue-500/10 to-indigo-500/10', color: 'text-blue-400' },
  { id: 'laptops', label: 'Laptops', icon: Laptop, price: '₹149', grad: 'from-purple-500/10 to-pink-500/10', color: 'text-purple-400' },
  { id: 'cars', label: 'Cars', icon: Car, price: '₹199', grad: 'from-slate-500/10 to-slate-700/10', color: 'text-slate-300' },
  { id: 'elders', label: 'Elders', icon: Heart, price: '₹299', grad: 'from-rose-500/10 to-red-500/10', color: 'text-rose-400' },
  { id: 'pets', label: 'Pets', icon: Dog, price: '₹149', grad: 'from-amber-500/10 to-orange-500/10', color: 'text-amber-400' },
  { id: 'events', label: 'Events', icon: PartyPopper, price: '₹499', grad: 'from-fuchsia-500/10 to-purple-500/10', color: 'text-fuchsia-400' },
  { id: 'home', label: 'Home', icon: Wrench, price: '₹99', grad: 'from-teal-500/10 to-emerald-500/10', color: 'text-teal-400' },
  { id: 'more', label: 'More', icon: Grid3X3, price: 'View all', grad: 'from-white/5 to-white/10', color: 'text-content-secondary' },
];

export default function ServiceGrid() {
  const nav = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-3 mb-6 w-full">
      {SERVICES.map((svc) => {
        const Icon = svc.icon;
        return (
          <motion.button
            key={svc.id}
            onClick={() => nav(svc.id === 'more' ? '/services' : `/book/${svc.id}`)}
            className="flex flex-col items-center gap-1.5 w-full outline-none"
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -2 }}
          >
            <div className={`w-full aspect-square rounded-squircle bg-gradient-to-br ${svc.grad} border border-white/5 shadow-soft flex items-center justify-center relative overflow-hidden group`}>
              {/* Glass reflection highlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-squircle pointer-events-none" />
              
              <Icon size={28} strokeWidth={1.5} className={`${svc.color} drop-shadow-md group-hover:scale-110 transition-transform duration-300`} />
            </div>
            <div className="text-center w-full">
              <span className="block text-[11px] sm:text-xs font-bold text-content-primary leading-tight truncate">{svc.label}</span>
              <span className="block text-[9px] sm:text-[10px] font-medium text-content-muted leading-tight truncate mt-0.5">from {svc.price}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
