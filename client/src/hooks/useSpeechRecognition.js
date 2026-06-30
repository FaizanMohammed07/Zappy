import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Thin wrapper around the Web Speech API (SpeechRecognition).
 * Works in Chrome / Edge / most Android browsers; gracefully reports
 * `supported: false` elsewhere so the UI can hide the mic.
 *
 * Usage:
 *   const { supported, listening, start, stop } = useSpeechRecognition({
 *     onResult: (text) => setQuery(text),
 *   });
 */
export default function useSpeechRecognition({ lang = 'en-IN', interim = false, onResult, onInterim, onError } = {}) {
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SR;

  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = interim;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onresult = (e) => {
        // With interim results on, emit the live (non-final) transcript as it
        // builds, and only fire onResult once a result is marked final.
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const text = r?.[0]?.transcript?.trim();
          if (!text) continue;
          if (r.isFinal) { onResultRef.current?.(text); }
          else { interimText += text + ' '; }
        }
        if (interimText) onInterimRef.current?.(interimText.trim());
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        onErrorRef.current?.(e?.error || 'error');
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch (err) {
      setListening(false);
      onErrorRef.current?.(err?.message || 'error');
    }
  }, [supported, lang, SR]);

  // Abort any active recognition on unmount.
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, start, stop };
}
