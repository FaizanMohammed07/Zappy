import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Zap, Clock, Shield, TrendingUp, Lock,
  Users, Timer, Sparkles, Star, Flame, CheckCircle,
} from 'lucide-react';

/* ─── Tier shape ─────────────────────────────────────────────────────────── */
function buildTiers(priorityMult, expressMult) {
  return [
    {
      key: 'standard', label: 'Standard', desc: 'Available worker · any rating',
      icon: '🔧', etaOffset: 0, multiplier: 1.0,
      badge: null, badgeCls: '', ring: 'ring-slate-200',
      activeBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', activeTxt: 'text-white',
    },
    {
      key: 'priority', label: 'Priority', desc: '4.5★+ rated workers only',
      icon: '⭐', etaOffset: -3, multiplier: priorityMult,
      badge: 'Top Rated', badgeCls: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200',
      activeBg: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)', activeTxt: 'text-white',
    },
    {
      key: 'express', label: 'Express', desc: 'Nearest worker, instant match',
      icon: '⚡', etaOffset: -6, multiplier: expressMult,
      badge: 'Quickest', badgeCls: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-200',
      activeBg: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)', activeTxt: 'text-white',
    },
  ];
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function workerCountFromEta(etaMinutes) {
  if (!etaMinutes) return null;
  if (etaMinutes <= 4) return { count: '4–6', label: 'workers nearby', closest: etaMinutes };
  if (etaMinutes <= 8) return { count: '2–3', label: 'workers available', closest: etaMinutes };
  return { count: '1–2', label: 'workers available', closest: etaMinutes };
}

