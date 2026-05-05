import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';

const STEPS = [
  { id: 0, text: 'Notifying workers nearby',     sub: 'Broadcasting your request to available workers'   },
  { id: 1, text: 'Checking availability',         sub: 'Verifying active workers in your area'             },
  { id: 2, text: 'Optimizing match',              sub: 'Comparing distance, rating and response time'      },
  { id: 3, text: 'Selecting best worker',         sub: 'Finalizing the most qualified match for you'       },
];

const REASSURANCES = [
  'Expanding search radius for faster match',
  'Reassigning to a faster nearby worker',
  'Almost there — finalizing your match',
  'High demand area — prioritising your request',
];

const STEP_INTERVAL = 2800;
const REASSURANCE_AFTER = 30000; // show reassurance after 30s

export default function MicroStatusPanel({ active = true, liveMessage = null }) {
  const [stepIdx,      setStepIdx]      = useState(0);
  const [reassurance,  setReassurance]  = useState(null);
  const [reassIdx,     setReasIdx]      = useState(0);
  const startedAt = useRef(Date.now());

  /* cycle through steps */
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setStepIdx(i => (i + 1) % STEPS.length);
    }, STEP_INTERVAL);
    return () => clearInterval(id);
  }, [active]);

  /* reassurance after delay */
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => {
      setReassurance(REASSURANCES[reassIdx % REASSURANCES.length]);
    }, REASSURANCE_AFTER);
    return () => clearTimeout(id);
  }, [active, reassIdx]);

  /* cycle reassurance messages every 12s after first one */
  useEffect(() => {
    if (!reassurance) return;
    const id = setTimeout(() => {
      setReasIdx(i => i + 1);
      setReassurance(REASSURANCES[(reassIdx + 1) % REASSURANCES.length]);
    }, 12000);
    return () => clearTimeout(id);
  }, [reassurance, reassIdx]);

  const step = STEPS[stepIdx];

  return (
    <div className="card bg-blue-50 ring-1 ring-blue-100 overflow-hidden">
      {/* top pulse bar */}
      <div className="flex gap-0.5 mb-4 -mx-4 -mt-4 px-4 pt-0 h-0.5">
        {[0,1,2,3,4,5,6].map(i => (
          <motion.div
            key={i}
            className="flex-1 h-full bg-blue-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {/* pulsing icon */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Radio size={16} className="text-white" />
          </div>
          <motion.span
            className="absolute inset-0 rounded-xl bg-blue-400"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-bold text-blue-900 text-sm leading-tight">{step.text}</p>
              <p className="text-[11px] text-blue-500 mt-0.5 leading-snug">{step.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* step dots */}
      <div className="flex items-center gap-1.5 mt-3 ml-[52px]">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.id}
            className="h-1 rounded-full bg-blue-300"
            animate={{ width: i === stepIdx ? 20 : 6, opacity: i <= stepIdx ? 1 : 0.35 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* live dispatch message (radius expansion) or cycling reassurance */}
      <AnimatePresence mode="wait">
        {(liveMessage || reassurance) && (
          <motion.div
            key={liveMessage || reassurance}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <p className="text-[11px] font-semibold text-blue-700">{liveMessage || reassurance}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
