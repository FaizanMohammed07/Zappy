import { motion } from 'framer-motion';
import { Crown, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PremiumWalletDuo() {
  const nav = useNavigate();

  return (
    <div className="flex flex-col md:flex-row gap-4 px-4 mb-10 w-full">
      {/* Premium Card */}
      <motion.div 
        className="flex-1 bg-gradient-to-br from-[var(--violet)] to-[#312E81] rounded-[24px] p-5 relative overflow-hidden shadow-lg cursor-pointer"
        whileTap={{ scale: 0.98 }}
        onClick={() => nav('/premium')}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Crown size={20} className="text-[var(--star)] fill-[var(--star)]" />
          </div>
          <span className="px-2 py-1 bg-white/20 rounded-md text-[10px] font-black tracking-wider text-white uppercase backdrop-blur-sm border border-white/20">
            Join Now
          </span>
        </div>
        <h3 className="text-lg font-black text-white mb-1 relative z-10">Zappy Premium</h3>
        <p className="text-xs text-white/80 font-medium relative z-10">Free checkups & 10% off forever</p>
      </motion.div>

      {/* Wallet Card */}
      <motion.div 
        className="flex-1 bg-[var(--surface)] rounded-[24px] p-5 relative overflow-hidden border border-black/5 shadow-md cursor-pointer"
        whileTap={{ scale: 0.98 }}
        onClick={() => nav('/wallet')}
      >
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center border border-[var(--border)]">
            <Wallet size={20} className="text-[var(--violet)]" />
          </div>
          <span className="text-sm font-black text-hi tracking-tight">₹0</span>
        </div>
        <h3 className="text-lg font-black text-hi mb-1">Zappy Wallet</h3>
        <p className="text-xs text-mid font-medium">Add money for instant checkout</p>
      </motion.div>
    </div>
  );
}
