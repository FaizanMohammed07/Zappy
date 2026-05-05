import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, Clock, Shield, TrendingUp, Lock, Users, Timer } from 'lucide-react';

/* ─── helpers ─── */
function workerCountFromEta(etaMinutes) {
  if (!etaMinutes) return null;
  if (etaMinutes <= 4) return { count: '4–6', label: 'workers nearby', closest: etaMinutes };
  if (etaMinutes <= 8) return { count: '2–3', label: 'workers available', closest: etaMinutes };
  return { count: '1–2', label: 'workers available', closest: etaMinutes };
}

function surgeLevel(multiplier) {
  if (multiplier >= 2)   return { label: 'Very high demand', bg: 'bg-red-50',   border: 'border-red-100',   text: 'text-red-700',   badge: 'bg-red-50 text-red-700 ring-red-200'   };
  if (multiplier >= 1.5) return { label: 'High demand',      bg: 'bg-amber-50',  border: 'border-amber-100', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return                        { label: 'Moderate demand',  bg: 'bg-orange-50', border: 'border-orange-100',text: 'text-orange-700',badge: 'bg-orange-50 text-orange-700 ring-orange-200' };
}

export default function SmartPricingPanel({ quote, mode, onModeChange, onRefetch }) {
  const [expanded,      setExpanded]      = useState(false);
  const [countdown,     setCountdown]     = useState(null);

  const hasSurge   = quote?.surgeMultiplier > 1;
  const savedPaise = hasSurge
    ? Math.round(quote.total - quote.total / quote.surgeMultiplier)
    : 0;
  const waitPrice  = hasSurge ? Math.round(quote.total / quote.surgeMultiplier) : quote?.total;
  const sl         = hasSurge ? surgeLevel(quote.surgeMultiplier) : null;
  const workers    = workerCountFromEta(quote?.etaMinutes);

  /* countdown for Wait & Save */
  useEffect(() => {
    if (mode !== 'wait') { setCountdown(null); return; }
    let t = 180;
    setCountdown(t);
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(id);
        onRefetch?.();
        onModeChange?.('now');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quote) return null;

  const displayTotal = mode === 'wait' ? waitPrice : quote.total;

  return (
    <div className="card overflow-hidden">

      {/* ── Surge context banner ── */}
      {hasSurge && (
        <div className={`-mx-4 -mt-4 mb-4 px-4 py-3 ${sl.bg} border-b ${sl.border} flex items-center gap-2.5`}>
          <TrendingUp size={14} className={sl.text} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${sl.text}`}>{sl.label} in your area</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Prices are temporarily elevated</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${sl.badge}`}>
            {quote.surgeMultiplier}× surge
          </span>
        </div>
      )}

      {/* ── Book Now / Wait & Save toggle ── */}
      {hasSurge && mode !== 'locked' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => onModeChange?.('now')}
            className={`relative p-3.5 rounded-xl text-left transition-all duration-200 ${
              mode === 'now'
                ? 'bg-[#0F172A] shadow-soft'
                : 'bg-slate-100 hover:bg-slate-150'
            }`}
          >
            {mode === 'now' && (
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} className={mode === 'now' ? 'text-amber-400' : 'text-slate-500'} />
              <span className={`text-[11px] font-bold ${mode === 'now' ? 'text-white/70' : 'text-slate-500'}`}>
                Book Now
              </span>
            </div>
            <p className={`text-xl font-extrabold leading-none ${mode === 'now' ? 'text-white' : 'text-[#0F172A]'}`}>
              ₹{quote.total}
            </p>
            <p className={`text-[10px] mt-1 ${mode === 'now' ? 'text-white/50' : 'text-slate-400'}`}>
              Instant booking
            </p>
          </button>

          <button
            onClick={() => onModeChange?.('wait')}
            className={`relative p-3.5 rounded-xl text-left transition-all duration-200 ${
              mode === 'wait'
                ? 'bg-[#0F172A] shadow-soft'
                : 'bg-slate-100 hover:bg-slate-150'
            }`}
          >
            {mode === 'wait' && (
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-400" />
            )}
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className={mode === 'wait' ? 'text-green-400' : 'text-slate-500'} />
              <span className={`text-[11px] font-bold ${mode === 'wait' ? 'text-white/70' : 'text-slate-500'}`}>
                Wait &amp; Save
              </span>
            </div>
            <p className={`text-xl font-extrabold leading-none ${mode === 'wait' ? 'text-white' : 'text-[#0F172A]'}`}>
              ~₹{waitPrice}
            </p>
            <p className={`text-[10px] mt-1 font-semibold ${mode === 'wait' ? 'text-green-300' : 'text-green-600'}`}>
              Save ~₹{savedPaise}
            </p>
          </button>
        </div>
      )}

      {/* ── Wait countdown ── */}
      <AnimatePresence>
        {mode === 'wait' && countdown !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <Timer size={16} className="text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-800">Waiting for demand to ease…</p>
                <p className="text-[11px] text-blue-500 mt-0.5">Price check in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
              </div>
              <span className="text-lg font-extrabold text-blue-700 tabular-nums">
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Price total (no surge or locked) ── */}
      {(!hasSurge || mode === 'locked') && (
        <div className="flex items-baseline gap-2.5 mb-1">
          <span className="text-3xl font-extrabold text-[#0F172A]">₹{displayTotal}</span>
          {quote.distanceKm && (
            <span className="text-xs text-slate-400 font-medium">
              {quote.distanceKm} km · ~{quote.etaMinutes} min arrival
            </span>
          )}
        </div>
      )}

      {/* ── Nearby workers ── */}
      {workers && (
        <div className="flex items-center gap-1.5 mb-3">
          <Users size={11} className="text-green-500" />
          <span className="text-[11px] font-semibold text-green-700">
            {workers.count} {workers.label}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-400">
            Closest ~{workers.closest} min away
          </span>
        </div>
      )}

      {/* ── Expandable breakdown ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition mb-2"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide breakdown' : 'View breakdown'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 pt-3 mb-3 space-y-2.5">
              <BRow label="Base fee" value={`₹${quote.baseFee}`} />
              <BRow label={`Distance · ${quote.distanceKm} km`} value={`₹${quote.distanceFee}`} />
              <BRow label={`Time · ~${quote.etaMinutes} min`} value={`₹${quote.timeFee}`} />
              <BRow label="Platform fee" value={`₹${quote.platformFee}`} />
              {hasSurge && (
                <BRow
                  label={`Demand surge · ${quote.surgeMultiplier}×`}
                  value={`+₹${savedPaise}`}
                  cls="text-amber-600"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer: total + transparency badge ── */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <Shield size={11} className="text-slate-400" />
          <span className="text-[10px] text-slate-400 font-medium">No hidden charges</span>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'locked' && (
            <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
              <Lock size={9} className="text-green-600" />
              <span className="text-[10px] font-bold text-green-700">Price locked</span>
            </div>
          )}
          <span className="text-xl font-extrabold text-[#0F172A]">₹{displayTotal}</span>
        </div>
      </div>
    </div>
  );
}

function BRow({ label, value, cls = 'text-[#0F172A]' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${cls}`}>{value}</span>
    </div>
  );
}
