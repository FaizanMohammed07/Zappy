import { ShieldCheck, CheckCircle2, Lock, Star } from 'lucide-react';

export default function TrustBadges() {
  return (
    <div className="w-full px-4 mb-12 flex justify-center flex-wrap gap-4 md:gap-8">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[var(--violet)]" />
        <span className="text-[11px] font-bold text-mid uppercase tracking-widest">Insured</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-[var(--accent)]" />
        <span className="text-[11px] font-bold text-mid uppercase tracking-widest">Verified</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Lock size={14} className="text-[var(--star)]" />
        <span className="text-[11px] font-bold text-mid uppercase tracking-widest">Secure Pay</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Star size={14} className="text-[var(--star)]" />
        <span className="text-[11px] font-bold text-mid uppercase tracking-widest">4.8 Rated</span>
      </div>
    </div>
  );
}
