import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mic, Send, Volume2, VolumeX, Sparkles, ChevronRight,
  CheckCircle2, MapPin, Clock, Wallet as WalletIcon, Keyboard,
} from 'lucide-react';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import { useVoiceChatMutation } from '../../services/api';

const LANGS = [
  { code: 'en-IN', label: 'EN' },
  { code: 'hi-IN', label: 'हिं' },
  { code: 'te-IN', label: 'తె' },
];

const GREETING = {
  'en-IN': "Hi! I'm Zappy Voice. Tell me what you need — like \"my bike got a puncture\" or \"book a car wash tomorrow\".",
  'hi-IN': 'नमस्ते! मैं Zappy Voice हूँ। बताइए आपको क्या चाहिए — जैसे "मेरी बाइक पंक्चर हो गई"।',
  'te-IN': 'నమస్తే! నేను Zappy Voice. మీకు ఏం కావాలో చెప్పండి — ఉదా: "నా బైక్ పంక్చర్ అయింది".',
};

const STATUS_LABEL = {
  idle: 'Tap the mic and speak',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

let _mid = 0;
const nextId = () => `m${Date.now()}_${_mid++}`;

export default function VoiceAssistant({ open, onClose, initialLensScanId = null }) {
  const nav = useNavigate();
  const [lang, setLang] = useState('en-IN');
  const [messages, setMessages] = useState([]);
  const [interim, setInterim] = useState('');
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [muted, setMuted] = useState(() => localStorage.getItem('zappyVoiceMuted') === '1');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');

  const coordsRef = useRef(null);
  const scrollRef = useRef(null);
  const lensRef = useRef(initialLensScanId);
  const sendRef = useRef(null);

  const [voiceChat] = useVoiceChatMutation();
  const tts = useTextToSpeech();

  // Coarse location once, so quotes are real (mirrors ZappyLens).
  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => { /* denied — assistant will ask for the area */ },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
    );
  }, [open]);

  const speak = useCallback((text) => {
    if (muted || !tts.supported) return;
    setStatus('speaking');
    tts.speak(text, lang);
  }, [muted, tts, lang]);

  // When TTS finishes, drop back to idle.
  useEffect(() => {
    if (status === 'speaking' && !tts.speaking) setStatus('idle');
  }, [tts.speaking, status]);

  const send = useCallback(async (userText) => {
    const text = (userText || '').trim();
    if (!text) return;
    setInterim('');
    const userMsg = { id: nextId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setStatus('thinking');

    // Build the transcript the server expects (role + content only).
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const body = { messages: history };
    if (coordsRef.current) { body.lat = coordsRef.current.lat; body.lng = coordsRef.current.lng; }
    if (lensRef.current) { body.lensScanId = lensRef.current; lensRef.current = null; }

    try {
      const res = await voiceChat(body).unwrap();
      const aMsg = { id: nextId(), role: 'assistant', content: res.reply || '…', cards: res.cards || [], actions: res.actions || [] };
      setMessages((prev) => [...prev, aMsg]);
      // speak() flips status to 'speaking' and back to idle on end. If we can't or
      // won't speak, return to idle immediately so the mic isn't stuck on "thinking".
      if (!muted && tts.supported && aMsg.content) speak(aMsg.content);
      else setStatus('idle');
    } catch (err) {
      const msg = err?.data?.error || (err?.status === 503
        ? 'Voice assistant is warming up — please try again in a moment.'
        : "Sorry, something went wrong. Let's try again.");
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: msg, cards: [], actions: [] }]);
      setStatus('idle');
    }
  }, [messages, voiceChat, speak, muted, tts.supported]);
  sendRef.current = send;

  const { supported: micSupported, listening, start, stop } = useSpeechRecognition({
    lang,
    interim: true,
    onInterim: setInterim,
    onResult: (text) => { setInterim(''); sendRef.current?.(text); },
    onError: (e) => {
      setStatus('idle');
      if (e === 'not-allowed' || e === 'service-not-allowed') {
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: 'I need microphone access to hear you. You can also type your request.', cards: [], actions: [] }]);
        setTyping(true);
      }
    },
  });

  useEffect(() => { setStatus(listening ? 'listening' : (s) => (s === 'listening' ? 'idle' : s)); }, [listening]);

  // First-open greeting (local — not billed against the model).
  useEffect(() => {
    if (open && messages.length === 0) {
      const g = GREETING[lang] || GREETING['en-IN'];
      setMessages([{ id: nextId(), role: 'assistant', content: g, cards: [], actions: [], greeting: true }]);
      speak(g);
      // If launched from a ZappyLens scan, immediately ask the AI about it.
      if (lensRef.current) setTimeout(() => sendRef.current?.("Here's a photo of my problem — what's wrong and can you book it?"), 400);
    }
    if (!open) {
      tts.cancel();
      try { stop(); } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset conversation fully when closed.
  useEffect(() => {
    if (!open) {
      setMessages([]); setInterim(''); setStatus('idle'); setTyping(false); setTyped('');
      lensRef.current = initialLensScanId;
    }
  }, [open, initialLensScanId]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, interim, status]);

  const toggleMute = () => {
    setMuted((m) => {
      const nm = !m;
      localStorage.setItem('zappyVoiceMuted', nm ? '1' : '0');
      if (nm) { tts.cancel(); if (status === 'speaking') setStatus('idle'); }
      return nm;
    });
  };

  const tapMic = () => {
    if (status === 'thinking') return;
    tts.cancel();
    if (listening) { stop(); return; }
    setTyping(false);
    start();
  };

  const submitTyped = (e) => {
    e?.preventDefault?.();
    const t = typed.trim();
    if (!t) return;
    setTyped('');
    send(t);
  };

  const goAction = (a) => {
    if (a?.type === 'navigate' && a.to) { onClose?.(); nav(a.to); }
  };

  if (!open) return null;

  const busy = status === 'thinking';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full sm:max-w-md h-[88vh] sm:h-[80vh] bg-gradient-to-b from-white to-slate-50 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <Sparkles size={17} className="text-white" />
                {(listening || status === 'speaking') && (
                  <motion.span className="absolute inset-0 rounded-xl ring-2 ring-indigo-400"
                    animate={{ opacity: [0.6, 0], scale: [1, 1.35] }} transition={{ duration: 1.2, repeat: Infinity }} />
                )}
              </div>
              <div>
                <h2 className="font-black text-slate-900 leading-none">Zappy Voice</h2>
                <p className="text-[11px] text-indigo-500 mt-0.5 font-semibold">{STATUS_LABEL[status]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-full bg-slate-100 p-0.5">
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-full transition-colors ${lang === l.code ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
              <button onClick={toggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} onAction={goAction} onBook={(text) => send(text)} nav={(to) => { onClose?.(); nav(to); }} />
            ))}

            {/* Live (interim) user transcription */}
            {interim && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-indigo-500/80 text-white px-3.5 py-2 text-sm italic">
                  {interim}…
                </div>
              </div>
            )}

            {/* Thinking shimmer */}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white border border-slate-100 px-4 py-3 flex items-center gap-1.5 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-2 h-2 rounded-full bg-indigo-400"
                      animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="px-4 pt-2 pb-4 border-t border-slate-100 bg-white/70">
            {typing ? (
              <form onSubmit={submitTyped} className="flex items-center gap-2">
                <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your request…"
                  className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                <button type="submit" disabled={!typed.trim()}
                  className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40">
                  <Send size={18} />
                </button>
                {micSupported && (
                  <button type="button" onClick={() => setTyping(false)} aria-label="Use voice"
                    className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Mic size={18} />
                  </button>
                )}
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setTyping(true)} aria-label="Type instead"
                  className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Keyboard size={18} />
                </button>

                {/* Big mic with waveform */}
                <button onClick={tapMic} disabled={!micSupported || busy} aria-pressed={listening}
                  aria-label={listening ? 'Stop' : 'Speak'}
                  className="relative flex-1 max-w-[150px] mx-auto h-14 rounded-full flex items-center justify-center gap-2 font-bold text-white transition-colors disabled:opacity-50"
                  style={{ background: listening ? 'linear-gradient(135deg,#e11d48,#be123c)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {listening ? <Waveform /> : <Mic size={22} />}
                  {!listening && <span className="text-sm">{busy ? '…' : 'Speak'}</span>}
                  {listening && (
                    <motion.span className="absolute inset-0 rounded-full ring-2 ring-rose-300"
                      animate={{ opacity: [0.7, 0], scale: [1, 1.25] }} transition={{ duration: 1, repeat: Infinity }} />
                  )}
                </button>

                <div className="w-11 shrink-0" />
              </div>
            )}
            {!micSupported && !typing && (
              <p className="text-center text-[11px] text-slate-400 mt-2">Voice input isn’t supported on this browser — tap the keyboard to type.</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Animated listening waveform ───────────────────────────────────────────── */
function Waveform() {
  return (
    <div className="flex items-center gap-1 h-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span key={i} className="w-1 rounded-full bg-white"
          animate={{ height: ['30%', '90%', '30%'] }}
          style={{ height: '30%' }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }} />
      ))}
    </div>
  );
}

