import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, Clock, Shield, TrendingUp, Lock, Users, Timer, Sparkles } from 'lucide-react';

function workerCountFromEta(etaMinutes) {
  if (!etaMinutes) return null;
  if (etaMinutes <= 4) return { count: '4–6', label: 'workers nearby', closest: etaMinutes };
  if (etaMinutes <= 8) return { count: '2–3', label: 'workers available', closest: etaMinutes };
  return { count: '1–2', label: 'workers available', closest: etaMinutes };
}

function surgeLevel(multiplier) {
  if (multiplier >= 2)   return { label: 'Very high demand', bg: 'from-red-500 to-rose-600',     text: 'text-red-700',   badge: 'bg-red-50 text-red-700 ring-red-200'     };
  if (multiplier >= 1.5) return { label: 'High demand',      bg: 'from-amber-400 to-orange-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return                        { label: 'Moderate demand',  bg: 'from-orange-400 to-amber-500', text: 'text-orange-700',badge: 'bg-orange-50 text-orange-700 ring-orange-200' };
}

export default function SmartPricingPanel({ quote, mode, onModeChange, onRefetch, accentGradient }) {
  const [expanded,  setExpanded]  = useState(false);
  const [countdown, setCountdown] = useState(null);

  const hasSurge   = quote?.surgeMultiplier > 1;
  const savedPaise = hasSurge ? Math.round(quote.total - quote.total / quote.surgeMultiplier) : 0;
  const waitPrice  = hasSurge ? Math.round(quote.total / quote.surgeMultiplier) : quote?.total;
  const sl         = hasSurge ? surgeLevel(quote.surgeMultiplier) : null;
  const workers    = workerCountFromEta(quote?.etaMinutes);

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
    <div
      className="rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
    >
      {/* Surge banner */}
      {hasSurge && (
        <div className={`bg-gradient-to-r ${sl.bg} px-4 py-3 flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <TrendingUp size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">{sl.label} in your area</p>
            <p className="text-[11px] text-white/70 mt-0.5">Prices are temporarily elevated</p>
          </div>
          <span className="text-xs font-black text-white bg-white/20 px-2.5 py-1 rounded-full">
            {quote.surgeMultiplier}× surge
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Book Now / Wait & Save toggle */}
        {hasSurge && mode !== 'locked' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <motion.button
              onClick={() => onModeChange?.('now')}
              className={`relative p-3.5 rounded-xl text-left transition-all duration-200 overflow-hidden ${
                mode === 'now' ? 'text-white' : 'bg-slate-50 hover:bg-slate-100'
              }`}
              style={mode === 'now' ? { background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' } : {}}
              whileTap={{ scale: 0.97 }}
            >
              {mode === 'now' && (
                <div className="absolute top-2 right-2">
                  <Sparkles size={12} className="text-amber-300" />
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={13} className={mode === 'now' ? 'text-amber-400' : 'text-slate-500'} />
                <span className={`text-[11px] font-bold ${mode === 'now' ? 'text-white/70' : 'text-slate-500'}`}>Book Now</span>
              </div>
              <p className={`text-2xl font-black leading-none ${mode === 'now' ? 'text-white' : 'text-[#0F172A]'}`}>
                ₹{quote.total}
              </p>
              <p className={`text-[10px] mt-1 ${mode === 'now' ? 'text-white/50' : 'text-slate-400'}`}>
                Instant booking
              </p>
            </motion.button>

            <motion.button
              onClick={() => onModeChange?.('wait')}
              className={`relative p-3.5 rounded-xl text-left transition-all duration-200 overflow-hidden ${
                mode === 'wait' ? 'text-white' : 'bg-slate-50 hover:bg-slate-100'
              }`}
              style={mode === 'wait' ? { background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)' } : {}}
              whileTap={{ scale: 0.97 }}
            >
              {mode === 'wait' && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={13} className={mode === 'wait' ? 'text-green-300' : 'text-slate-500'} />
                <span className={`text-[11px] font-bold ${mode === 'wait' ? 'text-white/70' : 'text-slate-500'}`}>Wait &amp; Save</span>
              </div>
              <p className={`text-2xl font-black leading-none ${mode === 'wait' ? 'text-white' : 'text-[#0F172A]'}`}>
                ~₹{waitPrice}
              </p>
              <p className={`text-[10px] mt-1 font-bold ${mode === 'wait' ? 'text-green-300' : 'text-green-600'}`}>
                Save ~₹{savedPaise}
              </p>
            </motion.button>
          </div>
        )}

        {/* Wait countdown */}
        <AnimatePresence>
          {mode === 'wait' && countdown !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl ring-1 ring-blue-100">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Timer size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-800">Waiting for demand to ease…</p>
                  <p className="text-[11px] text-blue-500 mt-0.5">Price check in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
                </div>
                <span className="text-2xl font-black text-blue-700 tabular-nums">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Price display (no surge / locked) */}
        {(!hasSurge || mode === 'locked') && (
          <div className="flex items-center gap-3 mb-1">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#0F172A]">₹{displayTotal}</span>
                {mode === 'locked' && (
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-100">
                    <Lock size={9} className="text-green-600" />
                    <span className="text-[10px] font-bold text-green-700">Locked</span>
                  </div>
                )}
              </div>
              {quote.distanceKm && (
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {quote.distanceKm} km · ~{quote.etaMinutes} min arrival
                </p>
              )}
            </div>
          </div>
        )}

        {/* Nearby workers */}
        {workers && (
          <div className="flex items-center gap-2 mb-3.5 mt-1">
            <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full ring-1 ring-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <Users size={11} className="text-green-600" />
              <span className="text-[11px] font-bold text-green-700">
                {workers.count} {workers.label}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              · Closest ~{workers.closest} min away
            </span>
          </div>
        )}

        {/* Breakdown toggle */}
        <motion.button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-blue-600 transition mb-2"
          whileTap={{ scale: 0.97 }}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span className="font-semibold">{expanded ? 'Hide breakdown' : 'View price breakdown'}</span>
        </motion.button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 rounded-xl p-3.5 mb-3 space-y-2.5 ring-1 ring-slate-100">
                <BRow label="Base fee" value={`₹${quote.baseFee}`} />
                <BRow label={`Distance · ${quote.distanceKm} km`} value={`₹${quote.distanceFee}`} />
                <BRow label={`Time · ~${quote.etaMinutes} min`} value={`₹${quote.timeFee}`} />
                <BRow label="Platform fee" value={`₹${quote.platformFee}`} />
                {hasSurge && (
                  <BRow
                    label={`Demand surge · ${quote.surgeMultiplier}×`}
                    value={`+₹${savedPaise}`}
                    cls="text-amber-600 font-bold"
                  />
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-[#0F172A]">Total</span>
                  <span className="text-sm font-black text-[#0F172A]">₹{displayTotal}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield size={11} />
              <span className="text-[10px] font-medium">No hidden charges</span>
            </div>
          </div>
          <span className="text-xl font-black text-[#0F172A]">₹{displayTotal}</span>
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
