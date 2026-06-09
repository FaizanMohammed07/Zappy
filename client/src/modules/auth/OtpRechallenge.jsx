/**
 * OtpRechallenge — modal that appears when the server returns 403 OTP_REQUIRED.
 * The user enters a 6-digit OTP (after requesting one via the normal OTP flow),
 * which calls POST /auth/otp/verify-action and sets a 10-minute Redis window.
 * The original action can then be retried by the caller.
 *
 * Usage: wrap any sensitive action with the useOtpRechallenge hook.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Loader2, KeyRound } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAuth } from './authSlice';
import {
  useRequestOtpMutation,
  useVerifySensitiveOtpMutation,
} from '../../services/api';
import toast from 'react-hot-toast';

export default function OtpRechallenge({ onSuccess, onCancel }) {
  const { profile } = useSelector(selectAuth);
  const phone = profile?.phone;

  const [step,   setStep]   = useState('request'); // 'request' | 'verify'
  const [otp,    setOtp]    = useState('');
  const [requestOtp,  { isLoading: requesting }] = useRequestOtpMutation();
  const [verifyOtp,   { isLoading: verifying  }] = useVerifySensitiveOtpMutation();

  async function handleRequest() {
    if (!phone) { toast.error('No phone number on your session'); return; }
    try {
      await requestOtp({ phone }).unwrap();
      setStep('verify');
    } catch (err) {
      toast.error(err?.data?.error || 'Could not send OTP');
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) return;
    try {
      await verifyOtp(otp).unwrap();
      toast.success('Verified — proceeding');
      onSuccess?.();
    } catch (err) {
      toast.error(err?.data?.error || 'Wrong OTP');
      setOtp('');
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', border: '1px solid rgba(99,102,241,0.3)' }}
        initial={{ y: 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 60, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {/* Close */}
        <button onClick={onCancel} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <X size={14} className="text-white/70" />
        </button>

        <div className="px-6 pt-8 pb-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,0.5)' }}>
            <ShieldCheck size={26} className="text-white" />
          </div>

          <h2 className="text-lg font-black text-white text-center mb-1">Security Verification</h2>
          <p className="text-sm text-white/50 text-center mb-6">
            {step === 'request'
              ? 'This action requires OTP verification to protect your account'
              : `Enter the 6-digit OTP sent to ${phone?.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2')}`}
          </p>

          {step === 'request' ? (
            <motion.button
              onClick={handleRequest}
              disabled={requesting}
              className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
              whileTap={{ scale: 0.97 }}
            >
              {requesting ? <><Loader2 size={16} className="animate-spin" /> Sending OTP…</> : <><KeyRound size={16} /> Send OTP to verify</>}
            </motion.button>
          ) : (
            <div className="space-y-3">
              <input
                type="number"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full h-14 text-center text-2xl font-black tracking-[0.5em] rounded-2xl outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1.5px solid rgba(99,102,241,0.4)' }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
              <motion.button
                onClick={handleVerify}
                disabled={verifying || otp.length !== 6}
                className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}
                whileTap={{ scale: 0.97 }}
              >
                {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={16} /> Confirm & Continue</>}
              </motion.button>
              <button onClick={() => { setStep('request'); setOtp(''); }}
                className="w-full text-xs text-white/40 text-center py-1">
                Resend OTP
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
