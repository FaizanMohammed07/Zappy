/**
 * Earned Wage Access Widget
 * "Get paid now" — workers withdraw today's earnings instantly.
 * No Indian gig platform has this. Life-changing for daily-wage workers.
 */
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGetEarnedWageQuery, useRequestWageAdvanceMutation } from '../../services/api';
import toast from 'react-hot-toast';

export default function EarnedWageWidget() {
  const { data, isLoading, refetch } = useGetEarnedWageQuery();
  const [advance, { isLoading: advancing }] = useRequestWageAdvanceMutation();

  if (isLoading) return null;
  if (!data || data.jobCount === 0) return null;

  const { netAdvanceRupees, feeRupees, jobCount, alreadyAdvanced, totalEarnedRupees } = data;
  const canAdvance = !alreadyAdvanced && netAdvanceRupees >= 50;

  async function handleAdvance() {
    if (!window.confirm(`Advance ₹${netAdvanceRupees} now? (₹${feeRupees} fee applies)`)) return;
    try {
      await advance().unwrap();
      toast.success(`₹${netAdvanceRupees} credited to your wallet!`);
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Advance failed');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card bg-gradient-to-br from-emerald-50 to-green-50 ring-1 ring-emerald-100"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Zap size={16} strokeWidth={2} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-emerald-800">Same-Day Pay</p>
          <p className="text-[11px] text-emerald-600">{jobCount} job{jobCount !== 1 ? 's' : ''} completed today · ₹{totalEarnedRupees} earned</p>
        </div>
      </div>

      {alreadyAdvanced ? (
        <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <p className="text-xs font-semibold text-slate-600">Today's advance already taken. Full settlement tomorrow.</p>
        </div>
      ) : canAdvance ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/70 rounded-xl p-2.5 text-center">
              <p className="text-xl font-extrabold text-emerald-700">₹{netAdvanceRupees}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Available now</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2.5 text-center">
              <p className="text-xl font-extrabold text-slate-500">₹{feeRupees}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">2% fee</p>
            </div>
          </div>
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-[0.97] transition"
          >
            {advancing ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {advancing ? 'Processing…' : `Get ₹${netAdvanceRupees} Now`}
          </button>
          <p className="text-[10px] text-emerald-600 text-center mt-2 font-medium">
            Instant · Once per day · Full settlement next day
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-slate-400" />
          <p className="text-xs text-slate-500">Complete more jobs today to unlock advance (min ₹50)</p>
        </div>
      )}
    </motion.div>
  );
}
