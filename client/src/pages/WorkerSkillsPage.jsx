import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Zap, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerProfileQuery, useUpdateWorkerSkillsMutation } from '../services/api';
import { useGetPlansQuery } from '../services/api';

const ALL_SKILLS = [
  { id: 'ac_service', label: 'AC Repair & Service', icon: '❄️', unlockAt: null },
  { id: 'plumbing', label: 'Plumbing', icon: '🔧', unlockAt: null },
  { id: 'electrical', label: 'Electrical Work', icon: '⚡', unlockAt: null },
  { id: 'carpentry', label: 'Carpentry & Furniture', icon: '🪑', unlockAt: null },
  { id: 'cleaning', label: 'Deep Cleaning', icon: '🧹', unlockAt: null },
  { id: 'painting', label: 'Painting', icon: '🎨', unlockAt: null },
  { id: 'appliance_repair', label: 'Appliance Repair', icon: '🔌', unlockAt: null },
  { id: 'pest_control', label: 'Pest Control', icon: '🐛', unlockAt: 'certified' },
  { id: 'beauty', label: 'Beauty & Grooming', icon: '💇', unlockAt: null },
  { id: 'massage', label: 'Massage Therapy', icon: '💆', unlockAt: 'certified' },
  { id: 'tutoring', label: 'Home Tutoring', icon: '📚', unlockAt: null },
  { id: 'cooking', label: 'Personal Chef / Cooking', icon: '👨‍🍳', unlockAt: null },
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
      toast.success('Skills updated');
    } catch (err) { toast.error(err?.data?.error || 'Failed to save'); }
  }

  const currentPlan = plansData?.current?.name ?? 'basic';
  const isPro = ['pro', 'premium'].includes(currentPlan?.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Skills & Specialisation</h1>
        <button onClick={save} disabled={saving} className="ml-auto text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : null} Save
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2 text-xs text-indigo-700">
            <Star size={13} className="shrink-0 mt-0.5" />
            Select all your skills. Set one as primary to unlock higher-paying jobs in that category.
          </div>

          {/* Plan upgrade prompt for locked skills */}
          {!isPro && (
            <button onClick={() => nav('/plans')} className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-700">
              <Zap size={13} className="text-amber-500 shrink-0" />
              <span className="flex-1">Upgrade to Pro to access premium skills and higher-paying jobs</span>
              <ChevronRight size={13} />
            </button>
          )}

          {/* Skills grid */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Your Skills</p>
            {ALL_SKILLS.map(skill => {
              const isSelected = selected.has(skill.id);
              const isPrimary = primary === skill.id;
              const requiresCert = skill.unlockAt === 'certified';
              const hasCert = certifiedModuleIds.includes(skill.id);
              const locked = requiresCert && !hasCert;

              return (
                <div key={skill.id} className={`bg-white rounded-xl border p-3.5 ${isSelected && !locked ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200'} ${locked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{skill.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{skill.label}</p>
                      {locked && (
                        <button onClick={() => nav('/worker/training')} className="text-[10px] text-amber-600 hover:underline">
                          Complete certification to unlock
                        </button>
                      )}
                    </div>
                    {isSelected && !locked && (
                      <button onClick={() => setPrimary(isPrimary ? null : skill.id)}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition ${isPrimary ? 'bg-amber-400 text-white border-amber-400' : 'border-slate-200 text-slate-500 hover:border-amber-300'}`}>
                        {isPrimary ? '⭐ Primary' : 'Set Primary'}
                      </button>
                    )}
                    {isSelected && !locked && <CheckCircle size={16} className="text-indigo-600 shrink-0" />}
                    <button
                      disabled={locked}
                      onClick={() => !locked && toggle(skill.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${isSelected && !locked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isSelected && !locked && <svg width="10" height="8" fill="none" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Certifications summary */}
          {certifications.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-2">Your Certifications</p>
              {certifications.map(c => (
                <div key={c.moduleId} className="flex items-center gap-2 text-xs text-emerald-700 mb-1">
                  <CheckCircle size={11} /> {c.moduleName} — {c.score}% score
                </div>
              ))}
              <button onClick={() => nav('/worker/training')} className="text-xs text-emerald-600 hover:underline mt-1">Get more certifications →</button>
            </div>
          )}

          <div className="h-6" />
        </div>
      )}
    </div>
  );
}
