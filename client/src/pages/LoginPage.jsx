import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Phone, ArrowRight, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useRequestOtpMutation, useLoginUserMutation, useLoginWorkerMutation } from '../services/api';
import { setAuth } from '../modules/auth/authSlice';
import { ZappyLogo } from '../components/common/ZappyLogo';
import toast from 'react-hot-toast';

const SKILLS = ['puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair'];
const SKILL_LABELS = {
  puncture: 'Puncture Repair', plumbing: 'Plumbing', electrical: 'Electrical',
  helper: 'Helper', carpenter: 'Carpenter', ac_repair: 'AC Repair',
};

export default function LoginPage({ role = 'user' }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [skills, setSkills] = useState([]);
  const [step, setStep] = useState('phone');
  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation();
  const [loginUser, { isLoading: loggingUser }] = useLoginUserMutation();
  const [loginWorker, { isLoading: loggingWorker }] = useLoginWorkerMutation();
  const nav = useNavigate();
  const loc = useLocation();
  const dispatch = useDispatch();
  const isLoading = loggingUser || loggingWorker;

  async function send() {
    if (!/^[0-9]{10,15}$/.test(phone)) {
      toast.error('Enter a valid phone number');
      return;
    }
    try {
      const r = await requestOtp({ phone }).unwrap();
      if (r.otp) setOtp(r.otp);
      setStep('otp');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to send OTP');
    }
  }

  async function verify() {
    try {
      const fn = role === 'worker' ? loginWorker : loginUser;
      const payload = role === 'worker' ? { phone, otp, name, skills } : { phone, otp, name };
      const r = await fn(payload).unwrap();
      const profile = role === 'worker' ? r.worker : r.user;
      dispatch(setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, profile, role }));
      const next = loc.state?.from || (role === 'worker' ? '/worker' : '/');
      nav(next, { replace: true });
    } catch (err) {
      toast.error(err.data?.error || 'Verification failed');
    }
  }

  function toggleSkill(s) {
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zappy-gradient">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-[22px] bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <ZappyLogo size={52} />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight text-center">Zappy</h1>
            <p className="text-white/70 text-sm font-medium text-center mt-1">
              {role === 'worker' ? 'Partner Portal' : 'Instant help, at your door'}
            </p>
          </div>
        </div>

        <div className="mt-8 w-full max-w-xs grid grid-cols-3 gap-2 text-center">
          {['Verified', 'Fast', 'Trusted'].map((label) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl py-2.5 px-2">
              <p className="text-white text-xs font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-t-[28px] px-6 pt-7 pb-10 shadow-soft-lg">
        <div className="max-w-sm mx-auto space-y-6">
          {step === 'phone' ? (
            <>
              <div>
                <h2 className="h-card">
                  {role === 'worker' ? 'Sign in as Partner' : 'Welcome back'}
                </h2>
                <p className="t-muted mt-1">Enter your mobile number to continue</p>
              </div>

              <div>
                <label className="input-label">Mobile Number</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pr-3 border-r border-slate-200">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    className="input pl-20"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    autoFocus
                  />
                </div>
              </div>

              <button onClick={send} disabled={sending || phone.length < 10} className="btn-primary w-full">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {sending ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('phone')} className="back-btn">
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div>
                  <h2 className="h-card">Verify your number</h2>
                  <p className="t-muted">OTP sent to +91 {phone}</p>
                </div>
              </div>

              <div>
                <label className="input-label">Enter OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input tracking-[0.5em] text-center text-xl font-bold"
                  placeholder="------"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                />
              </div>

              <div>
                <label className="input-label">Your Name (first time only)</label>
                <input
                  className="input"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {role === 'worker' && (
                <div>
                  <label className="input-label">Your Skills</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SKILLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className={`chip transition-all ${
                          skills.includes(s)
                            ? 'bg-zappy-600 text-white ring-2 ring-zappy-600/20'
                            : 'chip-neutral hover:bg-slate-200'
                        }`}
                      >
                        {skills.includes(s) && <CheckCircle2 size={10} />}
                        {SKILL_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={verify} disabled={isLoading || otp.length < 4} className="btn-primary w-full">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isLoading ? 'Verifying…' : 'Confirm & Continue'}
              </button>
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            {role === 'worker' ? (
              <>Looking for help?{' '}
                <Link to="/login" className="text-zappy-600 font-semibold">Customer login</Link>
              </>
            ) : (
              <>Want to earn with us?{' '}
                <Link to="/worker/login" className="text-zappy-600 font-semibold">Partner login</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
