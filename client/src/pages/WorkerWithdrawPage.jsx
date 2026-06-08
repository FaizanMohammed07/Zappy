import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Zap, Clock, ChevronRight, Loader2, Building2, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerBankAccountsQuery } from '../services/api';
import { useGetWalletQuery, useRequestPayoutMutation } from '../services/api';

const SETTLE_OPTS = [
  { id: 'instant', label: 'Instant Transfer', desc: 'Within 30 minutes', fee: 9, icon: Zap, color: 'amber' },
  { id: 'next_day', label: 'Next Day Transfer', desc: 'By 9 AM tomorrow', fee: 0, icon: Clock, color: 'indigo' },
];

export default function WorkerWithdrawPage() {
  const nav = useNavigate();
  const { data: walletData } = useGetWalletQuery();
  const { data: bankData } = useGetWorkerBankAccountsQuery();
  const [requestPayout, { isLoading }] = useRequestPayoutMutation();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [settlementType, setSettlementType] = useState('next_day');

  const balancePaise = walletData?.balance ?? 0;
  const balanceRs = (balancePaise / 100).toFixed(2);

  const banks = bankData?.banks ?? [];
  const upiIds = bankData?.upiIds ?? [];
  const allMethods = [
    ...banks.map(b => ({ id: b._id, type: 'bank', label: b.label || b.bankName || 'Bank', sub: b.accountNumber, isDefault: b.isDefault })),
    ...upiIds.map(u => ({ id: u._id, type: 'upi', label: u.label || 'UPI', sub: u.upiId, isDefault: u.isDefault })),
  ];

  const defaultMethod = allMethods.find(m => m.isDefault) ?? allMethods[0];
  const selected = allMethods.find(m => m.id === method) ?? defaultMethod;

  const amtRs = parseFloat(amount) || 0;
  const feeObj = SETTLE_OPTS.find(o => o.id === settlementType);
  const fee = feeObj?.fee ?? 0;
  const netRs = Math.max(0, amtRs - fee);

  async function submit() {
    if (!amtRs || amtRs < 1) return toast.error('Enter a valid amount');
    if (amtRs * 100 > balancePaise) return toast.error('Insufficient wallet balance');
    if (!selected) return toast.error('Add a bank account or UPI ID first');
    try {
      await requestPayout({ amountPaise: Math.floor(amtRs * 100), method: selected.type, methodId: selected.id, settlementType }).unwrap();
      toast.success('Withdrawal requested!');
      nav('/worker');
    } catch (err) { toast.error(err?.data?.error || 'Failed to request withdrawal'); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Withdraw to Bank / UPI</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Balance card */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white">
          <p className="text-indigo-200 text-xs mb-1">Available Balance</p>
          <p className="text-3xl font-bold">₹{balanceRs}</p>
          <button onClick={() => nav('/worker/bank')} className="mt-3 flex items-center gap-1 text-xs text-indigo-200 hover:text-white">
            <Wallet size={11} /> Manage bank accounts <ChevronRight size={11} />
          </button>
        </div>

        {/* Amount input */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 mb-2">AMOUNT</p>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-lg font-bold text-slate-500">₹</span>
            <input
              type="number" min={1} step={1} value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 text-2xl font-bold text-slate-800 outline-none bg-transparent"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[500, 1000, 2000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-indigo-50 hover:border-indigo-200">
                ₹{v}
              </button>
            ))}
            <button onClick={() => setAmount(String(Math.floor(balancePaise / 100)))}
              className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-indigo-50 hover:border-indigo-200">
              Max
            </button>
          </div>
        </div>

        {/* Settlement type */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 mb-1">SETTLEMENT TYPE</p>
          {SETTLE_OPTS.map(opt => {
            const Icon = opt.icon;
            const isSelected = settlementType === opt.id;
            return (
              <button key={opt.id} onClick={() => setSettlementType(opt.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${opt.color === 'amber' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                  <Icon size={16} className={opt.color === 'amber' ? 'text-amber-600' : 'text-indigo-600'} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
                <span className={`text-xs font-semibold ${opt.fee > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {opt.fee > 0 ? `₹${opt.fee} fee` : 'Free'}
                </span>
                <div className={`w-4 h-4 rounded-full border-2 transition ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`} />
              </button>
            );
          })}
        </div>

        {/* Destination */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500">DESTINATION</p>
            <button onClick={() => nav('/worker/bank')} className="text-xs text-indigo-600">Change</button>
          </div>
          {allMethods.length === 0 ? (
            <button onClick={() => nav('/worker/bank')} className="w-full py-3 text-sm text-indigo-600 font-medium border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50">
              + Add bank account or UPI
            </button>
          ) : (
            <div className="space-y-2">
              {allMethods.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border ${(selected?.id === m.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    {m.type === 'upi' ? <Smartphone size={14} className="text-slate-500" /> : <Building2 size={14} className="text-slate-500" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                    <p className="text-xs text-slate-500">{m.sub}</p>
                  </div>
                  {m.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Default</span>}
                  <div className={`w-4 h-4 rounded-full border-2 ${selected?.id === m.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {amtRs > 0 && (
          <div className="bg-slate-100 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Withdrawal amount</span><span className="font-medium">₹{amtRs.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className={fee > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>-₹{fee.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="font-semibold text-slate-700">You receive</span><span className="font-bold text-slate-800">₹{netRs.toFixed(2)}</span></div>
          </div>
        )}

        <button onClick={submit} disabled={isLoading || !amtRs}
          className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
          Withdraw Now
        </button>
      </div>
    </div>
  );
}
