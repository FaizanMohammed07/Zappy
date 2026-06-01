/**
 * NotificationBanner — shown to users who haven't granted push permission.
 * Appears as a dismissible bottom strip on HomePage and OrderTrackingPage.
 * Disappears permanently once permission is granted.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, BellOff } from 'lucide-react';
import { useNotificationPermission, FIREBASE_CONFIGURED } from '../../hooks/useFCM';

export default function NotificationBanner() {
  const perm = useNotificationPermission();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('notif_banner_dismissed') === '1'
  );

  // Don't render if: granted, not configured, not supported, or dismissed this session
  if (perm === 'granted' || perm === 'not_supported' || perm === 'not_configured' || dismissed) {
    return null;
  }

  function dismiss() {
    sessionStorage.setItem('notif_banner_dismissed', '1');
    setDismissed(true);
  }

  async function enableNotifications() {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      // useFCM will pick this up on next visibilitychange or remount
      dismiss();
      window.dispatchEvent(new Event('focus')); // nudge useFCM to re-init
    }
  }

  const isDenied = perm === 'denied';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed bottom-[72px] inset-x-0 z-40 px-4 pointer-events-none"
      >
        <div
          className="w-full max-w-lg mx-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl pointer-events-auto"
          style={{
            background: isDenied
              ? 'linear-gradient(135deg,#1e293b,#0f172a)'
              : 'linear-gradient(135deg,#4f46e5,#6366f1)',
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            {isDenied
              ? <BellOff size={16} strokeWidth={2} className="text-white" />
              : <Bell size={16} strokeWidth={2} className="text-white" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-white leading-tight">
              {isDenied ? 'Notifications are blocked' : 'Enable order notifications'}
            </p>
            <p className="text-[10px] text-white/60 mt-0.5 leading-tight">
              {isDenied
                ? 'Go to browser settings → allow Zappy notifications'
                : "Get real-time updates on your worker's arrival"}
            </p>
          </div>

          {!isDenied && (
            <button
              onClick={enableNotifications}
              className="shrink-0 px-3 py-1.5 bg-white text-indigo-600 text-[11px] font-extrabold rounded-xl"
            >
              Enable
            </button>
          )}

          <button
            onClick={dismiss}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
