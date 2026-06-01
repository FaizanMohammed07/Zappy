/**
 * Worker Wellness Widget — no competitor has this.
 * Shows burnout risk score + actionable intervention.
 */
import { motion } from 'framer-motion';
import { Heart, Moon, TrendingDown, Coffee, Star, Loader2, Gift } from 'lucide-react';
import { useGetWellnessQuery, useClaimBreakBonusMutation } from '../../services/api';
import toast from 'react-hot-toast';

const SCORE_CONFIG = [
  { min: 8, label: 'Thriving',       color: 'text-green-600',  bg: 'bg-green-50',  ring: 'ring-green-100',  barColor: 'bg-green-500'  },
  { min: 6, label: 'Doing Well',     color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-100',   barColor: 'bg-blue-500'   },
  { min: 4, label: 'Watch Your Pace', color: 'text-amber-600', bg: 'bg-amber-50',  ring: 'ring-amber-100',  barColor: 'bg-amber-400'  },
  { min: 0, label: 'Rest Needed',    color: 'text-red-600',    bg: 'bg-red-50',    ring: 'ring-red-100',    barColor: 'bg-red-500'    },
];

function getScoreConfig(score) {
  return SCORE_CONFIG.find(c => score >= c.min) || SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

const SIGNAL_ICONS = {
  rejectRate7d:    { icon: TrendingDown, label: 'Rejection rate', unit: '%' },
  lateNightRate:   { icon: Moon,         label: 'Late-night work', unit: '%' },
  consecutiveDays: { icon: Coffee,       label: 'Days without break', unit: 'd' },
  avgDailyOrders:  { icon: Star,         label: 'Avg daily orders', unit: '' },
};

export default function WellnessWidget() {
  const { data, isLoading, refetch } = useGetWellnessQuery();
  const [claimBonus, { isLoading: claiming }] = useClaimBreakBonusMutation();

  if (isLoading) {
    return (
      <div className="card flex items-center gap-3">
        <Loader2 size={16} className="text-slate-300 animate-spin" />
        <p className="text-sm text-slate-400">Checking your wellness…</p>
      </div>
    );
  }
  if (!data) return null;

  const { score, badge, intervention, signals } = data;
  const cfg = getScoreConfig(score);
  const barPct = Math.round((score / 10) * 100);

  async function handleClaimBonus() {
    try {
      const result = await claimBonus().unwrap();
      toast.success(`₹${Math.round(result.bonusPaise / 100)} break bonus credited! Take a rest.`);
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Could not claim bonus');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card ring-1 ${cfg.bg} ${cfg.ring}`}
    >
      {/* Score bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/70`}>
          <Heart size={16} strokeWidth={2} className={cfg.color} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className={`text-sm font-extrabold ${cfg.color}`}>
              {badge?.emoji} {badge?.label || 'Wellness'}
            </p>
            <p className={`text-sm font-extrabold ${cfg.color}`}>{score}/10</p>
          </div>
          <div className="h-2 bg-white/70 rounded-full overflow-hidden ring-1 ring-black/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={`h-full rounded-full ${cfg.barColor}`}
            />
          </div>
        </div>
      </div>

      {/* Key signals */}
      {signals && (
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {Object.entries(SIGNAL_ICONS).map(([key, { icon: Icon, label, unit }]) => {
            const val = signals[key];
            if (val == null) return null;
            return (
              <div key={key} className="bg-white/60 rounded-xl px-3 py-2 flex items-center gap-2">
                <Icon size={12} strokeWidth={2} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{label}</p>
                  <p className="text-xs font-bold text-[#0F172A]">{val}{unit}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intervention card */}
      {intervention && (
        <div className="bg-white/70 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-bold text-[#0F172A]">{intervention.title || '💡 Tip'}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{intervention.message}</p>
          {intervention.bonusPaise > 0 && (
            <button
              onClick={handleClaimBonus}
              disabled={claiming}
              className="w-full py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-2 mt-1"
            >
              {claiming ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
              {claiming ? 'Crediting…' : `Claim ₹${Math.round(intervention.bonusPaise / 100)} break bonus`}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