function surgeLevel(multiplier) {
  if (multiplier >= 2)   return { label: 'Very high demand', bg: 'from-red-500 to-rose-600',     badge: 'bg-red-50 text-red-700 ring-red-200'     };
  if (multiplier >= 1.5) return { label: 'High demand',      bg: 'from-amber-400 to-orange-500', badge: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return                        { label: 'Moderate demand',  bg: 'from-orange-400 to-amber-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200' };
}

function BRow({ label, value, cls = 'text-[#0F172A]' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SmartPricingPanel
   Props:
     quote           — price quote from server
     mode            — 'now' | 'wait' | 'locked'
     onModeChange    — (mode) => void
     onRefetch       — () => void
     accentGradient  — tailwind gradient string for brand colour
     selectedTier    — 'standard' | 'priority' | 'express'
     onTierChange    — (tier) => void
     tipAmount       — number (₹ boost)
     onTipChange     — (amount) => void
     promoDiscount   — number (₹ discount applied)
════════════════════════════════════════════════════════════════════════ */
export default function SmartPricingPanel({
  quote,
  mode,
  onModeChange,
  onRefetch,
  accentGradient,
  selectedTier = 'standard',
  onTierChange,
  tipAmount = 0,
  onTipChange,
  promoDiscount = 0,
  pricingConfig = {},
}) {
  const [expanded,      setExpanded]      = useState(false);
  const [countdown,     setCountdown]     = useState(null);
  const [burstId,       setBurstId]       = useState(0);
  const [pendingBoost,  setPendingBoost]  = useState(null);
  const [boostConfirm,  setBoostConfirm]  = useState(false);
  const prevTipRef = useRef(tipAmount);

  // Derive tier multipliers from admin config (fall back to defaults)
  const TIERS = buildTiers(
    pricingConfig.tierMultiplierPriority ?? 1.2,
    pricingConfig.tierMultiplierExpress  ?? 1.4,
  );

  // Boost config from admin
  const boostEnabled = pricingConfig.boostEnabled ?? true;
  const BOOST_AMOUNTS = (pricingConfig.boostOptions ?? [10, 20, 30, 50, 100])
    .filter(n => typeof n === 'number' && n > 0)
    .slice(0, 5); // max 5 buttons fit the grid

  const hasSurge  = quote?.surgeMultiplier > 1;
  const sl        = hasSurge ? surgeLevel(quote.surgeMultiplier) : null;
  const workers   = workerCountFromEta(quote?.etaMinutes);

  const tier = TIERS.find(t => t.key === selectedTier) || TIERS[0];

  // Apply tier multiplier to get tier price
  const baseTotal   = mode === 'wait'
    ? Math.round(quote?.total / (quote?.surgeMultiplier || 1))
    : (quote?.total || 0);
  const tierPrice   = Math.round(baseTotal * tier.multiplier);
  const finalTotal  = tierPrice + tipAmount - promoDiscount;
  const displayTotal = Math.max(0, finalTotal);

  // ETA with tier offset
  const baseEta  = quote?.etaMinutes || 0;
  const tierEta  = Math.max(1, baseEta + tier.etaOffset);

  useEffect(() => {
    if (tipAmount !== prevTipRef.current) {
      setBurstId(id => id + 1);
      prevTipRef.current = tipAmount;
    }
  }, [tipAmount]);

  useEffect(() => {
    if (mode !== 'wait') { setCountdown(null); return; }
    let t = 180;
    setCountdown(t);
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) { clearInterval(id); onRefetch?.(); onModeChange?.('now'); }
    }, 1000);
    return () => clearInterval(id);
  }, [mode]); // eslint-disable-line

  if (!quote) return null;

  return (
    <>
    <div className="rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

      {/* ── Surge banner ─────────────────────────────────────────────── */}
      {hasSurge && (
        <div className={`bg-gradient-to-r ${sl.bg} px-4 py-2.5 flex items-center gap-3`}>
          <TrendingUp size={14} className="text-white shrink-0" />
          <p className="text-xs font-bold text-white flex-1">{sl.label} — prices temporarily elevated</p>
          <span className="text-xs font-black text-white bg-white/20 px-2 py-0.5 rounded-full">{quote.surgeMultiplier}×</span>
        </div>
      )}

      {/* ── Promo saving banner ───────────────────────────────────────── */}
      <AnimatePresence>
        {promoDiscount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <CheckCircle size={13} className="text-green-600 shrink-0" />
              <p className="text-xs font-bold text-green-700">Saving ₹{promoDiscount} with promo code applied</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-4">

        {/* ── Rapido-style tier cards ──────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Choose service tier</p>
          <div className="space-y-2">
            {TIERS.map((t) => {
              const tPrice   = Math.round(baseTotal * t.multiplier);
              const tEta     = Math.max(1, baseEta + t.etaOffset);
              const isActive = selectedTier === t.key;

              return (
                <motion.button
                  key={t.key}
                  onClick={() => onTierChange?.(t.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all border-2 ${
                    isActive ? 'border-transparent' : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                  }`}
                  style={isActive ? { background: t.activeBg, borderColor: 'transparent' } : {}}
                  whileHover={!isActive ? { scale: 1.01 } : {}}
                  whileTap={{ scale: 0.98 }}
                  layout
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${isActive ? 'bg-white/15' : 'bg-white ring-1 ring-slate-200'}`}>
                    {t.icon}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-black ${isActive ? 'text-white' : 'text-slate-800'}`}>{t.label}</p>
                      {t.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : t.badgeCls}`}>
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                      {t.desc}
                    </p>
                    <p className={`text-[11px] font-bold mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                      ~{tEta} min away
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      ₹{tPrice}
                    </p>
                    {t.multiplier > 1 && (
                      <p className={`text-[10px] line-through ${isActive ? 'text-white/40' : 'text-slate-300'}`}>
                        ₹{baseTotal}
                      </p>
                    )}
                  </div>

                  {/* Active check */}
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0"
                    >
                      <CheckCircle size={12} className="text-white" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Wait & Save (surge only) ─────────────────────────────────── */}
        {hasSurge && mode !== 'locked' && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'now',  label: 'Book Now',    icon: Zap,   price: `₹${tierPrice}`,                sub: 'Instant booking',         activeBg: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' },
              { key: 'wait', label: 'Wait & Save', icon: Clock, price: `~₹${Math.round(baseTotal / quote.surgeMultiplier * tier.multiplier)}`, sub: `Save ~₹${Math.round(tierPrice - tierPrice / quote.surgeMultiplier)}`, activeBg: 'linear-gradient(135deg, #15803d 0%, #166534 100%)' },
            ].map(({ key, label, icon: Icon, price, sub, activeBg }) => {
              const isActive = mode === key;
              return (
                <motion.button
                  key={key}
                  onClick={() => onModeChange?.(key)}
                  className={`p-3 rounded-xl text-left border-2 ${isActive ? 'border-transparent' : 'bg-slate-50 border-slate-100'}`}
                  style={isActive ? { background: activeBg } : {}}
                  whileTap={{ scale: 0.97 }}
                >
                  <Icon size={13} className={isActive ? 'text-white/70 mb-1' : 'text-slate-400 mb-1'} />
                  <p className={`text-[10px] font-bold ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
                  <p className={`text-lg font-black leading-none mt-0.5 ${isActive ? 'text-white' : 'text-slate-900'}`}>{price}</p>
                  <p className={`text-[10px] mt-0.5 font-bold ${isActive ? 'text-white/60' : key === 'wait' ? 'text-green-600' : 'text-slate-400'}`}>{sub}</p>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* ── Wait countdown ────────────────────────────────────────────── */}
        <AnimatePresence>
          {mode === 'wait' && countdown !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl ring-1 ring-blue-100">
                <Timer size={15} className="text-blue-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-800">Waiting for demand to ease…</p>
                  <p className="text-[10px] text-blue-500">Recheck in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
                </div>
                <span className="text-xl font-black text-blue-700 tabular-nums">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nearby workers ────────────────────────────────────────────── */}
        {workers && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full ring-1 ring-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <Users size={10} className="text-green-600" />
              <span className="text-[11px] font-bold text-green-700">{workers.count} {workers.label}</span>
            </div>
            <span className="text-[11px] text-slate-400">· Closest ~{tierEta} min</span>
          </div>
        )}

        {/* ── Worker Boost (Standard tier only, admin-enabled) ──────────── */}
        {boostEnabled && selectedTier === 'standard' && mode !== 'locked' && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: tipAmount > 0
                ? 'linear-gradient(160deg,#0f172a 0%,#1a1035 100%)'
                : 'linear-gradient(160deg,#0f172a 0%,#18183a 100%)',
              border: tipAmount > 0
                ? '1px solid rgba(249,115,22,0.28)'
                : '1px solid rgba(255,255,255,0.07)',
              boxShadow: tipAmount > 0
                ? '0 6px 28px rgba(249,115,22,0.15)'
                : '0 4px 16px rgba(15,23,42,0.18)',
            }}
          >
            {/* Active boost strip */}
            {tipAmount > 0 && (
              <motion.div
                className="h-0.5"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ transformOrigin: 'left', background: 'linear-gradient(90deg,#f97316,#fbbf24)' }}
              />
            )}
            <div className="px-4 pt-3.5 pb-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: tipAmount > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(99,102,241,0.12)' }}
                  >
                    {tipAmount > 0
                      ? <Flame size={13} strokeWidth={2} className="text-orange-400" />
                      : <Zap size={13} strokeWidth={2} className="text-indigo-400" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-white leading-tight">
                      {tipAmount > 0 ? `₹${tipAmount} boost added` : 'Speed up acceptance'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {tipAmount > 0 ? '100% goes to the worker · attract faster' : 'Add incentive for workers to accept faster'}
                    </p>
                  </div>
                </div>
                {tipAmount > 0 && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => { setPendingBoost(0); setBoostConfirm(true); }}
                    className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.12)', color: 'rgba(248,113,113,0.9)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    Remove
                  </motion.button>
                )}
              </div>

              {/* Boost amount buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {BOOST_AMOUNTS.map((amt) => {
                  const isActive = tipAmount === amt;
                  return (
                    <motion.button
                      key={amt}
                      onClick={() => { setPendingBoost(amt); setBoostConfirm(true); }}
                      whileTap={{ scale: 0.87 }}
                      className="relative h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 overflow-hidden"
                      style={{
                        background: isActive
                          ? 'linear-gradient(135deg,#c2410c,#f97316)'
                          : 'rgba(255,255,255,0.07)',
                        border: isActive ? 'none' : '1px solid rgba(255,255,255,0.09)',
                        boxShadow: isActive ? '0 3px 12px rgba(249,115,22,0.38)' : 'none',
                      }}
                      animate={isActive ? { boxShadow: ['0 0 0 0px rgba(249,115,22,0.4)', '0 0 0 6px rgba(249,115,22,0)', '0 0 0 0px rgba(249,115,22,0)'] } : {}}
                      transition={isActive ? { duration: 1.8, repeat: Infinity } : {}}
                    >
                      <span className="text-[10px]">{amt >= 50 ? (amt === 100 ? '🚀' : '🔥') : '⚡'}</span>
                      <span className="text-[11px] font-black leading-none" style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.55)' }}>
                        +₹{amt}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Active boost summary */}
              <AnimatePresence>
                {tipAmount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-1.5">
                        <Flame size={11} className="text-orange-400" />
                        <span className="text-[11px] font-bold text-orange-300">Worker offer boosted</span>
                      </div>
                      <span className="text-[12px] font-black text-white">₹{baseTotal + tipAmount}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Price summary ─────────────────────────────────────────────── */}
        <div className="bg-slate-50 rounded-xl overflow-hidden ring-1 ring-slate-100">
          <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
            <span className="flex items-center gap-1.5">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Hide breakdown' : 'View price breakdown'}
            </span>
            <div className="flex items-baseline gap-2">
              {promoDiscount > 0 && <span className="text-[11px] line-through text-slate-300">₹{tierPrice + tipAmount}</span>}
              <span className="text-base font-black text-slate-900">₹{displayTotal}</span>
              {mode === 'locked' && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full ring-1 ring-green-100 flex items-center gap-0.5"><Lock size={7} /> Locked</span>}
            </div>
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-3.5 pb-3.5 space-y-2 border-t border-slate-100 pt-3">
                  {/* Standard pricing */}
                  {quote.baseFee != null && !quote.vertical && (
                    <>
                      <BRow label="Base fee"                       value={`₹${quote.baseFee}`} />
                      <BRow label={`Distance · ${quote.distanceKm} km`} value={`₹${quote.distanceFee}`} />
                      <BRow label={`Time · ~${quote.etaMinutes} min`}   value={`₹${quote.timeFee}`} />
                      <BRow label="Platform fee"                   value={`₹${quote.platformFee}`} />
                      {hasSurge && <BRow label={`Surge · ${quote.surgeMultiplier}×`} value={`+₹${Math.round(quote.total - quote.total / quote.surgeMultiplier)}`} cls="text-amber-600 font-bold" />}
                    </>
                  )}
                  {/* Mobile */}
                  {quote.vertical === 'mobile' && (
                    <>
                      <BRow label="Inspection fee"  value={`₹${quote.inspectionFee}`} />
                      {quote.laborFee > 0     && <BRow label="Labour / repair" value={`₹${quote.laborFee}`} />}
                      {quote.sparePartFee > 0 && <BRow label="Spare parts"     value={`₹${quote.sparePartFee}`} />}
                      {quote.urgentSurcharge > 0 && <BRow label="Urgent"       value={`+₹${quote.urgentSurcharge}`} cls="text-orange-600 font-bold" />}
                      {quote.warrantyDays > 0 && <BRow label="Warranty"        value={`${quote.warrantyDays} days`} cls="text-green-600" />}
                    </>
                  )}
                  {/* Construction */}
                  {quote.vertical === 'construction' && (
                    <>
                      <BRow label="Site visit fee" value={`₹${quote.visitFee}`} />
                      {quote.laborFee > 0 && <BRow label={quote.pricingModel === 'hourly' ? `Labour · ${quote.estimatedHours}h` : 'Labour'} value={`₹${quote.laborFee}`} />}
                      {quote.urgentSurcharge > 0 && <BRow label="Urgent" value={`+₹${quote.urgentSurcharge}`} cls="text-orange-600 font-bold" />}
                      {quote.pricingModel === 'project' && <BRow label="Project quote" value="After site visit" cls="text-blue-600" />}
                    </>
                  )}
                  {/* Vehicle */}
                  {quote.vertical === 'vehicle' && (
                    <>
                      <BRow label="Base visit fee" value={`₹${quote.baseVisitFee}`} />
                      {quote.distanceFee > 0 && <BRow label={`Distance · ${quote.distanceKm} km`} value={`₹${quote.distanceFee}`} />}
                      {quote.emergencySurcharge > 0 && <BRow label="Emergency" value={`+₹${quote.emergencySurcharge}`} cls="text-red-600 font-bold" />}
                      {quote.nightSurcharge > 0 && <BRow label="Night" value={`+₹${quote.nightSurcharge}`} cls="text-indigo-600 font-bold" />}
                    </>
                  )}
                  {/* Tier markup */}
                  {tier.multiplier > 1 && <BRow label={`${tier.label} tier markup`} value={`+₹${tierPrice - baseTotal}`} cls="text-blue-600 font-bold" />}
                  {tipAmount > 0 && <BRow label="Worker tip (boost)" value={`+₹${tipAmount}`} cls="text-orange-600 font-bold" />}
                  {promoDiscount > 0 && <BRow label="Promo discount" value={`-₹${promoDiscount}`} cls="text-green-600 font-bold" />}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-900">Total</span>
                    <span className="text-sm font-black text-slate-900">₹{displayTotal}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer assurance */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <Shield size={10} />
          <span className="text-[10px] font-medium">No hidden charges · Price locked at confirmation</span>
        </div>

      </div>
    </div>

    {/* ── Boost confirmation bottom sheet ────────────────────────────────── */}
    <AnimatePresence>
      {boostConfirm && (
        <motion.div
          key="boost-confirm"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={() => setBoostConfirm(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {/* Sheet */}
          <motion.div
            className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden z-10"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{ background: 'linear-gradient(160deg,#0f172a 0%,#1a1035 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            <div className="px-6 pt-3 pb-8">
              {pendingBoost === 0 ? (
                /* Remove boost confirmation */
                <>
                  <p className="text-lg font-black text-white text-center mb-1">Remove ₹{tipAmount} boost?</p>
                  <p className="text-[13px] text-white/45 text-center mb-6">Worker offer will return to ₹{baseTotal}.</p>
                  <motion.button
                    onClick={() => { onTipChange(0); setBoostConfirm(false); setPendingBoost(null); }}
                    whileTap={{ scale: 0.96 }}
                    className="w-full py-4 rounded-2xl font-black text-white text-[15px] mb-3"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow: '0 4px 20px rgba(239,68,68,0.35)' }}
                  >
                    Yes, remove boost
                  </motion.button>
                </>
              ) : (
                /* Add boost confirmation */
                <>
                  <motion.div
                    className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.2),rgba(251,146,60,0.1))', border: '1px solid rgba(249,115,22,0.3)' }}
                    animate={{ boxShadow: ['0 0 0 0px rgba(249,115,22,0.2)', '0 0 0 10px rgba(249,115,22,0)', '0 0 0 0px rgba(249,115,22,0)'] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    <Zap size={24} strokeWidth={2} className="text-orange-400" />
                  </motion.div>
                  <p className="text-lg font-black text-white text-center leading-tight mb-1">
                    Add ₹{pendingBoost} worker boost?
                  </p>
                  <p className="text-[13px] text-white/45 text-center leading-relaxed mb-5">
                    100% of this goes to the worker as extra earnings.
                    Workers see the higher offer — much faster acceptance.
                  </p>

                  {/* Price breakdown */}
                  <div className="rounded-xl px-4 py-3 mb-5 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-white/40">Service price</span>
                      <span className="text-white/65">₹{tierPrice}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-orange-400">
                      <span className="flex items-center gap-1"><Zap size={10} strokeWidth={2.5} />Worker boost</span>
                      <span className="font-bold">+₹{pendingBoost}</span>
                    </div>
                    <div className="h-px bg-white/08" />
                    <div className="flex justify-between">
                      <span className="text-[12px] text-white/50">New total</span>
                      <motion.span key={tierPrice + pendingBoost} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-[15px] font-black text-white">
                        ₹{tierPrice + (pendingBoost || 0)}
                      </motion.span>
                    </div>
                  </div>

                  <motion.button
                    onClick={() => { onTipChange(pendingBoost); setBoostConfirm(false); setPendingBoost(null); }}
                    whileTap={{ scale: 0.96 }}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-[15px] mb-3"
                    style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)', boxShadow: '0 4px 20px rgba(249,115,22,0.40)' }}
                  >
                    <Zap size={16} strokeWidth={2.5} />
                    Add ₹{pendingBoost} boost
                  </motion.button>
                </>
              )}

              <button
                onClick={() => { setBoostConfirm(false); setPendingBoost(null); }}
                className="w-full py-3 rounded-2xl text-[13px] font-semibold text-white/40 hover:text-white/60 transition-colors"
              >
                {pendingBoost === 0 ? 'Keep boost' : 'Keep standard offer'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
