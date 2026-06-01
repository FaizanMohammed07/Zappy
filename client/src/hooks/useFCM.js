import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../modules/auth/authSlice';
import {
  useRegisterDeviceTokenMutation,
  useRegisterWorkerDeviceTokenMutation,
} from '../services/api';

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_VAPID_KEY,
} = import.meta.env;

export const FIREBASE_CONFIGURED =
  !!VITE_FIREBASE_API_KEY &&
  !!VITE_FIREBASE_AUTH_DOMAIN &&
  !!VITE_FIREBASE_PROJECT_ID &&
  !!VITE_FIREBASE_MESSAGING_SENDER_ID &&
  !!VITE_FIREBASE_APP_ID &&
  !!VITE_FIREBASE_VAPID_KEY;

// Permission state exposed so components can render "Enable notifications" banner
let _permissionState = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'not_supported' | 'not_configured'
let _listeners = new Set();

function setPermState(state) {
  _permissionState = state;
  _listeners.forEach((fn) => fn(state));
}

/** Returns current push permission state reactively. */
export function useNotificationPermission() {
  const [state, setState] = useState(_permissionState);
  useEffect(() => {
    setState(_permissionState);
    _listeners.add(setState);
    return () => _listeners.delete(setState);
  }, []);
  return state;
}

export function useFCM() {
  const { accessToken, role } = useSelector(selectAuth);
  const [registerUserToken]   = useRegisterDeviceTokenMutation();
  const [registerWorkerToken] = useRegisterWorkerDeviceTokenMutation();

  const init = useCallback(async () => {
    if (!accessToken) return;

    if (!FIREBASE_CONFIGURED) {
      setPermState('not_configured');
      if (import.meta.env.DEV) {
        console.warn('[FCM] Firebase env vars not set — push notifications disabled.\n'
          + 'Set VITE_FIREBASE_* in .env and restart Vite.');
      }
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermState('not_supported');
      return;
    }

    // Check current permission without prompting (don't disturb user on background re-init)
    const current = Notification.permission;
    if (current === 'denied') {
      setPermState('denied');
      return;
    }

    try {
      // 1. Request permission — only shows dialog if 'default'
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPermState(permission === 'denied' ? 'denied' : 'unknown');
        return;
      }
      setPermState('granted');

      // 2. Register service worker — pass Firebase config as URL params so the SW
      //    doesn't need to hardcode credentials (fixes the security/flexibility issue).
      let swReg;
      try {
        const swParams = new URLSearchParams({
          apiKey:            VITE_FIREBASE_API_KEY,
          authDomain:        VITE_FIREBASE_AUTH_DOMAIN,
          projectId:         VITE_FIREBASE_PROJECT_ID,
          messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId:             VITE_FIREBASE_APP_ID,
        });
        swReg = await navigator.serviceWorker.register(
          `/firebase-messaging-sw.js?${swParams.toString()}`,
          { scope: '/' }
        );
        await navigator.serviceWorker.ready;
      } catch (err) {
        // Fails on plain HTTP (non-localhost). Common in staging over HTTP.
        if (import.meta.env.DEV) console.warn('[FCM] SW registration failed:', err.message);
        return;
      }

      // 3. Lazy-load Firebase SDK
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

      const app = getApps().length
        ? getApps()[0]
        : initializeApp({
            apiKey:            VITE_FIREBASE_API_KEY,
            authDomain:        VITE_FIREBASE_AUTH_DOMAIN,
            projectId:         VITE_FIREBASE_PROJECT_ID,
            messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId:             VITE_FIREBASE_APP_ID,
          });

      const messaging = getMessaging(app);

      // 4. Get FCM token
      const fcmToken = await getToken(messaging, {
        vapidKey: VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (!fcmToken) {
        if (import.meta.env.DEV) console.warn('[FCM] getToken returned empty — VAPID key wrong or SW not activated?');
        return;
      }

      // 5. Register with backend
      const register = role === 'worker' ? registerWorkerToken : registerUserToken;
      await register({ token: fcmToken }).unwrap().catch((err) => {
        if (import.meta.env.DEV) console.warn('[FCM] Token registration failed:', err);
      });

      if (import.meta.env.DEV) console.info('[FCM] ✅ Push notifications ready. Token registered.');

      // 6. Foreground message handler — show toast when app is open
      onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        if (!title) return;
        const deepLink = payload.data?.deepLink;
        import('react-hot-toast').then(({ default: toast }) => {
          toast(
            (t) => (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: deepLink ? 'pointer' : 'default' }}
                onClick={() => {
                  if (deepLink) window.location.href = deepLink;
                  toast.dismiss(t.id);
                }}
              >
                <span style={{ fontSize: 20 }}>🔔</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
                  {body && <div style={{ fontSize: 12, opacity: 0.8 }}>{body}</div>}
                </div>
              </div>
            ),
            {
              duration: 6000,
              style: { background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 14 },
            }
          );
        }).catch(() => {});
      });

    } catch (err) {
      // Don't surface noise for browser-incompatibility codes
      const silentCodes = ['messaging/unsupported-browser', 'messaging/permission-blocked'];
      if (!silentCodes.includes(err?.code)) {
        console.error('[FCM] Init error:', err?.code || err?.message);
      }
    }
  }, [accessToken, role, registerUserToken, registerWorkerToken]);

  useEffect(() => {
    init();

    // Re-init when tab becomes visible (user may have granted permission in settings)
    function onVisibility() {
      if (document.visibilityState === 'visible') init();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [init]);
}
