/**
 * Shift Slots Widget — "Plan Your Day" for workers.
 * Shows today's committed slots + allows committing new ones.
 * Zero competitor has this — workers see projected income before the day starts.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Zap, TrendingUp, Plus, CheckCircle2,
  ChevronRight, Loader2, X,
} from 'lucide-react';
import {
  useGetShiftsQuery,
  useLazyPreviewShiftQuery,
  useCommitShiftMutation,
  useCancelShiftSlotMutation,
} from '../../services/api';
import toast from 'react-hot-toast';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h) => {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const STATUS_COLOR = {
  committed: 'bg-blue-100 text-blue-700 ring-blue-200',
  active:    'bg-green-100 text-green-700 ring-green-200',
  fulfilled: 'bg-green-100 text-green-700 ring-green-200',
  missed:    'bg-slate-100 text-slate-500 ring-slate-200',
  cancelled: 'bg-red-50 text-red-500 ring-red-100',
};

export default function ShiftSlotsWidget({ currentLat, currentLng }) {
  const [showPlanner, setShowPlanner] = useState(false);
  const [startHour, setStartHour] = useState(9);
  const [endHour,   setEndHour]   = useState(13);

  const { data: shiftsData, refetch } = useGetShiftsQuery({});
  const [triggerPreview, { data: preview, isFetching: previewing }] = useLazyPreviewShiftQuery();
  const [commitShift,   { isLoading: committing }]  = useCommitShiftMutation();
  const [cancelSlot,    { isLoading: cancelling }]  = useCancelShiftSlotMutation();

  const today = shiftsData?.today;
  const activeSlots = today?.slots?.filter(s => s.status !== 'cancelled') || [];

  const onPreview = useCallback(() => {
    if (!currentLat || !currentLng) return;
    triggerPreview({ startHour, endHour, lat: currentLat, lng: currentLng });
  }, [startHour, endHour, currentLat, currentLng, triggerPreview]);

  async function handleCommit() {
    if (!currentLat || !currentLng) {
      toast.error('Enable GPS first to commit to a shift');
      return;
    }
    try {
      await commitShift({
        startHour, endHour,
        lat: currentLat, lng: currentLng,
      }).unwrap();
      toast.success(`Shift ${fmtHour(startHour)} – ${fmtHour(endHour)} committed!`);
      setShowPlanner(false);
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Could not commit shift');
    }
  }

  async function handleCancel(slot) {
    try {
      await cancelSlot({ startHour: slot.startHour }).unwrap();
      toast.success('Shift cancelled');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Could not cancel');
    }
  }

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Calendar size={15} strokeWidth={2} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">My Shift Plan</p>
            <p className="text-[11px] text-slate-400">Commit ahead, earn bonus</p>
          </div>
        </div>
        <button
          onClick={() => { setShowPlanner(s => !s); if (!showPlanner && currentLat) onPreview(); }}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full"
        >
          <Plus size={12} /> Plan
        </button>
      </div>

      {/* Today's committed slots */}
      {activeSlots.length > 0 && (
        <div className="space-y-2">
          {activeSlots.map((slot, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 ${STATUS_COLOR[slot.status] || STATUS_COLOR.committed}`}>
              <Clock size={13} strokeWidth={2} />
              <div className="flex-1">
                <p className="text-xs font-bold">{fmtHour(slot.startHour)} – {fmtHour(slot.endHour)}</p>
                {slot.status === 'fulfilled' && (
                  <p className="text-[10px] opacity-70">Bonus: ₹{Math.round(slot.bonusPaise / 100)} earned ✓</p>
                )}
                {slot.status === 'committed' && (
                  <p className="text-[10px] opacity-70">Bonus: ₹{Math.round(slot.bonusPaise / 100)} on first order</p>
                )}
                {slot.status === 'active' && (
                  <p className="text-[10px] opacity-70">{slot.ordersDelivered} orders · bonus unlocked</p>
                )}
              </div>
              {slot.status === 'committed' && (
                <button onClick={() => handleCancel(slot)} disabled={cancelling} className="opacity-50 hover:opacity-100">
                  <X size={13} />
                </button>
              )}
              {slot.status === 'fulfilled' && <CheckCircle2 size={14} strokeWidth={2.5} />}
            </div>
          ))}
          {today?.totalBonusPaise > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Zap size={12} className="text-amber-500" />
              <p className="text-xs text-slate-500 font-medium">
                Up to <span className="font-bold text-amber-600">₹{Math.round(today.totalBonusPaise / 100)}</span> bonus available today
              </p>
            </div>
          )}
        </div>
      )}

      {activeSlots.length === 0 && !showPlanner && (
        <button
          onClick={() => { setShowPlanner(true); if (currentLat) onPreview(); }}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-400 flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-500 transition"
        >
          <Plus size={14} /> Plan your shift & earn bonus
        </button>
      )}

      {/* Shift planner */}
      <AnimatePresence>
        {showPlanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Choose Your Hours</p>

              {/* Hour selectors */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400 mb-1">Start</p>
                  <select
                    value={startHour}
                    onChange={e => { setStartHour(Number(e.target.value)); }}
                    onBlur={onPreview}
                    className="w-full text-sm font-semibold text-[#0F172A] bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200 outline-none focus:border-blue-400"
                  >
                    {HOURS.slice(0, 23).map(h => (
                      <option key={h} value={h}>{fmtHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400 mb-1">End</p>
                  <select
                    value={endHour}
                    onChange={e => { setEndHour(Number(e.target.value)); }}
                    onBlur={onPreview}
                    className="w-full text-sm font-semibold text-[#0F172A] bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200 outline-none focus:border-blue-400"
                  >
                    {HOURS.slice(1).map(h => (
                      <option key={h} value={h} disabled={h <= startHour}>{fmtHour(h)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview card */}
              {previewing && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                  <Loader2 size={13} className="animate-spin" /> Computing projected earnings…
                </div>
              )}
              {preview && !previewing && (
                <div className="bg-blue-50 rounded-2xl p-3.5 ring-1 ring-blue-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} strokeWidth={2} className="text-blue-600" />
                    <p className="text-xs font-bold text-blue-800">Projected earnings for this slot</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-base font-extrabold text-[#0F172A]">₹{preview.estimatedEarningsRupees || 0}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Job Pay</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-base font-extrabold text-green-600">+₹{preview.bonusRupees}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Bonus</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-base font-extrabold text-blue-700">₹{preview.totalProjectedRupees}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-600 font-medium">
                    ~{preview.estimatedOrders} orders expected · bonus unlocks on first delivery
                    {preview.isPeak && ' · ⚡ Peak hours — higher bonus!'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setShowPlanner(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={committing || endHour <= startHour}
                  className="flex-[2] py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {committing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} strokeWidth={2.5} />}
                  {committing ? 'Committing…' : 'Commit to Shift'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
