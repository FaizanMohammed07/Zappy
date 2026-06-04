import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, ChevronLeft, Loader2, PartyPopper, Sparkles } from 'lucide-react';
import { useRequestOtpMutation, useLoginEventPartnerMutation } from '../../services/api';
import { setAuth } from '../../modules/auth/authSlice';
import toast from 'react-hot-toast';

function OtpBox({ value, onChange, onKeyDown, inputRef, filled }) {
  return (
    <motion.input ref={inputRef} type="text" inputMode="numeric" maxLength={1}
      value={value} onChange={onChange} onKeyDown={onKeyDown}
      animate={filled ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.15 }}
      className="w-12 h-14 text-center text-xl font-black rounded-2xl border-2 outline-none bg-white text-slate-900 transition-colors"
      style={{ borderColor: filled ? '#7c3aed' : '#e2e8f0', boxShadow: filled ? '0 0 0 4px rgba(124,58,237,0.12)' : 'none' }}
    />
  );
}

export default function PartnerLoginPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  // steps: 'phone' → 'otp' → 'register' (new partners only)
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [isNew, setIsNew] = useState(false);
  const [regForm, setRegForm] = useState({ businessName: '', ownerName: '', cities: '' });
  const otpRefs = useRef([]);

  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation();
  const [loginPartner, { isLoading: logging }] = useLoginEventPartnerMutation();
  const otp = digits.join('');

  async function handleSendOtp(e) {
    e.preventDefault();
    if (phone.length < 10) return toast.error('Enter a valid phone number');
    try {
      const res = await requestOtp({ phone, role: 'event_partner' }).unwrap();
      setIsNew(!!res.isNewUser);
      setStep('otp');
      toast.success('OTP sent');
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (err) {
      toast.error(err?.data?.error || 'Failed to send OTP');
    }
  }

  async function handleVerify() {
    if (otp.length < 6) return toast.error('Enter all 6 digits');
    // New partner → collect business details first
    if (isNew && step === 'otp') { setStep('register'); return; }
    await doLogin();
  }

  async function doLogin(extra = {}) {
    try {
      const res = await loginPartner({ phone, otp, ...extra }).unwrap();
      dispatch(setAuth({
        accessToken: res.accessToken,
        role: 'event_partner',
        profile: { name: res.partner.businessName, phone: res.partner.phone, _id: res.partner._id },
      }));
      toast.success(res.isNew ? `Welcome to Zappy, ${res.partner.businessName}! 🎉` : `Welcome back, ${res.partner.businessName}!`);
      navigate('/partner', { replace: true });
    } catch (err) {
      toast.error(err?.data?.error || 'Invalid OTP');
      setDigits(['', '', '', '', '', '']);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regForm.businessName || !regForm.ownerName) return toast.error('Fill in all required fields');
    await doLogin(regForm);
  }

  function handleDigit(i, val) {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) setTimeout(() => otpRefs.current[i + 1]?.focus(), 0);
    if (next.every(d => d) && i === 5) setTimeout(handleVerify, 100);
  }
  function handleKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[[10, 20, 300, '#7c3aed'], [70, 60, 200, '#db2777'], [40, 80, 150, '#6d28d9']].map(([x, y, s, c], i) => (
          <motion.div key={i} className="absolute rounded-full blur-3xl opacity-20"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, background: c }}
            animate={{ x: [-20, 20, -20], y: [-15, 15, -15] }}
            transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <PartyPopper size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Zappy Partner</h1>
          <p className="text-sm text-white/60 mt-1">Event Decoration Partner Portal</p>
        </div>

        <AnimatePresence mode="wait">

          {/* Step 1: Phone */}
          {step === 'phone' && (
            <motion.form key="phone" onSubmit={handleSendOtp} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-2">YOUR PHONE NUMBER</label>
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 focus-within:border-violet-400 transition-all">
                  <Phone size={16} className="text-white/50" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter your phone number" autoFocus
                    className="flex-1 bg-transparent text-white placeholder:text-white/40 outline-none text-sm font-medium" />
                </div>
              </div>
              <button type="submit" disabled={sending || phone.length < 10}
                className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <><span>Get OTP</span><ArrowRight size={16} /></>}
              </button>
              <p className="text-center text-xs text-white/40">New? You'll be able to register after OTP verification</p>
            </motion.form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-xs text-white/60 hover:text-white/80">
                <ChevronLeft size={14} /> Change number
              </button>
              <div>
                <p className="text-xs font-semibold text-white/70 mb-1">ENTER 6-DIGIT OTP</p>
                <p className="text-xs text-white/50">Sent to +91 {phone}</p>
              </div>
              <div className="flex gap-2 justify-center">
                {digits.map((d, i) => (
                  <OtpBox key={i} value={d} filled={!!d}
                    inputRef={el => otpRefs.current[i] = el}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKey(i, e)} />
                ))}
              </div>
              <button onClick={handleVerify} disabled={otp.length < 6 || logging}
                className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all">
                {logging ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={14} /><span>{isNew ? 'Continue' : 'Enter Dashboard'}</span></>}
              </button>
            </motion.div>
          )}

          {/* Step 3: Register (new partners only) */}
          {step === 'register' && (
            <motion.form key="register" onSubmit={handleRegister} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div>
                <p className="text-sm font-bold text-white mb-0.5">Almost there! 🎉</p>
                <p className="text-xs text-white/60">Set up your partner account</p>
              </div>
              {[
                { k: 'businessName', label: 'Business Name *',     placeholder: 'e.g. Dream Decors Bangalore' },
                { k: 'ownerName',    label: 'Your Name *',          placeholder: 'e.g. Ravi Kumar' },
                { k: 'cities',       label: 'Cities you serve',     placeholder: 'bangalore, mumbai' },
              ].map(({ k, label, placeholder }) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-white/70 block mb-1.5">{label}</label>
                  <input value={regForm[k]} onChange={e => setRegForm(p => ({ ...p, [k]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/40 outline-none text-sm focus:border-violet-400 transition-all" />
                </div>
              ))}
              <button type="submit" disabled={logging || !regForm.businessName || !regForm.ownerName}
                className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all">
                {logging ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={14} /><span>Create Account & Enter</span></>}
              </button>
              <p className="text-center text-xs text-white/40">You can upload themes after KYC approval by Zappy team</p>
            </motion.form>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
