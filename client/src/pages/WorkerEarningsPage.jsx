import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Download, Zap, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { useGetJobEarningsQuery } from '../services/api';

const fmt = v => `₹${(v / 100).toFixed(2)}`;

function EarningRow({ job, expanded, onToggle }) {
  const hasSurge = job.surgeMultiplier && job.surgeMultiplier > 1;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-2">
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={onToggle}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${hasSurge ? 'bg-amber-100' : 'bg-indigo-50'}`}>
          {hasSurge ? <Zap size={16} className="text-amber-600" /> : <TrendingUp size={16} className="text-indigo-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{job.serviceLabel ?? 'Service'}</p>
          <p className="text-xs text-slate-400">{new Date(job.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-800">{fmt(job.net)}</p>
          {hasSurge && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{job.surgeMultiplier}×</span>}
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Gross earnings</span><span className="font-medium">{fmt(job.gross)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Platform fee</span><span className="text-red-500">-{fmt(job.platformFee)}</span></div>
          {job.tip > 0 && <div className="flex justify-between"><span className="text-slate-500">Customer tip</span><span className="text-emerald-600">+{fmt(job.tip)}</span></div>}
          {job.bonus > 0 && <div className="flex justify-between"><span className="text-slate-500">Bonus</span><span className="text-emerald-600">+{fmt(job.bonus)}</span></div>}
          {hasSurge && (
            <div className="flex justify-between"><span className="text-slate-500">Surge multiplier</span>
              <span className="text-amber-600 font-semibold">{job.surgeMultiplier}× <span className="text-xs font-normal">demand zone</span></span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-1.5 flex justify-between font-semibold">
            <span className="text-slate-700">Net payout</span><span className="text-indigo-700">{fmt(job.net)}</span>
          </div>
          {job.orderId && <p className="text-[10px] text-slate-400 pt-0.5">Order {job.orderId}</p>}
        </div>
      )}
    </div>
  );
}

function generatePayslipCSV(jobs, period) {
  const rows = [['Date', 'Service', 'Gross', 'Platform Fee', 'Tip', 'Bonus', 'Surge', 'Net']];
  jobs.forEach(j => {
    rows.push([
      new Date(j.completedAt).toLocaleDateString('en-IN'),
      j.serviceLabel ?? 'Service',
      (j.gross / 100).toFixed(2),
      (j.platformFee / 100).toFixed(2),
      (j.tip / 100).toFixed(2),
      (j.bonus / 100).toFixed(2),
      j.surgeMultiplier ?? 1,
      (j.net / 100).toFixed(2),
    ]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `payslip-${period}.csv`;
  a.click();
}

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: '3months', label: 'Last 3 Months' },
];

export default function WorkerEarningsPage() {
  const nav = useNavigate();
  const [period, setPeriod] = useState('month');
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useGetJobEarningsQuery({ period });
  const jobs = data?.jobs ?? [];
  const summary = data?.summary ?? {};

  function toggle(id) { setExpanded(p => p === id ? null : id); }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Earnings Breakdown</h1>
        <button onClick={() => generatePayslipCSV(jobs, period)} className="ml-auto flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
          <Download size={12} /> Payslip CSV
        </button>
      </header>

      <div className="p-4 space-y-4">
        {/* Period tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition ${period === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Total Net</p>
            <p className="text-xl font-bold text-slate-800">{fmt(summary.totalNet ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Jobs Done</p>
            <p className="text-xl font-bold text-slate-800">{summary.count ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Tips</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(summary.totalTips ?? 0)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
            <p className="text-xs text-amber-700">Surge Jobs</p>
            <p className="text-xl font-bold text-amber-700">{summary.surgeCount ?? 0}</p>
          </div>
        </div>

        {/* Platform fee info */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2 text-xs text-slate-600">
          <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
          Platform fee is deducted per job. Reduce it by upgrading your subscription plan.
        </div>

        {/* Jobs list */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Job Breakdown</p>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : jobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
              No completed jobs in this period
            </div>
          ) : jobs.map(j => (
            <EarningRow key={j._id} job={j} expanded={expanded === j._id} onToggle={() => toggle(j._id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
