import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronRight, AlertCircle, Clock, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerAppealsQuery, useCreateWorkerAppealMutation } from '../services/api';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      color: 'amber',   Icon: Clock },
  under_review: { label: 'Under Review', color: 'blue',    Icon: AlertCircle },
  upheld:       { label: 'Upheld',       color: 'emerald', Icon: CheckCircle },
  dismissed:    { label: 'Dismissed',    color: 'red',     Icon: XCircle },
};

const TYPE_OPTS = ['rating', 'penalty', 'cancellation', 'order_issue'];
const TYPE_LABELS = { rating: 'Rating Dispute', penalty: 'Penalty Appeal', cancellation: 'Cancellation Reversal', order_issue: 'Order Issue' };

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const cls = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700' };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls[c.color]}`}>
      <c.Icon size={10} /> {c.label}
    </span>
  );
}

function NewAppealSheet({ onClose }) {
  const [form, setForm] = useState({ type: 'rating', subject: '', description: '', orderId: '' });
  const [create, { isLoading }] = useCreateWorkerAppealMutation();
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (form.description.length < 30) return toast.error('Please describe the issue in at least 30 characters');
    try {
      await create(form).unwrap();
      toast.success('Appeal submitted');
      onClose();
    } catch (err) { toast.error(err?.data?.error || 'Failed to submit appeal'); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-5 max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">New Appeal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Appeal Type</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTS.map(t => (
                <button type="button" key={t} onClick={() => set('type', t)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${form.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600'}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="Subject (e.g. Unfair 1-star rating)"
            value={form.subject} onChange={e => set('subject', e.target.value)} required
          />

          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="Order ID (optional)"
            value={form.orderId} onChange={e => set('orderId', e.target.value)}
          />

          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"
            placeholder="Describe the issue in detail (minimum 30 characters)..."
            rows={5} value={form.description} onChange={e => set('description', e.target.value)} required
          />

          <p className="text-xs text-slate-400">Our team reviews appeals within 2-3 business days. You will be notified when resolved.</p>

          <button type="submit" disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Submit Appeal
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WorkerAppealsPage() {
  const nav = useNavigate();
  const { data, isLoading } = useGetWorkerAppealsQuery();
  const [showNew, setShowNew] = useState(false);
  const appeals = data?.appeals ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Appeals</h1>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
          <Plus size={13} /> New
        </button>
      </header>

      <div className="p-4 space-y-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-xs text-blue-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          Contest unfair ratings, penalties, or cancellations. Our team reviews every appeal within 2-3 business days.
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : appeals.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
            <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No appeals yet</p>
            <p className="text-xs text-slate-400 mt-1">Tap "New" to contest a rating or penalty</p>
          </div>
        ) : appeals.map(a => (
          <div key={a._id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium uppercase">{TYPE_LABELS[a.type] ?? a.type}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="font-semibold text-slate-800 text-sm truncate">{a.subject}</p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.description}</p>
                {a.adminNote && (
                  <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-600 border border-slate-200">
                    <span className="font-semibold text-slate-700">Admin note: </span>{a.adminNote}
                  </div>
                )}
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        ))}
      </div>

      {showNew && <NewAppealSheet onClose={() => setShowNew(false)} />}
    </div>
  );
}
