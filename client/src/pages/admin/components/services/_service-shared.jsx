import {
  Battery, Bolt, Droplets, Wind, Hammer, Users, Sparkles, Paintbrush2,
  Smartphone, Home, Car, Wrench,
} from 'lucide-react';

export const TABS = [
  { key: 'home',         label: 'Home Services',  Icon: Home,       color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200', accent: '#7c3aed', gradFrom: 'from-violet-500', gradTo: 'to-purple-600' },
  { key: 'mobile',       label: 'Mobile Phone',   Icon: Smartphone, color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200', accent: '#4f46e5', gradFrom: 'from-indigo-500', gradTo: 'to-blue-600'   },
  { key: 'construction', label: 'Construction',   Icon: Wrench,     color: 'text-stone-600',   bg: 'bg-stone-50',   border: 'border-stone-200',  accent: '#78716c', gradFrom: 'from-stone-500',  gradTo: 'to-slate-600'  },
  { key: 'vehicle',      label: 'Car & Bike',     Icon: Car,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',   accent: '#2563eb', gradFrom: 'from-blue-500',   gradTo: 'to-cyan-600'   },
];

export const CAT_MAP = {
  home: ['home', 'helper', 'beauty', 'other'],
  mobile: ['mobile'],
  construction: ['construction'],
  vehicle: ['vehicle'],
};

export const rupees = (p) => p != null ? Math.round(p / 100) : 0;
export const paise  = (r) => Math.round(Number(r) * 100);

export const SVC_ICONS = {
  electrical: Bolt, plumbing: Droplets, ac_repair: Wind,
  carpenter: Hammer, helper: Users, cleaning: Sparkles,
  painting: Paintbrush2, screen_replacement: Smartphone,
  battery_replacement: Battery, charging_issue: Bolt,
  speaker_mic_issue: Wrench, software_issue: Wrench,
  water_damage_check: Droplets, mason: Home, puncture: Car,
  battery_jump_start: Bolt, fuel_delivery: Car, bike_wash: Car,
  car_wash: Car, minor_roadside_repair: Car,
};

export function SvcIcon({ code, className = '' }) {
  const Icon = SVC_ICONS[code] || Wrench;
  return <Icon size={14} strokeWidth={2} className={className} />;
}

export function NumInput({ value, onChange, step = '1', min = '0', max, prefix, className = '' }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">{prefix}</span>
      )}
      <input
        type="number" value={value} onChange={onChange}
        step={step} min={min} max={max}
        className={`w-full border border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none ${prefix ? 'pl-7 pr-3 py-2' : 'px-3 py-2'} ${className}`}
      />
    </div>
  );
}

export function FieldRow({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
      {hint && <p className="text-[9px] text-slate-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

export function InfoBox({ children, variant = 'blue' }) {
  const s = {
    blue:   'bg-blue-50 text-blue-700 ring-blue-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    stone:  'bg-stone-50 text-stone-700 ring-stone-100',
    amber:  'bg-amber-50 text-amber-700 ring-amber-100',
  };
  return <div className={`rounded-xl p-3 text-xs ring-1 space-y-1 ${s[variant]}`}>{children}</div>;
}
