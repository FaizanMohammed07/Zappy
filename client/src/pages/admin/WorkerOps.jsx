import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, ShieldCheck, Users, UserCheck, Ban, AlertTriangle, Smartphone } from 'lucide-react';
import {
  useAdminWorkerOpsQuery,
  useAdminUpdateCancellationConfigMutation,
} from '../../services/api';

const inp = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400';

function Stat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900', green: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        <Icon size={13} /> {label}
      </div>
      <p className={`text-2xl font-black mt-1 ${tones[tone]}`}>{Number(value ?? 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

export default function WorkerOps() {
  const { data, isLoading } = useAdminWorkerOpsQuery(undefined, { pollingInterval: 20000 });
  const [update, { isLoading: saving }] = useAdminUpdateCancellationConfigMutation();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (data?.policy) {
      setForm({
        maxDailyWorkerCancels:      data.policy.maxDailyWorkerCancels,
        workerCancelWindowHours:    data.policy.workerCancelWindowHours,
        workerCancelPenaltyRupees:  data.policy.workerCancelPenaltyRupees,
        lateWorkerCancelMultiplier: data.policy.lateWorkerCancelMultiplier,
        workerNoShowPenaltyRupees:  data.policy.workerNoShowPenaltyRupees,
        workerRejectLimit:          data.policy.workerRejectLimit,
      });
    }
  }, [data]);

  if (isLoading || !form) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500" /></div>;

  const num = (k) => (e) => setForm((p) => ({ ...p, [k]: Number(e.target.value) }));
  const s = data.stats || {};

  async function save() {
    try {
      // Persist to the cancellation config (rupees → paise, hours → seconds).
      await update({
        maxDailyWorkerCancels:      form.maxDailyWorkerCancels,
        workerCancelLimit:          form.maxDailyWorkerCancels, // keep legacy alias in sync
        workerCancelWindowSec:      Math.round(form.workerCancelWindowHours * 3600),
        workerCancelPenaltyPaise:   Math.round(form.workerCancelPenaltyRupees * 100),
        lateWorkerCancelMultiplier: form.lateWorkerCancelMultiplier,
        workerNoShowPenaltyPaise:   Math.round(form.workerNoShowPenaltyRupees * 100),
        workerRejectLimit:          form.workerRejectLimit,
      }).unwrap();
      toast.success('Worker operations policy saved');
    } catch (err) { toast.error(err?.data?.error || 'Save failed'); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Worker Operations</h2>
        <p className="text-sm text-slate-500">Single-device, cancellations, escalation and live worker signals — all in one place.</p>
      </div>

      {/* Live stats */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Live now</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat icon={Users}   label="Total workers"    value={s.totalWorkers} />
          <Stat icon={UserCheck} label="Online"         value={s.onlineWorkers}     tone="green" />
          <Stat icon={ShieldCheck} label="Available"     value={s.availableWorkers}  tone="indigo" />
          <Stat icon={AlertTriangle} label="Cancelling today" value={s.workersCancellingToday} tone="amber" />
          <Stat icon={AlertTriangle} label="Cancels today (total)" value={s.cancelsToday} tone="amber" />
          <Stat icon={Ban}     label="Auto-offlined"    value={s.workersAtLimit}    tone="rose" />
        </div>
      </div>

      {/* Single-device */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0"><Smartphone size={16} className="text-indigo-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Single active device — {data.singleDevice?.enforced ? 'Enforced' : 'Off'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            A worker can be signed in on one device at a time; a new login signs the old one out.
            New-device hard block is {data.singleDevice?.hardBlockNewDevice ? 'ON' : 'OFF'} (env <code>WORKER_NEW_DEVICE_BLOCK</code>).
          </p>
        </div>
      </div>

      {/* Cancellation & escalation policy */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Cancellation & escalation policy</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500">Max cancels before auto-offline</label>
            <input type="number" min="1" className={inp} value={form.maxDailyWorkerCancels} onChange={num('maxDailyWorkerCancels')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Cancel window (hours)</label>
            <input type="number" min="1" className={inp} value={form.workerCancelWindowHours} onChange={num('workerCancelWindowHours')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Cancel penalty (₹)</label>
            <input type="number" min="0" className={inp} value={form.workerCancelPenaltyRupees} onChange={num('workerCancelPenaltyRupees')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Late-cancel multiplier (×)</label>
            <input type="number" min="1" step="0.5" className={inp} value={form.lateWorkerCancelMultiplier} onChange={num('lateWorkerCancelMultiplier')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">No-show penalty (₹)</label>
            <input type="number" min="0" className={inp} value={form.workerNoShowPenaltyRupees} onChange={num('workerNoShowPenaltyRupees')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Reject limit</label>
            <input type="number" min="1" className={inp} value={form.workerRejectLimit} onChange={num('workerRejectLimit')} />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          A worker who exceeds <b>{form.maxDailyWorkerCancels}</b> penalised cancels within <b>{form.workerCancelWindowHours}h</b> is automatically set offline.
        </p>
        <button onClick={save} disabled={saving}
          className="mt-4 w-full bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save policy
        </button>
      </div>

      {/* Cancellation reasons */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-600 mb-2">Penalty-free reasons</p>
          <ul className="space-y-1.5">
            {(data.penaltyFreeReasons || []).map((r) => <li key={r} className="text-sm text-slate-700">• {r}</li>)}
          </ul>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-600 mb-2">Penalised reasons</p>
          <ul className="space-y-1.5">
            {(data.penalisedReasons || []).map((r) => <li key={r} className="text-sm text-slate-700">• {r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
