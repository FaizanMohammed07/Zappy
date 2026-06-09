import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, Zap, CheckCircle, Loader2, ChevronRight, Wind, Droplets, Bolt, Hammer, Sparkles, Paintbrush2, PlugZap, Scissors, Lock, ShieldCheck, Truck, Shirt, Leaf, Shield, Wifi, Smartphone, Battery, Plug, Mic, Code, Droplet, Layers, Wrench, Car, Bike, Fuel, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerProfileQuery, useUpdateWorkerSkillsMutation } from '../services/api';
import { useGetPlansQuery } from '../services/api';

const ALL_SKILLS = [
  // Vehicle
  { id: 'puncture',              label: 'Puncture Repair',        Icon: Bike,       color: 'text-red-500',    bg: 'bg-red-50',    unlockAt: null },
  { id: 'bike_wash',             label: 'Bike Wash',              Icon: Bike,       color: 'text-cyan-500',   bg: 'bg-cyan-50',   unlockAt: null },
  { id: 'car_wash',              label: 'Car Wash',               Icon: Car,        color: 'text-blue-500',   bg: 'bg-blue-50',   unlockAt: null },
  { id: 'battery_jump_start',    label: 'Battery Jump Start',     Icon: Zap,        color: 'text-yellow-500', bg: 'bg-yellow-50', unlockAt: null },
  { id: 'fuel_delivery',         label: 'Fuel Delivery',          Icon: Fuel,       color: 'text-orange-500', bg: 'bg-orange-50', unlockAt: null },
  { id: 'minor_roadside_repair', label: 'Minor Roadside Repair',  Icon: Wrench,     color: 'text-stone-500',  bg: 'bg-stone-50',  unlockAt: null },
  // Home services
  { id: 'electrical',            label: 'Electrical Work',        Icon: Bolt,       color: 'text-amber-500',  bg: 'bg-amber-50',  unlockAt: null },
  { id: 'plumbing',              label: 'Plumbing',               Icon: Droplets,   color: 'text-blue-500',   bg: 'bg-blue-50',   unlockAt: null },
  { id: 'ac_repair',             label: 'AC Repair & Service',    Icon: Wind,       color: 'text-cyan-500',   bg: 'bg-cyan-50',   unlockAt: null },
  { id: 'carpenter',             label: 'Carpentry & Furniture',  Icon: Hammer,     color: 'text-orange-500', bg: 'bg-orange-50', unlockAt: null },
  { id: 'cleaning',              label: 'Deep Cleaning',          Icon: Sparkles,   color: 'text-purple-500', bg: 'bg-purple-50', unlockAt: null },
  { id: 'painting',              label: 'Painting',               Icon: Paintbrush2,color: 'text-pink-500',   bg: 'bg-pink-50',   unlockAt: null },
  { id: 'helper',                label: 'Helper / Labour',        Icon: Layers,     color: 'text-slate-500',  bg: 'bg-slate-50',  unlockAt: null },
  { id: 'delivery',              label: 'Delivery',               Icon: Truck,      color: 'text-indigo-500', bg: 'bg-indigo-50', unlockAt: null },
  { id: 'laundry',               label: 'Laundry',                Icon: Shirt,      color: 'text-teal-500',   bg: 'bg-teal-50',   unlockAt: null },
  { id: 'beauty',                label: 'Beauty & Grooming',      Icon: Scissors,   color: 'text-rose-500',   bg: 'bg-rose-50',   unlockAt: null },
  { id: 'gardening',             label: 'Gardening',              Icon: Leaf,       color: 'text-green-500',  bg: 'bg-green-50',  unlockAt: null },
  { id: 'security',              label: 'Security',               Icon: Shield,     color: 'text-slate-600',  bg: 'bg-slate-100', unlockAt: null },
  { id: 'appliance',             label: 'Appliance Repair',       Icon: PlugZap,    color: 'text-violet-500', bg: 'bg-violet-50', unlockAt: null },
  { id: 'internet',              label: 'Internet / Networking',  Icon: Wifi,       color: 'text-sky-500',    bg: 'bg-sky-50',    unlockAt: null },
  // Mobile repair
  { id: 'screen_replacement',    label: 'Phone Screen Repair',    Icon: Smartphone, color: 'text-pink-500',   bg: 'bg-pink-50',   unlockAt: null },
  { id: 'battery_replacement',   label: 'Phone Battery',          Icon: Battery,    color: 'text-orange-400', bg: 'bg-orange-50', unlockAt: null },
  { id: 'charging_issue',        label: 'Charging Issue',         Icon: Plug,       color: 'text-yellow-500', bg: 'bg-yellow-50', unlockAt: null },
  { id: 'speaker_mic_issue',     label: 'Speaker / Mic Repair',   Icon: Mic,        color: 'text-lime-500',   bg: 'bg-lime-50',   unlockAt: null },
  { id: 'software_issue',        label: 'Software Issue',         Icon: Code,       color: 'text-emerald-500',bg: 'bg-emerald-50',unlockAt: null },
  { id: 'water_damage_check',    label: 'Water Damage Check',     Icon: Droplet,    color: 'text-blue-400',   bg: 'bg-blue-50',   unlockAt: null },
  // Construction
  { id: 'mason',                 label: 'Masonry / Construction', Icon: Layers,     color: 'text-yellow-700', bg: 'bg-yellow-50', unlockAt: null },
];

