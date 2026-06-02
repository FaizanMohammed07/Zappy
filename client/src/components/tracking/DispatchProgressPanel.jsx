/**
 * DispatchProgressPanel
 * ---------------------------------------------------------------------------
 * Replaces the old MicroStatusPanel fake-cycling tips screen.
 * Drives entirely from real backend socket events stored in orderSlice:
 *   dispatchPhase: 'created' | 'searching' | 'expanding' | 'reviewing' | 'accepted'
 *   dispatchStep / dispatchTotalSteps / dispatchRadiusKm / dispatchWorkersFound
 *
 * No fake timers. No educational messages. Pure operational state.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOrder } from '../../modules/order/orderSlice';
import { CheckCircle2, Radio, Users, Loader2, Zap } from 'lucide-react';

// Each phase maps to a UI row in the vertical timeline.
// Steps before 'searching' are auto-completed at mount.
const PHASES = [
  { key: 'created',    icon: CheckCircle2, label: 'Request Created',         sub: 'Your request is queued for dispatch' },
  { key: 'searching',  icon: Radio,        label: 'Searching Nearby',         sub: 'Broadcasting to available workers' },
  { key: 'expanding',  icon: Radio,        label: 'Expanding Search Radius',  sub: null }, // sub injected dynamically
  { key: 'reviewing',  icon: Users,        label: 'Workers Notified',         sub: null }, // sub injected dynamically
  { key: 'accepted',   icon: CheckCircle2, label: 'Worker Accepted',          sub: 'Connecting you now…' },
];

const PHASE_ORDER = PHASES.map((p) => p.key);

// Elapsed-time label (e.g. "23s" or "1m 12s")
function elapsed(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function DispatchProgressPanel() {
  const liveOrder = useSelector(selectOrder);
  const {
    dispatchPhase,
    dispatchStep,
    dispatchTotalSteps,
    dispatchRadiusKm,
    dispatchWorkersFound,
    dispatchElapsedSec,
    dispatchBoostPaise,
  } = liveOrder;

  // Local elapsed counter — ticks every second so the panel feels live.
  // Seeded from the server value to stay in sync.
  const [localElapsed, setLocalElapsed] = useState(dispatchElapsedSec || 0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (dispatchElapsedSec > localElapsed) setLocalElapsed(dispatchElapsedSec);
  }, [dispatchElapsedSec]); // eslint-disable-line

  useEffect(() => {
    timerRef.current = setInterval(() => setLocalElapsed((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const activeIdx = PHASE_ORDER.indexOf(dispatchPhase);

  // Dynamic sub-labels injected per phase
  const dynamicSub = {
    searching:  `Radius: ${dispatchRadiusKm ? `${dispatchRadiusKm}km` : 'nearby'} · ${elapsed(localElapsed)} elapsed`,
    expanding:  dispatchRadiusKm
      ? `Expanded to ${dispatchRadiusKm < 1 ? `${Math.round(dispatchRadiusKm * 1000)}m` : `${dispatchRadiusKm}km`} — still looking`
      : 'Expanding search area',
    reviewing:  dispatchWorkersFound > 0
      ? `${dispatchWorkersFound} worker${dispatchWorkersFound > 1 ? 's' : ''} reviewing your request`
      : 'Waiting for a worker to accept',
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#0f1f3d 100%)', boxShadow: '0 8px 32px rgba(15,23,42,0.22)' }}
    >
      {/* Animated scan bar at top */}
      <div className="relative h-0.5 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #a78bfa, transparent)' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="px-4 pt-4 pb-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center"
              animate={{ borderColor: ['rgba(99,102,241,0.3)', 'rgba(167,139,250,0.6)', 'rgba(99,102,241,0.3)'] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Loader2 size={14} className="text-indigo-400 animate-spin" />
            </motion.div>
            <div>
              <p className="text-sm font-black text-white">Finding your worker</p>
              <p className="text-[10px] text-white/40 mt-0.5">{elapsed(localElapsed)} elapsed · Step {Math.max(1, dispatchStep)}/{dispatchTotalSteps || 10}</p>
            </div>
          </div>

          {/* Boost badge */}
          <AnimatePresence>
            {dispatchBoostPaise > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.35)' }}
              >
                <Zap size={10} strokeWidth={2.5} className="text-orange-400" />
                <span className="text-[10px] font-black text-orange-400">+₹{Math.round(dispatchBoostPaise / 100)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Phase timeline */}
        <div className="space-y-0">
          {PHASES.map((phase, idx) => {
            const isDone    = idx < activeIdx;
            const isActive  = idx === activeIdx;
            const isPending = idx > activeIdx;
            const sub       = dynamicSub[phase.key] ?? phase.sub;
            const Icon      = phase.icon;

            return (
              <div key={phase.key} className="flex gap-3">
                {/* Left: icon + connector */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    animate={
                      isActive
                        ? { borderColor: ['rgba(99,102,241,0.5)', 'rgba(167,139,250,0.9)', 'rgba(99,102,241,0.5)'] }
                        : {}
                    }
                    transition={{ duration: 1.8, repeat: Infinity }}
                    style={{
                      background: isDone  ? 'rgba(34,197,94,0.15)'
                                : isActive ? 'rgba(99,102,241,0.20)'
                                : 'rgba(255,255,255,0.04)',
                      border: isDone  ? '1px solid rgba(34,197,94,0.4)'
                             : isActive ? '1.5px solid rgba(99,102,241,0.6)'
                             : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={13} strokeWidth={2.5} className="text-green-400" />
                    ) : isActive ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <Icon size={12} strokeWidth={2} className="text-indigo-400" />
                      </motion.div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/15" />
                    )}
                  </motion.div>
                  {/* Connector line */}
                  {idx < PHASES.length - 1 && (
                    <div
                      className="w-px flex-1 mt-0.5 mb-0.5"
                      style={{
                        minHeight: 18,
                        background: isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)',
                      }}
                    />
                  )}
                </div>

                {/* Right: label + sub */}
                <div className="pb-3 min-w-0 flex-1">
                  <p
                    className={`text-[13px] font-bold leading-tight ${
                      isDone   ? 'text-green-400'
                    : isActive ? 'text-white'
                    : 'text-white/25'
                    }`}
                  >
                    {phase.label}
                  </p>
                  <AnimatePresence mode="wait">
                    {(isActive || isDone) && sub && (
                      <motion.p
                        key={sub}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`text-[11px] mt-0.5 leading-snug ${isDone ? 'text-green-500/60' : 'text-white/40'}`}
                      >
                        {sub}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pulse strip — workers reviewing */}
        {dispatchPhase === 'reviewing' && dispatchWorkersFound > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <div className="flex gap-0.5">
              {Array.from({ length: dispatchWorkersFound > 5 ? 5 : dispatchWorkersFound }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
              {dispatchWorkersFound > 5 && (
                <span className="text-[10px] text-indigo-400 font-bold ml-1">+{dispatchWorkersFound - 5}</span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-indigo-300">
              Waiting for first acceptance
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