/* ── Chat bubble + inline cards ────────────────────────────────────────────── */
function Bubble({ msg, onAction, onBook, nav }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
      <div className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed ${isUser
        ? 'bg-indigo-600 text-white rounded-2xl rounded-br-md'
        : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md shadow-sm'}`}>
        {msg.content}
      </div>

      {(msg.cards || []).map((c, i) => <Card key={i} card={c} nav={nav} />)}

      {(msg.actions || []).map((a, i) => (
        <button key={i} onClick={() => onAction(a)}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl active:scale-95 transition-transform">
          {a.label} <ChevronRight size={15} />
        </button>
      ))}
    </div>
  );
}

function money(n) { return n != null ? `₹${n}` : '—'; }
const STATUS_TEXT = {
  created: 'Placing…', searching: 'Finding a pro', assigned: 'Pro assigned',
  on_the_way: 'On the way', arrived: 'Arrived', in_progress: 'In progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

function Card({ card, nav }) {
  if (card.type === 'price') {
    return (
      <div className="w-[82%] rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
        <p className="text-[11px] font-black uppercase tracking-wider text-indigo-400">Estimate</p>
        <div className="flex items-end justify-between mt-1">
          <span className="text-2xl font-black text-slate-900">{money(card.totalRupees)}</span>
          {card.etaMinutes != null && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Clock size={13} /> ~{card.etaMinutes} min
            </span>
          )}
        </div>
        {card.surgeMultiplier > 1 && (
          <p className="text-[11px] text-amber-600 font-semibold mt-1">Live demand surcharge applied</p>
        )}
      </div>
    );
  }
  if (card.type === 'eta') {
    return (
      <div className="w-[82%] rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center"><MapPin size={17} className="text-emerald-600" /></div>
        <div>
          <p className="text-sm font-bold text-slate-900">{card.available} pro{card.available > 1 ? 's' : ''} nearby</p>
          <p className="text-xs text-slate-500">Nearest ~{card.nearestDistanceKm} km · ~{card.etaMinutes} min away</p>
        </div>
      </div>
    );
  }
  if (card.type === 'booking') {
    return (
      <div className="w-[82%] rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p className="font-black text-slate-900">Booking confirmed</p>
        </div>
        <p className="text-sm text-slate-600 mt-1 capitalize">{(card.service || '').replace(/_/g, ' ')}</p>
        <div className="flex items-center gap-3 mt-2 text-sm">
          <span className="font-black text-slate-900">{money(card.totalRupees)}</span>
          {card.otp && <span className="text-xs text-slate-500">OTP <b className="text-slate-800 tracking-widest">{card.otp}</b></span>}
        </div>
        {card.orderId && (
          <button onClick={() => nav(`/orders/${card.orderId}`)}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-emerald-600 py-2.5 rounded-xl active:scale-95 transition-transform">
            Track your pro <ChevronRight size={15} />
          </button>
        )}
      </div>
    );
  }
  if (card.type === 'tracking') {
    return (
      <button onClick={() => card.orderId && nav(`/orders/${card.orderId}`)}
        className="w-[82%] text-left rounded-2xl border border-slate-200 bg-white p-3.5 active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900 capitalize">{(card.service || '').replace(/_/g, ' ')}</span>
          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{STATUS_TEXT[card.status] || card.status}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          {card.workerName && <span>👷 {card.workerName}</span>}
          {card.etaMinutes != null && <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{card.etaMinutes} min</span>}
          {card.otp && <span>OTP <b className="text-slate-700">{card.otp}</b></span>}
        </div>
      </button>
    );
  }
  if (card.type === 'history') {
    return (
      <div className="w-[82%] rounded-2xl border border-slate-200 bg-white p-2 space-y-1">
        {card.orders.slice(0, 5).map((o) => (
          <button key={o.orderId} onClick={() => nav(`/orders/${o.orderId}`)}
            className="w-full text-left flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50">
            <span className="text-sm font-semibold text-slate-800 capitalize">{(o.service || '').replace(/_/g, ' ')}</span>
            <span className="text-xs text-slate-400">{money(o.totalRupees)} · {STATUS_TEXT[o.status] || o.status}</span>
          </button>
        ))}
      </div>
    );
  }
  if (card.type === 'wallet') {
    return (
      <div className="w-[82%] rounded-2xl border border-violet-100 bg-violet-50/60 p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center"><WalletIcon size={17} className="text-violet-600" /></div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-violet-400">Wallet</p>
          <p className="text-lg font-black text-slate-900 leading-none">{money(card.balanceRupees)}</p>
        </div>
      </div>
    );
  }
  return null;
}