export default function WorkerSkillsPage() {
  const nav = useNavigate();
  const { data: profile, isLoading } = useGetWorkerProfileQuery();
  const [updateSkills, { isLoading: saving }] = useUpdateWorkerSkillsMutation();
  const { data: plansData } = useGetPlansQuery();

  const currentSkills = profile?.skills ?? [];
  const primarySkill = profile?.skillPrimary ?? null;
  const certifications = profile?.certifications ?? [];
  const certifiedModuleIds = certifications.map(c => c.moduleId);

  const [selected, setSelected] = useState(() => new Set(currentSkills));
  const [primary, setPrimary] = useState(primarySkill);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (primary === id) setPrimary(null); }
      else next.add(id);
      return next;
    });
  }

  async function save() {
    try {
      await updateSkills({ skills: [...selected], skillPrimary: primary }).unwrap();
      toast.success('Skills saved successfully!');
    } catch (err) { toast.error(err?.data?.error || 'Failed to save skills'); }
  }

  const currentPlan = plansData?.current?.name ?? 'basic';
  const isPro = ['pro', 'premium'].includes(currentPlan?.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-50 md:flex md:justify-center">
      <div className="w-full max-w-lg bg-slate-50 min-h-screen relative shadow-[0_0_40px_rgba(0,0,0,0.05)] md:border-x border-slate-200/60 pb-8 overflow-hidden">
        
        {/* Cinematic Header */}
        <header className="relative pt-6 pb-28 overflow-hidden rounded-b-[2.5rem] shadow-sm z-10" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a5f 100%)' }}>
          <motion.div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 5, repeat: Infinity }} />
          <motion.div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 6, repeat: Infinity, delay: 1 }} />
          
          <div className="relative z-10 px-5">
            <div className="flex items-center justify-between mb-8">
              <motion.button onClick={() => nav(-1)} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-sm">
                <ArrowLeft size={20} strokeWidth={2.5} />
              </motion.button>
              <h1 className="text-white font-black tracking-wide text-lg">Specialisation</h1>
              <motion.button onClick={save} disabled={saving} whileTap={!saving ? { scale: 0.9 } : {}} className="h-10 px-4 rounded-full bg-white text-indigo-600 font-bold text-sm flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-all">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} strokeWidth={2.5} />}
                Save
              </motion.button>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
                <Star size={32} className="text-amber-400 fill-amber-400/30" strokeWidth={1.5} />
              </div>
              <p className="text-white font-bold text-lg tracking-tight">Your Skills</p>
              <p className="text-white/60 text-xs font-medium mt-1 px-4">Select your expertise to get matched with relevant high-paying jobs.</p>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 relative z-20">
            <Loader2 size={28} className="animate-spin text-indigo-400 mb-3" />
            <p className="text-sm font-semibold text-slate-400">Loading skills...</p>
          </div>
        ) : (
          <div className="relative z-20 px-4 -mt-16 space-y-4">
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-xl border border-indigo-100 rounded-[1.25rem] p-4 flex gap-3 text-indigo-700 text-[13px] font-medium shadow-sm">
              <Star size={18} className="shrink-0 mt-0.5 text-indigo-500 fill-indigo-500/20" />
              <p>Set a <span className="font-bold text-indigo-800">Primary Skill</span> to boost your visibility and earn up to 20% more in that category.</p>
            </motion.div>

            {/* Plan upgrade prompt for locked skills */}
            <AnimatePresence>
              {!isPro && (
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={() => nav('/plans')} 
                  className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-[1.25rem] p-4 flex items-center gap-3 text-amber-800 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Zap size={18} className="text-amber-600 fill-amber-600/30" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-bold leading-tight">Upgrade to Zappy Pro</p>
                    <p className="text-[11px] font-medium opacity-80 mt-0.5">Unlock premium skills & higher payouts</p>
                  </div>
                  <ChevronRight size={18} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Certifications summary */}
            <AnimatePresence>
              {certifications.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-emerald-50 border border-emerald-100/50 rounded-[1.25rem] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={14} /> Certifications</p>
                    <button onClick={() => nav('/worker/training')} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-100/50 px-2 py-1 rounded">View All</button>
                  </div>
                  <div className="space-y-2">
                    {certifications.map(c => (
                      <div key={c.moduleId} className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="text-[13px] font-bold text-emerald-800 flex-1">{c.moduleName}</span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{c.score}%</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Skills grid */}
            <div className="pt-2 space-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Available Categories</p>
              
              <div className="space-y-3 pb-8">
                {ALL_SKILLS.map((skill, i) => {
                  const isSelected = selected.has(skill.id);
                  const isPrimary = primary === skill.id;
                  const requiresCert = skill.unlockAt === 'certified';
                  const hasCert = certifiedModuleIds.includes(skill.id);
                  const locked = requiresCert && !hasCert;

                  return (
                    <motion.div key={skill.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (i * 0.05) }}
                      className={`relative bg-white rounded-[1.25rem] p-4 transition-all duration-300 overflow-hidden ${isSelected && !locked ? (isPrimary ? 'border-2 border-amber-400 ring-4 ring-amber-50 shadow-md' : 'border-2 border-indigo-500 ring-4 ring-indigo-50 shadow-sm') : 'border border-slate-200 hover:border-indigo-200'} ${locked ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                      
                      {isPrimary && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 to-orange-400" />}

                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${locked ? 'bg-slate-100 text-slate-400' : `${skill.bg} ${skill.color}`}`}>
                          <skill.Icon size={24} strokeWidth={1.5} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-[15px] font-black leading-tight truncate ${locked ? 'text-slate-500' : 'text-slate-800'}`}>{skill.label}</p>
                          
                          {locked ? (
                            <button onClick={() => nav('/worker/training')} className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded w-max border border-amber-100">
                              <Lock size={10} /> Needs Certification
                            </button>
                          ) : isSelected ? (
                            <button onClick={(e) => { e.stopPropagation(); setPrimary(isPrimary ? null : skill.id); }}
                              className={`mt-1.5 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider transition-all duration-200 shadow-sm border ${isPrimary ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'}`}>
                              {isPrimary ? '★ Primary Skill' : 'Set as Primary'}
                            </button>
                          ) : (
                            <p className="text-[11px] font-medium text-slate-400 mt-1">Tap to select</p>
                          )}
                        </div>
                        
                        <button
                          disabled={locked}
                          onClick={() => !locked && toggle(skill.id)}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected && !locked ? (isPrimary ? 'border-amber-500 bg-amber-500 text-white' : 'border-indigo-600 bg-indigo-600 text-white') : 'border-slate-300 bg-slate-50 hover:border-indigo-400'}`}>
                          {isSelected && !locked && <CheckCircle size={16} strokeWidth={3} />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
