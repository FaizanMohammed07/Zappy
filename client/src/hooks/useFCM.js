import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../modules/auth/authSlice';
import { useRegisterDeviceTokenMutation } from '../services/api';

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_VAPID_KEY,
} = import.meta.env;

const FIREBASE_CONFIGURED =
  VITE_FIREBASE_API_KEY &&
  VITE_FIREBASE_PROJECT_ID &&
  VITE_FIREBASE_MESSAGING_SENDER_ID &&
  VITE_FIREBASE_APP_ID;

export function useFCM() {
  const { accessToken } = useSelector(selectAuth);
  const [registerDeviceToken] = useRegisterDeviceTokenMutation();

  useEffect(() => {
    if (!accessToken || !FIREBASE_CONFIGURED) return;
    if (!('Notification' in window)) return;

    async function init() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const { initializeApp, getApps } = await import('firebase/app');
        const { getMessaging, getToken } = await import('firebase/messaging');

        const firebaseConfig = {
          apiKey: VITE_FIREBASE_API_KEY,
          authDomain: VITE_FIREBASE_AUTH_DOMAIN,
          projectId: VITE_FIREBASE_PROJECT_ID,
          messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: VITE_FIREBASE_APP_ID,
        };

        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
          await registerDeviceToken({ token }).unwrap();
        }
      } catch {
        // FCM unavailable (blocked, no service worker, etc.) — silent fail
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
}
