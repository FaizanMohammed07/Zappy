import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Phone, ArrowRight, ChevronLeft, CheckCircle2, Loader2, Zap, Shield, Star, Smartphone, Laptop, Car, Bike, PawPrint, HeartHandshake, Clock, Percent, Lock, Headset, Users, CalendarDays } from 'lucide-react';
import { useRequestOtpMutation, useLoginUserMutation, useUpdateMeMutation } from '../services/api';
import { CONSUMER_URL } from '../config/hosts';
import ResendOtp from '../components/auth/ResendOtp';
import { setAuth, updateProfile } from '../modules/auth/authSlice';
import { ZappyLogo } from '../components/common/ZappyLogo';
import toast from 'react-hot-toast';
import SEO, { LOGIN_SCHEMA, BASE_URL } from '../components/SEO';
import { easeSoft, springSnap, fadeInUp, staggerContainer } from '../lib/animations';
import useIsMobile from '../hooks/useIsMobile';

/* ─── Animated background orb ─────────────────────────────────────────── */
function Orb({ x, y, size, color, delay = 0 }) {
  return (
    <motion.div
      className="absolute rounded-full blur-3xl opacity-30 pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color }}
      animate={{ x: [-20, 20, -20], y: [-15, 15, -15], scale: [1, 1.15, 1] }}
      transition={{ duration: 8 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

/* ─── OTP digit box ────────────────────────────────────────────────────── */
function OtpInput({ value, onChange, onKeyDown, inputRef, filled }) {
  return (
    <motion.input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      animate={filled ? { scale: [1, 1.1, 1], borderColor: '#6366f1' } : { borderColor: '#e2e8f0' }}
      transition={{ duration: 0.18 }}
      className="w-12 h-14 text-center text-xl font-black rounded-2xl border-2 outline-none bg-white/80 backdrop-blur-sm text-slate-900 transition-all"
      style={{ borderColor: filled ? '#6366f1' : '#e2e8f0', boxShadow: filled ? '0 0 0 4px rgba(99,102,241,0.12)' : 'none' }}
    />
  );
}

export default function LoginPage() {
  const [phone, setPhone]       = useState('');
  const OTP_LEN = 6; // 2Factor plain AUTOGEN (no template) sends 6-digit SMS OTP
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LEN).fill(''));
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [step, setStep]         = useState('phone');
  const [otpMeta, setOtpMeta]   = useState({ cooldownSec: 30, resendsLeft: 3 });
  const [isNewUser, setIsNewUser] = useState(true);
  const [pendingProfile, setPendingProfile] = useState(null);
  const pendingOtp = useRef(null);
  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation();
  const [loginUser,  { isLoading: loggingUser }]   = useLoginUserMutation();
  const [updateMe,   { isLoading: savingProfile }]  = useUpdateMeMutation();
  const nav      = useNavigate();
  const loc      = useLocation();
  const dispatch = useDispatch();
  const isLoading = loggingUser;
  const otpRefs   = useRef([]);
  const isMobile = useIsMobile(1024);

  const otp = otpDigits.join('');

  // After OTP form mounts: fill digits from API response (dev auto-fill)
  useEffect(() => {
    if (step !== 'otp' || !pendingOtp.current) return;
    const code = String(pendingOtp.current);
    pendingOtp.current = null;
    const digits = code.slice(0, OTP_LEN).split('').concat(Array(Math.max(0, OTP_LEN - code.length)).fill(''));
    setOtpDigits(digits);
    setTimeout(() => otpRefs.current[OTP_LEN - 1]?.focus(), 80);
  }, [step]);

  // Auto-submit once all digits filled (existing users only — new users must enter name)
  useEffect(() => {
    if (step === 'otp' && otp.length === OTP_LEN && !isNewUser) verify();
  }, [otp]);

  // Mouse parallax for hero
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useTransform(mouseX, [0, window.innerWidth  || 400], [-8, 8]);
  const parallaxY = useTransform(mouseY, [0, window.innerHeight || 800], [-6, 6]);

  function handleMouseMove(e) {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  }

  function handleOtpChange(i, char) {
    const d = char.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[i] = d;
    setOtpDigits(next);
    if (d && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKey(i, e) {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      const next = [...otpDigits];
      next[i - 1] = '';
      setOtpDigits(next);
      otpRefs.current[i - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (text.length >= 4) {
      setOtpDigits(text.split('').concat(Array(Math.max(0, OTP_LEN - text.length)).fill('')));
      otpRefs.current[Math.min(text.length, OTP_LEN - 1)]?.focus();
    }
  }

  async function send() {
    if (!/^[0-9]{10,15}$/.test(phone)) { toast.error('Enter a valid phone number'); return; }
    try {
      const r = await requestOtp({ phone, role: 'user' }).unwrap();
      pendingOtp.current = r.otp || null;
      setIsNewUser(r.isNewUser ?? true);
      // Server-owned resend rules — never hardcode these client-side.
      setOtpMeta({ cooldownSec: r.cooldownSec ?? 30, resendsLeft: r.resendsLeft ?? 3 });
      setStep('otp');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to send OTP');
    }
  }

  // A resend issues a NEW code — clear the old digits so a stale one can't be submitted,
  // and auto-fill the fresh code in dev (prod never returns it).
  function handleResent(data) {
    setOtpDigits(Array(OTP_LEN).fill(''));
    if (data?.otp) {
      const code = String(data.otp).slice(0, OTP_LEN);
      setOtpDigits(code.split('').concat(Array(Math.max(0, OTP_LEN - code.length)).fill('')));
      setTimeout(() => otpRefs.current[OTP_LEN - 1]?.focus(), 80);
    } else {
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }
  }

  function startOver() {
    setOtpDigits(Array(OTP_LEN).fill(''));
    pendingOtp.current = null;
    setStep('phone');
  }

  async function verify() {
    try {
      const r = await loginUser({
        phone,
        otp,
        ...(name.trim() ? { name: name.trim() } : {}),
      }).unwrap();
      const profile = r.user;
      dispatch(setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, profile, role: 'user' }));
      if (!profile.name || !profile.email) {
        setPendingProfile(profile);
        setName(profile.name || '');
        setEmail(profile.email || '');
        setStep('complete');
        return;
      }
      nav(loc.state?.from || '/', { replace: true });
    } catch (err) {
      const detail = typeof err.data?.details?.[0] === 'string' ? err.data.details[0] : err.data?.error || 'Verification failed';
      toast.error(detail);
      console.error('[verify] status:', err.status, 'body:', err.data);
    }
  }

  async function saveProfileAndContinue() {
    const updates = {};
    if (!pendingProfile?.name && name.trim()) updates.name = name.trim();
    if (!pendingProfile?.email && email.trim()) updates.email = email.trim();
    if (Object.keys(updates).length) {
      try {
        await updateMe(updates).unwrap();
        dispatch(updateProfile(updates));
      } catch { /* non-fatal — continue anyway */ }
    }
    nav(loc.state?.from || '/', { replace: true });
  }


  if (isMobile) {
    return (
      <>
        <SEO
          title="Login to Zappy — Book Home Services Instantly"
          description="Login to Zappy with your phone number. Book verified professionals for home services instantly — puncture repair, phone repair, laptop repair and more."
          canonical={`${BASE_URL}/login`}
          keywords="Zappy login, book home services India, on-demand services app login"
          jsonLd={LOGIN_SCHEMA}
        />
        <div className="min-h-screen w-full flex flex-col font-sans bg-[#f8f9fc] relative overflow-hidden items-center">
          
          {/* Main Content Container matching Mobile Width */}
          <div className="w-full max-w-[430px] flex flex-col relative z-10 mx-auto min-h-screen bg-[#f4f7fa] overflow-hidden shadow-2xl pb-10">
            
            {/* Top Hero Section (Gradient Background + Content) */}
            <div className="relative pt-12 pb-[130px] px-6 flex flex-col bg-gradient-to-b from-[#e8f0fe] to-[#f4f7fa]">
               {/* Logo */}
               <div className="flex items-center gap-2 mb-8 relative z-10">
                 <img src="/logo.png" alt="Zappy Logo" className="h-7 w-auto" />
                 <div className="flex flex-col">
                   <span className="text-[17px] font-bold text-[#031542] leading-none tracking-tight">Zappy<span className="text-[#0d5cf3]">one</span></span>
                   <span className="text-[9px] text-slate-500 font-medium tracking-wide">One Platform, Every Service</span>
                 </div>
               </div>

               {/* Hero Text */}
               <div className="relative z-10 max-w-[240px]">
                 <h1 className="text-[32px] font-extrabold text-[#031542] leading-[1.15] tracking-tight mb-3">
                   Everything<br />you need,<br />
                   <span className="text-[#0d5cf3]">Just a tap away!</span>
                 </h1>
                 <p className="text-[14px] text-slate-600 font-medium leading-relaxed pr-4">
                   Book trusted professionals for every service, anytime, anywhere.
                 </p>
               </div>

               {/* Hero Illustration */}
               <img src="/images/hero_couch_man.png" alt="Hero" className="absolute -right-8 top-16 h-[260px] object-contain drop-shadow-xl z-0 pointer-events-none" />
            </div>

            {/* Feature Cards Section (Overlapping) */}
            <div className="px-5 -mt-24 relative z-20 mb-6">
               <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex justify-between items-start">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#0d5cf3]">
                      <Shield size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-center text-slate-700 leading-tight px-1">Verified<br/>Professionals</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#0d5cf3]">
                      <Clock size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-center text-slate-700 leading-tight px-1">On-time<br/>Service</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#0d5cf3]">
                      <Percent size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-center text-slate-700 leading-tight px-1">Best<br/>Prices</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#0d5cf3]">
                      <Lock size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-center text-slate-700 leading-tight px-1">Secure &<br/>Safe</span>
                  </div>
               </div>
               
               {/* Indicator Pill */}
               <div className="flex justify-center mt-4">
                 <div className="flex gap-1">
                   <div className="w-4 h-1.5 rounded-full bg-[#0d5cf3]"></div>
                   <div className="w-8 h-1.5 rounded-full bg-slate-200"></div>
                 </div>
               </div>
            </div>

            {/* Login Card */}
            <div className="bg-white flex-1 mx-4 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] px-6 pt-8 pb-10 flex flex-col z-20">
               
               {/* Header */}
               <div className="flex flex-col items-center mb-8">
                 <h2 className="text-[22px] font-extrabold text-[#031542] mb-1.5 tracking-tight">Welcome to Zappy</h2>
                 <div className="flex items-center gap-1.5 mb-2">
                   <div className="w-6 h-1 rounded-full bg-[#0d5cf3]"></div>
                   <div className="w-1.5 h-1.5 rounded-full bg-[#0d5cf3]"></div>
                 </div>
                 <p className="text-[13px] font-medium text-slate-500">Log in to continue</p>
               </div>

               {/* Single Login Tab */}
               <div className="flex mb-6">
                 <div className="w-full py-3.5 bg-white border border-[#0d5cf3]/20 shadow-[0_2px_8px_rgba(13,92,243,0.08)] rounded-xl flex justify-center items-center relative overflow-hidden">
                   <span className="text-[14px] font-bold text-[#0d5cf3]">Login</span>
                   <div className="absolute bottom-0 left-3 right-3 h-[3px] rounded-t-full bg-[#0d5cf3]"></div>
                 </div>
               </div>

               <AnimatePresence mode="wait">
                {step === 'phone' ? (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full flex flex-col"
                  >
                    {/* Phone Input */}
                    <div className="mb-6">
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:border-[#0d5cf3] focus-within:ring-1 focus-within:ring-[#0d5cf3] transition-all bg-white h-[52px]">
                        <div className="flex items-center justify-center px-4 bg-white border-r border-slate-200 text-slate-800 font-semibold gap-1.5 cursor-pointer">
                          +91
                          <ChevronLeft size={14} className="-rotate-90 text-slate-500" strokeWidth={3} />
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          className="w-full h-full px-4 outline-none text-slate-900 font-medium placeholder-slate-400 bg-transparent text-[14px]"
                          placeholder="Enter your phone number"
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          onKeyDown={e => e.key === 'Enter' && send()}
                        />
                      </div>
                    </div>

                    <button
                      onClick={send}
                      disabled={sending || phone.length < 10}
                      className="w-full h-[52px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-8 relative"
                    >
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <span>Continue</span>}
                      {!sending && <ArrowRight size={18} className="absolute right-4" />}
                    </button>

                    {/* Safe Data Card */}
                    <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-4 flex items-start gap-3 mb-8">
                      <div className="w-8 h-8 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-[#0d5cf3] shrink-0 border border-slate-100">
                        <Shield size={16} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col pt-0.5">
                        <span className="text-[12px] font-bold text-slate-800 mb-0.5">Your data is safe with us.</span>
                        <span className="text-[11px] font-medium text-slate-500">We never share your information with anyone.</span>
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className="flex justify-between items-center border-t border-slate-100 pt-6 mt-auto">
                      <div className="flex items-center gap-1.5">
                        <Users size={18} className="text-[#0d5cf3]" strokeWidth={2.5} />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-extrabold text-[#0d5cf3] leading-none mb-1">10M+</span>
                          <span className="text-[8px] font-bold text-slate-500 leading-none">Happy Users</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={18} className="text-[#0d5cf3]" strokeWidth={2.5} />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-extrabold text-[#0d5cf3] leading-none mb-1">50M+</span>
                          <span className="text-[8px] font-bold text-slate-500 leading-none">Services Booked</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star size={18} className="text-[#0d5cf3]" strokeWidth={2.5} />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-extrabold text-[#0d5cf3] leading-none mb-1">4.8/5</span>
                          <span className="text-[8px] font-bold text-slate-500 leading-none">User Rating</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Headset size={18} className="text-[#0d5cf3]" strokeWidth={2.5} />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-extrabold text-[#0d5cf3] leading-none mb-1">24x7</span>
                          <span className="text-[8px] font-bold text-slate-500 leading-none">Support</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : step === 'otp' ? (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full flex flex-col"
                  >
                    <p className="text-center text-sm text-slate-500 mb-8 font-medium">Enter the 6-digit code sent to +91 {phone}</p>

                    <div className="flex justify-between gap-1 sm:gap-2 mb-8" onPaste={handleOtpPaste}>
                      {otpDigits.map((d, i) => (
                        <input
                          key={i}
                          ref={el => otpRefs.current[i] = el}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKey(i, e)}
                          className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-[22px] font-bold rounded-xl border outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${d ? 'border-[#0d5cf3] ring-1 ring-[#0d5cf3] text-slate-900 bg-blue-50/30' : 'border-slate-300 focus:border-[#0d5cf3] text-slate-900 bg-white'}`}
                        />
                      ))}
                    </div>

                    <div className="flex flex-col gap-4 mb-8">
                      <div className="flex items-center justify-between w-full">
                        <ResendOtp
                          phone={phone}
                          cooldownSec={otpMeta.cooldownSec}
                          resendsLeft={otpMeta.resendsLeft}
                          onResent={handleResent}
                          onStartOver={startOver}
                        />
                        <button
                          onClick={startOver}
                          className="text-[13px] text-[#0d5cf3] hover:underline font-semibold"
                        >
                          Change number
                        </button>
                      </div>
                    </div>

                    {isNewUser && (
                      <div className="space-y-5 mb-8">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Name</label>
                          <input
                            type="text"
                            className="w-full h-[52px] px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                            placeholder="e.g. Priya Sharma"
                            value={name}
                            onChange={e => setName(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={verify}
                      disabled={isLoading || otp.length < 4}
                      className="w-full h-[52px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                    >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                      Verify & Continue
                    </button>
                  </motion.div>
                ) : step === 'complete' ? (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
                  >
                    <p className="text-center text-sm text-slate-500 mb-8 font-medium">Complete your profile to continue.</p>

                    <div className="space-y-5 mb-8">
                      {!pendingProfile?.name && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Name</label>
                          <input
                            type="text"
                            className="w-full h-[52px] px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                            placeholder="e.g. Priya Sharma"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email <span className="text-slate-400 font-medium normal-case">(for receipts)</span></label>
                        <input
                          type="email"
                          inputMode="email"
                          className="w-full h-[52px] px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                          placeholder="you@example.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveProfileAndContinue()}
                          autoFocus={!!pendingProfile?.name}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={saveProfileAndContinue}
                        disabled={savingProfile || (!pendingProfile?.name && !name.trim())}
                        className="w-full h-[52px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingProfile ? <Loader2 size={18} className="animate-spin" /> : null}
                        Continue
                      </button>
                      <button
                        onClick={() => nav(loc.state?.from || '/', { replace: true })}
                        className="w-full py-3 text-center text-sm text-slate-500 hover:text-slate-700 font-semibold transition-colors"
                      >
                        Skip for now
                      </button>
                    </div>
                  </motion.div>
                ) : null}
               </AnimatePresence>

            </div>
          </div>
        </div>
      </>
    );
  }

  // DESKTOP UI
  return (
    <>
      <SEO
        title="Login to Zappy — Book Home Services Instantly"
        description="Login to Zappy with your phone number. Book verified professionals for home services instantly — puncture repair, phone repair, laptop repair and more."
        canonical={`${BASE_URL}/login`}
        keywords="Zappy login, book home services India, on-demand services app login"
        jsonLd={LOGIN_SCHEMA}
      />
      <div className="h-screen w-full flex font-sans bg-white relative overflow-hidden">

        {/* LEFT PANEL - Branding (Desktop only) */}
        <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative flex-col overflow-hidden bg-[#031542]">

          {/* Abstract wavy lines background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <div className="w-[800px] h-[800px] rounded-full border border-white/5 absolute -top-[10%] -left-[20%]"></div>
            <div className="w-[1000px] h-[1000px] rounded-full border border-white/5 absolute -top-[20%] -left-[30%]"></div>
            <div className="w-[1200px] h-[1200px] rounded-full border border-white/5 absolute -top-[30%] -left-[40%]"></div>
            <div className="w-[1400px] h-[1400px] rounded-full border border-white/5 absolute -top-[40%] -left-[50%]"></div>
          </div>
          {/* Dot grid */}
          <div className="absolute top-12 left-12 grid grid-cols-4 gap-2 opacity-20 pointer-events-none">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1 h-1 bg-white rounded-full"></div>
            ))}
          </div>

          <div className="relative z-10 px-8 xl:px-12 h-full flex-1 flex flex-col justify-center">
            <div className="flex flex-row items-center justify-between w-full h-full max-h-[600px] gap-6 xl:gap-8">

              <div className="flex flex-col flex-1 shrink-0 max-w-[50%]">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-10 xl:mb-12">
                  <img src="/logo.png" alt="Zappy Logo" className="h-10 xl:h-12 w-auto" />
                </div>

                {/* Text */}
                <h1 className="text-[38px] xl:text-[46px] font-bold text-white leading-[1.1] tracking-tight mb-4">
                  Instant help,<br />
                  anywhere, <br /><span className="text-[#3b82f6]">anytime.</span>
                </h1>
                <p className="text-white/80 text-[15px] xl:text-[17px] font-medium leading-relaxed">
                  One platform for every Services.
                </p>
              </div>

              {/* App Preview Image Container */}
              <div className="relative flex justify-end shrink-0">
                <div className="w-[280px] xl:w-[320px] h-[560px] xl:h-[600px] bg-[#0f172a] rounded-[48px] border-[10px] border-[#0f172a] shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-20">
                    <div className="w-28 h-6 bg-[#0f172a] rounded-b-3xl"></div>
                  </div>
                  {/* Screen Content */}
                  <div className="flex-1 bg-slate-50 flex flex-col relative z-10 w-full h-full overflow-hidden rounded-[38px]">
                    {/* Status bar */}
                    <div className="h-12 bg-[#031542] w-full flex justify-between items-end px-6 pb-2 text-[11px] text-white font-medium">
                      <span>9:31</span>
                      <div className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                      </div>
                    </div>
                    {/* Header */}
                    <div className="bg-[#031542] px-5 pb-5 pt-1 rounded-b-[24px]">
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-1.5">
                          <img src="/logo.png" alt="Zappy Logo" className="h-4 w-auto" />
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-white/90 text-xs mb-4 font-medium">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        Hyderabad, Telangana <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <div className="bg-white rounded-xl h-10 px-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span className="text-slate-400 text-sm font-medium">Search services...</span>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-4 flex-1">
                      <div className="bg-[#eff4ff] rounded-2xl p-4 flex justify-between items-center mb-6 relative overflow-hidden">
                        <div className="relative z-10">
                          <h3 className="font-bold text-slate-800 text-[13px] leading-snug mb-1">Trusted professionals,<br />on time, every time.</h3>
                          <p className="text-[10px] text-slate-500 mb-3 font-medium">Book any service in<br />just a few taps.</p>
                          <div className="bg-[#0052cc] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg inline-block">Book Now</div>
                        </div>
                        <div className="w-[72px] h-[90px] bg-[#dbeafe] rounded-t-full rounded-b-xl absolute bottom-0 right-4"></div>
                      </div>

                      <div className="flex justify-between items-center mb-3 px-1">
                        <span className="font-bold text-slate-800 text-[13px]">Popular Services</span>
                        <span className="text-[#0052cc] text-xs font-semibold">See all</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'Bike Services', path: 'M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.5-1.77 4.9-4h4.2c.4 2.23 2.44 4 4.9 4 2.8 0 5-2.2 5-5 0-2.12-1.32-3.93-3.16-4.64zM8.5 17C7.12 17 6 15.88 6 14.5S7.12 12 8.5 12s2.5 1.12 2.5 2.5S9.88 17 8.5 17zm7 0c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
                          { name: 'Car Services', path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' },
                          { name: 'Phone & Laptops', path: 'M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z' },
                          { name: 'Pets & Elders', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' }
                        ].map(s => (
                          <div key={s.name} className="bg-white rounded-[14px] p-3 flex flex-col items-center justify-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] gap-2 h-[84px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#0052cc]"><path d={s.path} /></svg>
                            <span className="text-[11px] font-semibold text-slate-600 tracking-tight text-center leading-tight">{s.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - FORM */}
        <div className="w-full lg:w-[55%] xl:w-[50%] flex flex-col items-center justify-center min-h-screen relative bg-[#f4f7fa] lg:bg-white z-0 p-4 sm:p-6">

          {/* Decorative corner circles (Mobile / tablet only) */}
          <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-[#e8f0fe] rounded-bl-[100%] pointer-events-none lg:hidden"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-[#e8f0fe] rounded-tr-[100%] pointer-events-none lg:hidden"></div>

          {/* Dot grid pattern top left (Mobile only) */}
          <div className="absolute top-8 left-8 grid grid-cols-4 gap-2 opacity-[0.15] lg:hidden">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            ))}
          </div>

          {/* Top Right Language Selector (Desktop) */}
          <div className="absolute top-6 right-8 hidden lg:flex items-center gap-1.5 text-slate-600 text-[13px] font-semibold cursor-pointer hover:bg-slate-50 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-slate-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            English
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>

          {/* Form Card */}
          <div className="w-full max-w-[440px] bg-white lg:bg-transparent lg:shadow-none rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:border-none border border-slate-100 p-8 sm:p-10 relative z-10 flex flex-col">

            <div className="flex flex-col items-center mb-8">
              {/* Logo inside card (Mobile) */}
              <div className="lg:hidden flex items-center gap-2.5 mb-8">
                <img src="/logo.png" alt="Zappy Logo" className="h-9 w-auto" />
              </div>

              <h2 className="text-[28px] font-bold text-[#031542] mb-1.5 tracking-tight">Welcome to Zappy</h2>
              <p className="text-slate-500 font-medium text-[15px]">Log in to connect with us!</p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'phone' ? (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full flex flex-col"
                >
                  {/* Space instead of Google/Apple (Desktop) */}
                  <div className="hidden lg:block h-4"></div>

                  {/* Phone Input */}
                  <div className="mb-6">
                    <div className="flex rounded-xl overflow-hidden border border-slate-300 focus-within:border-[#0d5cf3] focus-within:ring-1 focus-within:ring-[#0d5cf3] transition-all bg-white">
                      <div className="flex items-center justify-center px-4 bg-white border-r border-slate-200 text-slate-700 font-semibold gap-1.5 cursor-pointer hover:bg-slate-50">
                        +91
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        className="w-full py-[15px] px-4 outline-none text-slate-900 font-medium placeholder-slate-400 bg-transparent text-[15px]"
                        placeholder="Enter your phone number"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    onClick={send}
                    disabled={sending || phone.length < 10}
                    className="w-full py-[14px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : null}
                    Continue
                  </button>

                  {/* No extra social buttons here */}
                </motion.div>
              ) : step === 'otp' ? (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <p className="text-center text-sm text-slate-500 mb-8 font-medium">Enter the 6-digit code sent to +91 {phone}</p>

                  <div className="flex justify-between gap-1 sm:gap-2 mb-8" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => otpRefs.current[i] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKey(i, e)}
                        className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-[22px] font-bold rounded-xl border outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${d ? 'border-[#0d5cf3] ring-1 ring-[#0d5cf3] text-slate-900 bg-blue-50/30' : 'border-slate-300 focus:border-[#0d5cf3] text-slate-900 bg-white'}`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-4 mb-8">
                    <div className="flex items-center justify-between w-full">
                      <ResendOtp
                        phone={phone}
                        cooldownSec={otpMeta.cooldownSec}
                        resendsLeft={otpMeta.resendsLeft}
                        onResent={handleResent}
                        onStartOver={startOver}
                      />
                      <button
                        onClick={startOver}
                        className="text-[13px] text-[#0d5cf3] hover:underline font-semibold"
                      >
                        Change number
                      </button>
                    </div>
                  </div>

                  {isNewUser && (
                    <div className="space-y-5 mb-8">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Name</label>
                        <input
                          type="text"
                          className="w-full py-3.5 px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                          placeholder="e.g. Priya Sharma"
                          value={name}
                          onChange={e => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={verify}
                    disabled={isLoading || otp.length < 4}
                    className="w-full py-[14px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                    Verify & Continue
                  </button>
                </motion.div>
              ) : step === 'complete' ? (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <p className="text-center text-sm text-slate-500 mb-8 font-medium">Complete your profile to continue.</p>

                  <div className="space-y-5 mb-8">
                    {!pendingProfile?.name && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Name</label>
                        <input
                          type="text"
                          className="w-full py-3.5 px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                          placeholder="e.g. Priya Sharma"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email <span className="text-slate-400 font-medium normal-case">(for receipts)</span></label>
                      <input
                        type="email"
                        inputMode="email"
                        className="w-full py-3.5 px-4 rounded-xl border border-slate-300 focus:border-[#0d5cf3] focus:ring-1 focus:ring-[#0d5cf3] outline-none text-slate-900 font-medium bg-white transition-all shadow-sm"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveProfileAndContinue()}
                        autoFocus={!!pendingProfile?.name}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={saveProfileAndContinue}
                      disabled={savingProfile || (!pendingProfile?.name && !name.trim())}
                      className="w-full py-[14px] rounded-xl bg-[#0d5cf3] hover:bg-[#0047b3] text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingProfile ? <Loader2 size={18} className="animate-spin" /> : null}
                      Continue
                    </button>
                    <button
                      onClick={() => nav(loc.state?.from || '/', { replace: true })}
                      className="w-full py-3 text-center text-sm text-slate-500 hover:text-slate-700 font-semibold transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>



            {/* Data safe text (Desktop only or shown on mobile as well in reference? Reference shows it on Desktop) */}
            <div className="mt-auto pt-16 flex flex-col items-center justify-center text-center gap-1.5 hidden lg:flex">
              <div className="flex items-center gap-2 text-slate-700 text-[13px] font-bold">
                <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center">
                  <Shield size={16} className="text-[#0d5cf3]" />
                </div>
                Your data is safe with us.
              </div>
              <p className="text-slate-500 text-xs font-medium ml-10">We never share your information.</p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
