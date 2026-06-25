import { Users, Star, UserCheck, Zap } from 'lucide-react';

const STATS = [
  { icon: Users, value: '50K+', label: 'Bookings' },
  { icon: Star, value: '4.8★', label: 'Average' },
  { icon: UserCheck, value: '500+', label: 'Verified Pros' },
  { icon: Zap, value: '<1m', label: 'Booking Time' },
];

export default function StatsBand() {
  return (
    <div className="w-full px-4 mb-10">
      <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] py-4 px-2 shadow-md">
        <div className="flex justify-between divide-x divide-[var(--border)]">
          {STATS.map((stat, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-center px-2">
              <stat.icon size={16} className="text-[var(--accent)] mb-1" />
              <span className="text-sm font-black text-hi leading-tight">{stat.value}</span>
              <span className="text-[10px] font-medium text-mid text-center leading-tight mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
