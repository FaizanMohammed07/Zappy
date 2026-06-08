import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Zap, Clock, ChevronRight, Loader2, Building2, Smartphone, AlertCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerBankAccountsQuery, useGetWalletQuery, useRequestPayoutMutation } from '../services/api';

const MIN_PAISE = 5000;   // ₹50 — must match server payout.service.js
const MAX_PAISE = 2500000; // ₹25,000

const SETTLE_OPTS = [
  { id: 'instant',  label: 'Instant Transfer',   desc: 'Within 30 minutes',  feeRs: 9,   Icon: Zap,   color: 'amber' },
  { id: 'next_day', label: 'Next Day Transfer',   desc: 'By 9 AM tomorrow',   feeRs: 0,   Icon: Clock, color: 'indigo' },
];

export default function WorkerWithdrawPage() {
  const nav = useNavigate();
  const { data: walletData, isLoading: walletLoading } = useGetWalletQuery();
  const { data: bankData, isLoading: bankLoading } = useGetWorkerBankAccountsQuery();
  const [requestPayout, { isLoading: submitting }] = useRequestPayoutMutation();

  const [amountRs, setAmountRs] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [settlementType, setSettlementType] = useState('next_day');

  const balancePaise = walletData?.balance ?? 0;
  const balanceRs = (balancePaise / 100).toFixed(2);

  const banks = bankData?.banks ?? [];
  const upiIds = bankData?.upiIds ?? [];
  const allMethods = [
    ...banks.map(b => ({ id: b._id, type: 'bank', label: b.label || b.bankName || 'Bank Account', sub: b.accountNumber, isDefault: b.isDefault, accountName: b.accountName, ifsc: b.ifsc })),
    ...upiIds.map(u => ({ id: u._id, type: 'upi', label: u.label || 'UPI', sub: u.upiId, isDefault: u.isDefault })),
  ];
  const defaultMethod = allMethods.find(m => m.isDefault) ?? allMethods[0];
  const selected = allMethods.find(m => m.id === selectedId) ?? defaultMethod;

  const amtRs = parseFloat(amountRs) || 0;
  const feeRs = SETTLE_OPTS.find(o => o.id === settlementType)?.feeRs ?? 0;
  const netRs = Math.max(0, amtRs - feeRs);
  const amtPaise = Math.round(amtRs * 100);

  const validationError = amtPaise < MIN_PAISE && amtRs > 0
    ? `Minimum withdrawal is ₹${MIN_PAISE / 100}`
    : amtPaise > MAX_PAISE
    ? `Maximum withdrawal is ₹${MAX_PAISE / 100}`
    : amtPaise > balancePaise
    ? 'Insufficient wallet balance'
    : !selected
    ? 'Add a bank account or UPI ID first'
    : null;

  async function submit() {
    if (validationError) return toast.error(validationError);
    if (!amtRs) return toast.error('Enter an amount');

    // Build body matching payout.routes.js Joi schema exactly
    const body = {
      amountPaise: amtPaise,
      method: selected.type,
    };
    if (selected.type === 'upi') {
      body.upiId = selected.sub;
    } else {
      body.bankAccount = selected.sub; // masked account number
      body.bankIfsc = selected.ifsc ?? '';
      body.accountName = selected.accountName ?? '';
    }

    try {
      await requestPayout(body).unwrap();
      toast.success('Withdrawal requested! You will be notified when processed.');
      nav('/worker');
    } catch (err) {
      toast.error(err?.data?.error || 'Failed to request withdrawal. Try again.');
    }
  }

  const isLoading = walletLoading || bankLoading;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Withdraw Earnings</h1>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={22} className="animate-spin text-indigo-300" /></div>
      ) : (
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          {/* Balance */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white">
            <p className="text-indigo-200 text-xs mb-1">Available Balance</p>
            <p className="text-3xl font-bold">₹{balanceRs}</p>
            {balancePaise < MIN_PAISE && (
              <p className="text-amber-300 text-xs mt-2 flex items-center gap-1">
                <AlertCircle size={11} /> Minimum ₹{MIN_PAISE / 100} needed to withdraw
              </p>
            )}
            <button onClick={() => nav('/worker/bank')} className="mt-3 flex items-center gap-1 text-xs text-indigo-200 hover:text-white">
              <Wallet size={11} /> Manage bank accounts <ChevronRight size={11} />
            </button>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-500 mb-2">AMOUNT TO WITHDRAW</p>
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 transition ${validationError && amtRs > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
              <span className="text-xl font-bold text-slate-400">₹</span>
              <input
                type="number" min={MIN_PAISE / 100} max={MAX_PAISE / 100} step={1}
                value={amountRs} onChange={e => setAmountRs(e.target.value)}
                placeholder="0" className="flex-1 text-2xl font-bold text-slate-800 outline-none bg-transparent"
              />
            </div>
            {validationError && amtRs > 0 && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{validationError}</p>
            )}
            <div className="flex gap-2 mt-2">
              {[100, 500, 1000, 2000].map(v => (
                <button key={v} onClick={() => setAmountRs(String(v))}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-indigo-50 hover:border-indigo-200 transition">
                  ₹{v}
                </button>
              ))}
              <button onClick={() => setAmountRs(String(Math.min(Math.floor(balancePaise / 100), MAX_PAISE / 100)))}
                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-indigo-50 hover:border-indigo-200">
                Max
              </button>
            </div>
          </div>

          {/* Settlement type */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 mb-1">SETTLEMENT SPEED</p>
            {SETTLE_OPTS.map(opt => {
              const Icon = opt.Icon;
              const active = settlementType === opt.id;
              return (
                <button key={opt.id} onClick={() => setSettlementType(opt.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${opt.color === 'amber' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    <Icon size={15} className={opt.color === 'amber' ? 'text-amber-600' : 'text-indigo-600'} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                  <span className={`text-xs font-semibold ${opt.feeRs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {opt.feeRs > 0 ? `₹${opt.feeRs} fee` : 'Free'}
                  </span>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`} />
                </button>
              );
            })}
          </div>

          {/* Destination */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500">SEND TO</p>
              <button onClick={() => nav('/worker/bank')} className="text-xs text-indigo-600 font-medium">+ Add / Change</button>
            </div>
            {allMethods.length === 0 ? (
              <button onClick={() => nav('/worker/bank')}
                className="w-full py-4 text-sm text-indigo-600 font-semibold border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition">
                + Add bank account or UPI ID
              </button>
            ) : (
              <div className="space-y-2">
                {allMethods.map(m => (
                  <button key={m.id} onClick={() => setSelectedId(m.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${selected?.id === m.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      {m.type === 'upi' ? <Smartphone size={14} className="text-slate-500" /> : <Building2 size={14} className="text-slate-500" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.label}</p>
                      <p className="text-xs text-slate-500 truncate">{m.sub}</p>
                    </div>
                    {m.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full shrink-0">Default</span>}
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${selected?.id === m.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {amtRs > 0 && !validationError && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Withdrawal amount</span><span className="font-medium">₹{amtRs.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className={feeRs > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>-₹{feeRs.toFixed(2)}</span></div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold">
                <span className="text-slate-700">You receive</span><span className="text-slate-800">₹{netRs.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex gap-2 text-xs text-slate-500">
            <Info size={12} className="shrink-0 mt-0.5" />
            Withdrawals are processed after admin approval. Instant transfers may take up to 30 min depending on your bank.
          </div>

          <button
            onClick={submit}
            disabled={submitting || !!validationError || !amtRs || allMethods.length === 0 || balancePaise < MIN_PAISE}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition hover:bg-indigo-700 active:scale-[0.98]">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            {submitting ? 'Processing…' : 'Request Withdrawal'}
          </button>
        </div>
      )}
    </div>
  );
}
