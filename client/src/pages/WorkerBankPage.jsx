import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Star, Building2, Smartphone, X, Check, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGetWorkerBankAccountsQuery, useAddWorkerBankAccountMutation,
  useDeleteWorkerBankAccountMutation, useSetDefaultWorkerBankAccountMutation,
} from '../services/api';

function AddSheet({ onClose }) {
  const [tab, setTab] = useState('bank');
  const [form, setForm] = useState({ label: '', accountName: '', accountNumber: '', bankName: '', ifsc: '', upiId: '', upiLabel: '' });
  const [add, { isLoading }] = useAddWorkerBankAccountMutation();
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      await add({ type: tab, ...form }).unwrap();
      toast.success(tab === 'upi' ? 'UPI ID added' : 'Bank account added');
      onClose();
    } catch (err) { toast.error(err?.data?.error || 'Failed to add'); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Add Payment Destination</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {['bank', 'upi'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              {t === 'bank' ? '🏦 Bank Account' : '📱 UPI ID'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {tab === 'bank' ? (
            <>
              <input className="input-field" placeholder="Account holder name *" value={form.accountName} onChange={e => set('accountName', e.target.value)} required />
              <input className="input-field" placeholder="Account number *" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} required />
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field" placeholder="IFSC code *" value={form.ifsc} onChange={e => set('ifsc', e.target.value.toUpperCase())} maxLength={11} required />
                <input className="input-field" placeholder="Bank name" value={form.bankName} onChange={e => set('bankName', e.target.value)} />
              </div>
              <input className="input-field" placeholder="Label (e.g. SBI Main)" value={form.label} onChange={e => set('label', e.target.value)} />
            </>
          ) : (
            <>
              <input className="input-field" placeholder="UPI ID (e.g. name@upi) *" value={form.upiId} onChange={e => set('upiId', e.target.value)} required />
              <input className="input-field" placeholder="Label (e.g. PhonePe)" value={form.upiLabel} onChange={e => set('upiLabel', e.target.value)} />
            </>
          )}
          <button type="submit" disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WorkerBankPage() {
  const nav = useNavigate();
  const { data, isLoading } = useGetWorkerBankAccountsQuery();
  const [deleteAcc] = useDeleteWorkerBankAccountMutation();
  const [setDefault] = useSetDefaultWorkerBankAccountMutation();
  const [showAdd, setShowAdd] = useState(false);

  const banks = data?.banks ?? [];
  const upiIds = data?.upiIds ?? [];

  async function handleDelete(id, type) {
    if (!window.confirm('Remove this account?')) return;
    try { await deleteAcc({ id, type }).unwrap(); toast.success('Removed'); }
    catch { toast.error('Failed to remove'); }
  }

  async function handleDefault(id, type) {
    try { await setDefault({ id, type }).unwrap(); toast.success('Set as default'); }
    catch { toast.error('Failed'); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Bank &amp; UPI Accounts</h1>
        <button onClick={() => setShowAdd(true)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
          <Plus size={13} /> Add
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs text-amber-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            Saved accounts are used to pre-fill withdrawal requests. Account numbers are stored masked.
          </div>

          {/* Bank accounts */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Bank Accounts</p>
            {banks.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                <Building2 size={24} className="mx-auto mb-2 opacity-30" />No bank accounts added
              </div>
            ) : banks.map(b => (
              <div key={b._id} className={`bg-white rounded-xl border p-4 mb-2 ${b.isDefault ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{b.accountName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.accountNumber} · {b.ifsc}</p>
                    {b.bankName && <p className="text-xs text-slate-400">{b.bankName}</p>}
                    {b.label && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full mt-1 inline-block">{b.label}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {!b.isDefault && (
                      <button onClick={() => handleDefault(b._id, 'bank')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-500" title="Set default">
                        <Star size={14} />
                      </button>
                    )}
                    {b.isDefault && <span className="text-xs text-indigo-600 font-semibold px-2 py-1">Default</span>}
                    <button onClick={() => handleDelete(b._id, 'bank')} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* UPI IDs */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">UPI IDs</p>
            {upiIds.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                <Smartphone size={24} className="mx-auto mb-2 opacity-30" />No UPI IDs added
              </div>
            ) : upiIds.map(u => (
              <div key={u._id} className={`bg-white rounded-xl border p-4 mb-2 ${u.isDefault ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{u.upiId}</p>
                    {u.label && <p className="text-xs text-slate-500">{u.label}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {!u.isDefault && (
                      <button onClick={() => handleDefault(u._id, 'upi')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-500">
                        <Star size={14} />
                      </button>
                    )}
                    {u.isDefault && <span className="text-xs text-indigo-600 font-semibold px-2 py-1">Default</span>}
                    <button onClick={() => handleDelete(u._id, 'upi')} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {showAdd && <AddSheet onClose={() => setShowAdd(false)} />}

      <style>{`.input-field { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .input-field:focus { ring: 2px; ring-color: #6366f1; }`}</style>
    </div>
  );
}
