import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingDown, AlertCircle } from 'lucide-react';

const TRAFFIC_MESSAGES = [
  { type: 'good',  text: 'Faster route detected',          sub: 'Worker is taking a quicker path'       },
  { type: 'delay', text: 'Slight delay due to traffic',    sub: 'ETA updated — still on the way'        },
  { type: 'good',  text: 'On track for arrival',           sub: 'No delays on current route'            },
  { type: 'good',  text: 'Almost there',                   sub: 'Worker is close to your location'      },
];

export default function ETABanner({ etaMinutes, status }) {
  const prevEta   = useRef(etaMinutes);
  const [msg,     setMsg]     = useState(null);
  const msgTimer  = useRef(null);

  /* show a message when eta changes */
  useEffect(() => {
    if (etaMinutes == null) return;
    const prev = prevEta.current;
    prevEta.current = etaMinutes;

    if (prev == null) return; /* first render, no comparison */

    const diff = prev - etaMinutes;

    if (diff >= 2) {
      /* got faster */
      show({ type: 'good',  text: `${diff} min faster route found`, sub: 'Route optimised for faster arrival' });
    } else if (diff <= -2) {
      /* delay */
      show({ type: 'delay', text: `~${Math.abs(diff)} min delay detected`, sub: 'Traffic on current route — monitoring' });
    } else if (etaMinutes <= 2 && status === 'on_the_way') {
      show({ type: 'good',  text: 'Worker is almost here', sub: 'Estimated arrival in under 2 minutes' });
    }
  }, [etaMinutes, status]);

  function show(message) {
    clearTimeout(msgTimer.current);
    setMsg(message);
    msgTimer.current = setTimeout(() => setMsg(null), 5000);
  }

  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key={msg.text}
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,   scale: 1    }}
          exit={{    opacity: 0, y: -8,  scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className={`mx-4 mt-2 flex items-center gap-3 px-4 py-3 rounded-xl shadow-soft ${
            msg.type === 'good' ? 'bg-green-50 ring-1 ring-green-100' : 'bg-amber-50 ring-1 ring-amber-100'
          }`}
        >
          {msg.type === 'good'
            ? <TrendingDown size={15} className="text-green-600 shrink-0" />
            : <AlertCircle  size={15} className="text-amber-600 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${msg.type === 'good' ? 'text-green-800' : 'text-amber-800'}`}>
              {msg.text}
            </p>
            <p className={`text-[10px] mt-0.5 ${msg.type === 'good' ? 'text-green-600' : 'text-amber-600'}`}>
              {msg.sub}
            </p>
          </div>
          {etaMinutes != null && (
            <div className="flex items-center gap-1 shrink-0">
              <Clock size={11} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-700">{etaMinutes} min</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
