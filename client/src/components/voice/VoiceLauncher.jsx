import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import VoiceAssistant from './VoiceAssistant';

/**
 * Global floating "Zappy Voice" mic. Mounted once for logged-in users so the
 * assistant is reachable from anywhere in the app.
 *
 * Other features can launch it with context via a window event, e.g. ZappyLens:
 *   window.dispatchEvent(new CustomEvent('zappy-voice:open', { detail: { lensScanId } }))
 */
export default function VoiceLauncher() {
  const [open, setOpen] = useState(false);
  const [lensScanId, setLensScanId] = useState(null);

  useEffect(() => {
    const onOpen = (e) => { setLensScanId(e?.detail?.lensScanId || null); setOpen(true); };
    window.addEventListener('zappy-voice:open', onOpen);
    return () => window.removeEventListener('zappy-voice:open', onOpen);
  }, []);

  const close = useCallback(() => { setOpen(false); setLensScanId(null); }, []);

  return (
    <>
      {!open && (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Talk to Zappy Voice"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260, delay: 0.4 }}
          className="fixed right-4 bottom-20 sm:bottom-6 z-[150] w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
        >
          {/* gentle attention pulse */}
          <motion.span
            className="absolute inset-0 rounded-full bg-indigo-500/40"
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
          <Mic size={24} className="relative text-white" strokeWidth={2.2} />
        </motion.button>
      )}

      <VoiceAssistant open={open} onClose={close} initialLensScanId={lensScanId} />
    </>
  );
}
