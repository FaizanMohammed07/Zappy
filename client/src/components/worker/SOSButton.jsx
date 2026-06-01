/**
 * Worker SOS Emergency Button
 * 3-second hold to trigger. Sends GPS + order details to emergency contact.
 *
 * Pet service variant (#75): after trigger, shows emergency vet contacts
 * (AWBI helpline, Blue Cross India) alongside the standard 112 alert.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Phone, Heart } from 'lucide-react';
import { useTriggerSOSMutation } from '../../services/api';
import toast from 'react-hot-toast';

// India pet emergency contacts shown after SOS triggers on a pet service job
const PET_EMERGENCY_CONTACTS = [
  { label: 'AWBI Helpline',      number: '1962',         hint: '24h Animal Welfare Board of India' },
  { label: 'Blue Cross India',   number: '044-22350959', hint: 'Chennai — national vet referral' },
  { label: 'PETA India',         number: '1800-22-PETA', hint: 'Emergency cruelty / welfare line' },
  { label: 'General Emergency',  number: '112',          hint: 'Police / Ambulance' },
];

const PET_SERVICES = new Set([
  'pet_grooming', 'pet_walking', 'pet_transport', 'pet_sitting', 'pet_vet_assist', 'pet_training_assist',
]);

export default function SOSButton({ orderId, lat, lng, service }) {
  const [holding,   setHolding]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [triggered, setTriggered] = useState(false);
  const [triggerSOS] = useTriggerSOSMutation();
  const timerRef   = useRef(null);
  const intervalRef = useRef(null);
  const HOLD_MS    = 3000;
  const isPetJob   = PET_SERVICES.has(service);

  function startHold() {
    if (triggered) return;
    setHolding(true);
    setProgress(0);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / HOLD_MS) * 100, 100);
      setProgress(pct);
    }, 50);
    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setHolding(false);
      setProgress(100);
      fire();
    }, HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
    setHolding(false);
    setProgress(0);
  }

  async function fire() {
    if (lat == null || lng == null) {
      toast.error('GPS not ready. Call 112 directly.', { duration: 6000 });
      setTriggered(false);
      return;
    }
    try {
      await triggerSOS({ orderId, lat, lng, type: isPetJob ? 'pet_emergency' : 'worker_sos' }).unwrap();
      setTriggered(true);
      const msg = isPetJob
        ? '🐾 SOS sent. Emergency contact + support notified. See vet contacts below.'
        : '🆘 SOS sent. Emergency contact + support notified.';
      toast.error(msg, { duration: 8000 });
    } catch {
      toast.error('SOS failed to send. Call 112 immediately.');
    }
  }

  return (
    <div className="space-y-3">
      {/* Emergency services shortcut — always visible, no hold required (#90) */}
      <a
        href="tel:112"
        className="w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm bg-slate-800 text-white ring-1 ring-white/10"
      >
        <Phone size={14} strokeWidth={2.5} />
        Call 112 — Police / Ambulance
      </a>

      <div className="relative">
        <motion.button
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          whileTap={{ scale: 0.94 }}
          className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all select-none ${
            triggered
              ? 'bg-red-100 text-red-600 ring-1 ring-red-200'
              : 'bg-red-600 text-white shadow-lg shadow-red-200'
          }`}
          style={{ WebkitUserSelect: 'none' }}
        >
          {triggered ? <Phone size={15} /> : isPetJob ? <Heart size={15} /> : <ShieldAlert size={15} />}
          {triggered
            ? (isPetJob ? 'SOS Active — Vet contacts below' : 'SOS Sent — Support notified')
            : lat == null
              ? '⚠️ GPS not ready — Hold for SOS'
              : isPetJob ? 'Animal emergency? Hold 3s for SOS' : 'Hold 3s for SOS'}

          {/* Progress ring */}
          {holding && (
            <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90 absolute right-4">
              <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
              <circle
                cx="10" cy="10" r="8" fill="none"
                stroke="white" strokeWidth="2.5"
                strokeDasharray={50.27}
                strokeDashoffset={50.27 * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.button>

        {holding && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
            >
              Keep holding… {Math.round((HOLD_MS - (progress / 100 * HOLD_MS)) / 1000) + 1}s
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Pet emergency contacts — shown after SOS triggers on a pet job (#75) ── */}
      <AnimatePresence>
        {triggered && isPetJob && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-rose-950/70 ring-1 ring-rose-800/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Heart size={13} strokeWidth={2.5} className="text-rose-400 fill-rose-400" />
                <p className="text-xs font-extrabold text-rose-300 uppercase tracking-widest">Pet Emergency Contacts</p>
              </div>
              {PET_EMERGENCY_CONTACTS.map((c) => (
                <div key={c.number} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{c.label}</p>
                    <p className="text-[10px] text-rose-300/60">{c.hint}</p>
                  </div>
                  <a
                    href={`tel:${c.number.replace(/[^0-9+]/g, '')}`}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-bold"
                  >
                    <Phone size={11} strokeWidth={2.5} />
                    {c.number}
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
