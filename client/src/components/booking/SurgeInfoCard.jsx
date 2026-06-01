import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const SURGE_COLOR = {
  low:    { bg: 'bg-green-50',  ring: 'ring-green-100',  text: 'text-green-700',  bar: 'bg-green-500'  },
  medium: { bg: 'bg-amber-50',  ring: 'ring-amber-100',  text: 'text-amber-700',  bar: 'bg-amber-400'  },
  high:   { bg: 'bg-orange-50', ring: 'ring-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  very_high: { bg: 'bg-red-50', ring: 'ring-red-100',    text: 'text-red-700',    bar: 'bg-red-500'    },
};

function surgeLevel(surge) {
  if (surge <= 1.0) return 'low';
  if (surge <= 1.3) return 'medium';
  if (surge <= 1.7) return 'high';
  return 'very_high';
}

export default function SurgeInfoCard({ surgeData, basePrice }) {
  const [expanded, setExpanded] = useState(false);
  if (!surgeData) return null;

  const { surge, demand, supply, reason, etaToClearMin, history = [], isNormalPricing } = surgeData;
  const level  = surgeLevel(surge);
  const colors = SURGE_COLOR[level];

  if (isNormalPricing) {
    return (
      <div className="card bg-green-50 ring-1 ring-green-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <TrendingUp size={15} strokeWidth={2} className="text-green-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-green-800">Normal pricing</p>
          <p className="text-xs text-green-600">Good availability in your area — no surge</p>
        </div>
      </div>
    );
  }

  const maxHistSurge = Math.max(...history.map(h => h.surge), surge, 1);
  const demandPct    = Math.min(100, demand > 0 ? Math.round((demand / (demand + supply)) * 100) : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card ring-1 ${colors.bg} ${colors.ring} overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
          <Zap size={16} strokeWidth={2} className={colors.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-extrabold ${colors.text}`}>
              {surge.toFixed(1)}× surge pricing
            </p>
            <button
              onClick={() => setExpanded(e => !e)}
              className={`text-xs font-semibold flex items-center gap-1 ${colors.text} opacity-70`}
            >
              Why? {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 leading-snug">{reason}</p>
        </div>
      </div>

      {/* Demand/supply bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Demand</span>
            <span className="text-[10px] font-bold text-slate-700">{demand}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Workers</span>
            <span className="text-[10px] font-bold text-slate-700">{supply}</span>
          </div>
        </div>
        <div className="h-2 bg-white/70 rounded-full overflow-hidden ring-1 ring-black/5">
          <div
            className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: `${demandPct}%` }}
          />
        </div>
      </div>

      {/* ETA to clear */}
      {etaToClearMin && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Clock size={11} className="text-slate-400" />
          <span className="text-[11px] text-slate-500 font-medium">
            Surge may clear in ~{etaToClearMin} min as more workers come online
          </span>
        </div>
      )}

      {/* Expanded: sparkline history */}
      <AnimatePresence>
        {expanded && history.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-black/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                Last 3 hours
              </p>
              <div className="flex items-end gap-0.5 h-10">
                {[...history].reverse().map((h, i) => {
                  const pct = Math.round((h.surge / maxHistSurge) * 100);
                  const isNow = i === 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-sm transition-all ${isNow ? colors.bar : 'bg-slate-200'}`}
                        style={{ height: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-400">3h ago</span>
                <span className="text-[9px] text-slate-400">Now</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
