import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper around the browser SpeechSynthesis API for Zappy Voice replies.
 * Speaks the assistant's text aloud, picking the best available voice for the
 * detected language (English / Hindi / Telugu, India-first).
 *
 * Returns { supported, speaking, speak, cancel }.
 *   speak(text, langHint?) — langHint is a BCP-47 tag like 'hi-IN' / 'te-IN'.
 */

// Heuristic language detection from the script the text is written in — good
// enough to pick a TTS voice without an extra API call.
function detectLang(text) {
  if (/[ఀ-౿]/.test(text)) return 'te-IN'; // Telugu block
  if (/[ऀ-ॿ]/.test(text)) return 'hi-IN'; // Devanagari (Hindi)
  return 'en-IN';
}

export default function useTextToSpeech() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const supported = !!synth;
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef([]);

  // Voices load asynchronously in most browsers.
  useEffect(() => {
    if (!supported) return undefined;
    const load = () => { voicesRef.current = synth.getVoices() || []; };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, [supported, synth]);

  const pickVoice = useCallback((lang) => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    const base = lang.split('-')[0];
    return (
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang?.startsWith(base)) ||
      voices.find((v) => v.lang?.startsWith('en')) ||
      null
    );
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    try { synth.cancel(); } catch { /* noop */ }
    setSpeaking(false);
  }, [supported, synth]);

  const speak = useCallback((text, langHint) => {
    if (!supported || !text) return;
    try {
      synth.cancel(); // stop any in-flight utterance first
      const lang = langHint || detectLang(text);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1.45; // snappy delivery — replies are short, so faster reads better
      u.pitch = 1.0;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, [supported, synth, pickVoice]);

  // Stop speech if the component using this unmounts.
  useEffect(() => () => { try { synth?.cancel(); } catch { /* noop */ } }, [synth]);

  return { supported, speaking, speak, cancel };
}
