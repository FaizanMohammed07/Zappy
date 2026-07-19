import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDismissed,
  isIOS,
  isSnoozed,
  isStandalone,
  setDismissed as persistDismiss,
  snooze,
} from '../utils/pwa';

/**
 * usePWAInstall — all install logic, no UI.
 *
 * Owns the `beforeinstallprompt` event, install/dismiss lifecycle and the
 * "should this be visible at all" decision. Components read the returned state
 * and call the returned actions; they never touch the platform APIs directly.
 *
 * @returns {{
 *   canShow: boolean,          // safe to render the prompt
 *   isIOS: boolean,            // needs the manual Add-to-Home-Screen flow
 *   installing: boolean,       // native prompt in flight (button loading state)
 *   promptInstall: () => Promise<'accepted'|'dismissed'|'ios'|'unavailable'>,
 *   dismiss: () => void,       // permanent close (X button)
 *   hide: () => void,          // hide for this render without persisting
 * }}
 */
export function usePWAInstall() {
  const promptEvent = useRef(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => isDismissed() || isSnoozed());
  const [installing, setInstalling] = useState(false);

  const ios = isIOS();

  // Capture the browser's install offer so we can trigger it on our own CTA.
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we drive it ourselves
      promptEvent.current = e;
      setHasNativePrompt(true);
    };
    const onInstalled = () => {
      // Installed successfully (via our button or the browser UI) — gone for good.
      promptEvent.current = null;
      setHasNativePrompt(false);
      setInstalled(true);
      persistDismiss();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    persistDismiss();
    setDismissed(true);
  }, []);

  const hide = useCallback(() => setDismissed(true), []);

  const promptInstall = useCallback(async () => {
    // iOS has no programmatic install — the caller opens the manual modal.
    if (ios && !hasNativePrompt) return 'ios';

    const evt = promptEvent.current;
    if (!evt) return 'unavailable';

    setInstalling(true);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      promptEvent.current = null;
      setHasNativePrompt(false);

      if (choice?.outcome === 'accepted') {
        // `appinstalled` will fire and persist the permanent dismissal.
        return 'accepted';
      }
      // User dismissed the browser dialog — snooze for 7 days, hide for now.
      snooze();
      setDismissed(true);
      return 'dismissed';
    } finally {
      setInstalling(false);
    }
  }, [ios, hasNativePrompt]);

  // Renderable when: not installed, not dismissed/snoozed, and there is an
  // install path — either a captured native prompt or iOS's manual flow.
  const canShow = !installed && !dismissed && (hasNativePrompt || ios);

  return { canShow, isIOS: ios, installing, promptInstall, dismiss, hide };
}

export default usePWAInstall;
