import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Phone, ArrowRight, ChevronLeft, CheckCircle2, Loader2, Zap, Shield, Star } from 'lucide-react';
import { useRequestOtpMutation, useLoginUserMutation, useLoginWorkerMutation } from '../services/api';
import { setAuth } from '../modules/auth/authSlice';
import { ZappyLogo } from '../components/common/ZappyLogo';
import toast from 'react-hot-toast';
import { easeSoft, springSnap, fadeInUp, staggerContainer } from '../lib/animations';

const SKILLS = [
  'puncture','plumbing','electrical','helper','carpenter','ac_repair',
  'screen_replacement','battery_replacement','mason','bike_wash','car_wash',
];
const SKILL_LABELS = {
  puncture: 'Puncture', plumbing: 'Plumbing', electrical: 'Electrical',
  helper: 'Helper', carpenter: 'Carpenter', ac_repair: 'AC Repair',
  screen_replacement: 'Screen Fix', battery_replacement: 'Battery',
  mason: 'Mason', bike_wash: 'Bike Wash', car_wash: 'Car Wash',
};

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

export default function LoginPage({ role = 'user' }) {
  const [phone, setPhone]       = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [name, setName]         = useState('');
  const [skills, setSkills]     = useState([]);
  const [step, setStep]         = useState('phone');
  const [isNewUser, setIsNewUser] = useState(true);
  const pendingOtp = useRef(null);
  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation();
  const [loginUser,  { isLoading: loggingUser }]   = useLoginUserMutation();
  const [loginWorker, { isLoading: loggingWorker }] = useLoginWorkerMutation();
  const nav      = useNavigate();
  const loc      = useLocation();
  const dispatch = useDispatch();
  const isLoading = loggingUser || loggingWorker;
  const otpRefs   = useRef([]);

  const otp = otpDigits.join('');

  // After OTP form mounts: fill digits from API response
  useEffect(() => {
    if (step !== 'otp' || !pendingOtp.current) return;
    const code = String(pendingOtp.current);
    pendingOtp.current = null;
    const digits = code.slice(0, 6).split('').concat(Array(Math.max(0, 6 - code.length)).fill(''));
    setOtpDigits(digits);
    setTimeout(() => otpRefs.current[5]?.focus(), 80);
  }, [step]);

  // Auto-submit once all 6 digits filled (existing users only — new users must enter name)
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !isNewUser) verify();
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
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
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
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length >= 4) {
      setOtpDigits(text.slice(0, 6).split('').concat(Array(Math.max(0, 6 - text.length)).fill('')));
      otpRefs.current[Math.min(text.length, 5)]?.focus();
    }
  }

  async function send() {
    if (!/^[0-9]{10,15}$/.test(phone)) { toast.error('Enter a valid phone number'); return; }
    try {
      const r = await requestOtp({ phone, role }).unwrap();
      pendingOtp.current = r.otp || null;
      setIsNewUser(r.isNewUser ?? true);
      setStep('otp');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to send OTP');
    }
  }

  async function verify() {
    try {
      const fn = role === 'worker' ? loginWorker : loginUser;
      const r = await fn({ phone, otp, name, skills }).unwrap();
      const profile = role === 'worker' ? r.worker : r.user;
      dispatch(setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, profile, role }));
      nav(loc.state?.from || (role === 'worker' ? '/worker' : '/'), { replace: true });
    } catch (err) {
      toast.error(err.data?.error || 'Verification failed');
    }
  }

  const isWorker = role === 'worker';

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      onMouseMove={handleMouseMove}
      style={{ background: isWorker
        ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)'
        : 'linear-gradient(135deg, #0f172a 0%, #1a237e 40%, #0d47a1 100%)'
      }}
    >
      {/* Background orbs */}
      <Orb x={-10} y={-5}  size={400} color={isWorker ? '#7c3aed' : '#4f46e5'} delay={0} />
      <Orb x={70}  y={60}  size={300} color={isWorker ? '#db2777' : '#0ea5e9'} delay={2} />
      <Orb x={50}  y={-10} size={250} color="#6366f1"  delay={4} />
      <Orb x={-5}  y={70}  size={200} color={isWorker ? '#f59e0b' : '#06b6d4'} delay={1} />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Hero section */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-6 relative z-10"
        style={{ x: parallaxX, y: parallaxY }}
      >
        <motion.div
          className="flex flex-col items-center gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Logo */}
          <motion.div variants={fadeInUp}>
            <motion.div
              className="w-20 h-20 rounded-[24px] flex items-center justify-center relative"
              style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)' }}
              animate={{ boxShadow: ['0 0 0 0px rgba(99,102,241,0.3)', '0 0 0 16px rgba(99,102,241,0)', '0 0 0 0px rgba(99,102,241,0)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              whileHover={{ scale: 1.05 }}
            >
              <ZappyLogo size={48} />
            </motion.div>
          </motion.div>

          <motion.div className="text-center" variants={fadeInUp}>
            <h1 className="text-4xl font-black text-white tracking-tight">Zappy</h1>
            <p className="text-white/60 text-sm font-medium mt-1">
              {isWorker ? 'Partner Portal — Earn on your schedule' : 'Instant help, at your doorstep'}
            </p>
          </motion.div>

          {/* Trust badges */}
          <motion.div className="flex gap-3 mt-1" variants={fadeInUp}>
            {[
              { Icon: Zap,    label: 'Fast',     color: 'text-amber-400' },
              { Icon: Shield, label: 'Verified', color: 'text-green-400' },
              { Icon: Star,   label: 'Trusted',  color: 'text-blue-400'  },
            ].map(({ Icon, label, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Icon size={11} className={color} />
                <span className="text-white/80 text-[11px] font-semibold">{label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Form card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.38, ease: easeSoft }}
          className="relative z-10"
          style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: '28px 28px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          }}
        >
          <div className="max-w-sm mx-auto px-6 pt-7 pb-12 space-y-5">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />

            {step === 'phone' ? (
              <motion.div
                className="space-y-5"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={fadeInUp}>
                  <h2 className="text-xl font-black text-slate-900">
                    {isWorker ? 'Sign in as Partner' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Enter your mobile number to continue</p>
                </motion.div>

                <motion.div variants={fadeInUp}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pr-3 border-r border-slate-200">
                      <Phone size={14} className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-600">+91</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      className="w-full pl-[72px] pr-4 py-3.5 text-base font-bold text-slate-900 rounded-2xl border-2 border-slate-100 bg-slate-50 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      onKeyDown={e => e.key === 'Enter' && send()}
                      autoFocus
                    />
                  </div>
                </motion.div>

                <motion.button
                  variants={fadeInUp}
                  onClick={send}
                  disabled={sending || phone.length < 10}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                  style={{ background: isWorker ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)', boxShadow: isWorker ? '0 8px 24px rgba(124,58,237,0.35)' : '0 8px 24px rgba(79,70,229,0.35)' }}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {sending ? 'Sending OTP…' : 'Get OTP'}
                </motion.button>

                {/* Event Management Partner entry point */}
                <motion.div variants={fadeInUp}>
                  <Link to="/partner/login"
                    className="flex items-center justify-between w-full px-4 py-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🎉</span>
                      <div>
                        <p className="text-xs font-black text-violet-700">Event Management Partner</p>
                        <p className="text-[10px] text-violet-400 font-medium">Decorators &amp; event partners</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-violet-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </motion.div>

                <motion.p variants={fadeInUp} className="text-center text-xs text-slate-400">
                  {isWorker ? (
                    <>Customer?{' '}<Link to="/login" className="text-indigo-600 font-bold hover:underline">Login here</Link></>
                  ) : (
                    <>Service worker?{' '}<Link to="/worker/login" className="text-indigo-600 font-bold hover:underline">Worker login</Link></>
                  )}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                className="space-y-5"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {/* Back button + header */}
                <motion.div variants={fadeInUp} className="flex items-center gap-3">
                  <motion.button
                    onClick={() => setStep('phone')}
                    whileTap={{ scale: 0.92 }}
                    className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
                  >
                    <ChevronLeft size={18} strokeWidth={2.5} className="text-slate-600" />
                  </motion.button>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Enter OTP</h2>
                    <p className="text-xs text-slate-400 font-medium">Sent to +91 {phone}</p>
                  </div>
                </motion.div>

                {/* OTP boxes */}
                <motion.div variants={fadeInUp}>
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <OtpInput
                        key={i}
                        inputRef={el => otpRefs.current[i] = el}
                        value={d}
                        filled={!!d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKey(i, e)}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Name (new user) */}
                {isNewUser && (
                  <motion.div variants={fadeInUp}>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Your Name</label>
                    <input
                      className="w-full px-4 py-3.5 text-sm font-bold text-slate-900 rounded-2xl border-2 border-slate-100 bg-slate-50 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10"
                      placeholder="e.g. Priya Sharma"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </motion.div>
                )}

                {/* Worker skills */}
                {isNewUser && isWorker && (
                  <motion.div variants={fadeInUp}>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Your Skills</label>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS.map(s => {
                        const on = skills.includes(s);
                        return (
                          <motion.button
                            key={s}
                            type="button"
                            onClick={() => setSkills(p => on ? p.filter(x => x !== s) : [...p, s])}
                            whileTap={{ scale: 0.92 }}
                            animate={on ? { scale: 1 } : { scale: 1 }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              on
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {on && <CheckCircle2 size={10} />}
                            {SKILL_LABELS[s]}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* CTA */}
                <motion.button
                  variants={fadeInUp}
                  onClick={verify}
                  disabled={isLoading || otp.length < 4}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                  style={{ background: isWorker ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)', boxShadow: isWorker ? '0 8px 24px rgba(124,58,237,0.35)' : '0 8px 24px rgba(79,70,229,0.35)' }}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {isLoading ? 'Verifying…' : 'Confirm & Continue'}
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
