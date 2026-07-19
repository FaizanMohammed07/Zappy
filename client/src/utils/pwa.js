/**
 * PWA install — pure helpers.
 *
 * Everything here is side-effect free (beyond touching localStorage) and
 * framework-agnostic so the logic can be unit-reasoned about and reused. The
 * React glue lives in `src/hooks/usePWAInstall.js`; the UI in
 * `src/components/pwa/*`.
 */

// localStorage keys — namespaced so they never collide with other app state.
export const DISMISS_KEY = 'zappy:pwa:dismissed';    // permanent X-button dismissal
export const SNOOZE_KEY  = 'zappy:pwa:snoozeUntil';  // epoch ms — re-show after this
export const SNOOZE_MS   = 7 * 24 * 60 * 60 * 1000;  // 7 days

/** Guarded localStorage — private-mode / SSR safe. */
function safeGet(key) {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — fail open, the prompt just re-appears */
  }
}

/** True when the app is running as an installed PWA (any platform). */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)')?.matches;
  // iOS Safari exposes navigator.standalone instead of display-mode.
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(mm || iosStandalone);
}

/** True on iOS/iPadOS (where `beforeinstallprompt` never fires). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but is a touch device.
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return iOSDevice || iPadOS;
}

/** True when the current browser is Safari (used to tune iOS copy). */
export function isSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
}

/** The user permanently closed the card via the X. */
export function isDismissed() {
  return safeGet(DISMISS_KEY) === '1';
}
export function setDismissed() {
  safeSet(DISMISS_KEY, '1');
}

/** The user dismissed the *browser* install dialog — snooze for 7 days. */
export function isSnoozed() {
  const until = Number(safeGet(SNOOZE_KEY) || 0);
  return until > Date.now();
}
export function snooze(ms = SNOOZE_MS) {
  safeSet(SNOOZE_KEY, String(Date.now() + ms));
}
