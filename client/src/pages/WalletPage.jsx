import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, AlertCircle, Loader2,
  Wallet, Sparkles, Gift, Trophy, Receipt, ArrowDownToLine,
  ArrowUpFromLine, Percent, Users, Star, RefreshCw, Crown,
  ShieldCheck, ChevronRight,
} from 'lucide-react';
import {
  useGetWalletQuery, useWalletTransactionsQuery,
  useWalletTopupMutation, useVerifyPaymentMutation,
} from '../services/api';
import { selectAuth } from '../modules/auth/authSlice';
import { openCheckout } from '../services/cashfree';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { staggerContainer, fadeInUp, scaleIn } from '../lib/animations';
import toast from 'react-hot-toast';

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

export default function WalletPage() {
  const nav = useNavigate();
  const { profile } = useSelector(selectAuth);
  const { data: wallet, refetch: refetchWallet } = useGetWalletQuery();
  const { data: txns, refetch: refetchTxns } = useWalletTransactionsQuery({ page: 1 });
  const [topup, { isLoading: starting }] = useWalletTopupMutation();
  const [verify] = useVerifyPaymentMutation();
  const [busy, setBusy] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const isFrozen = wallet?.wallet?.isFrozen;
  const balance = (wallet?.wallet?.balancePaise || 0) / 100;

  async function handleTopup(amountPaise) {
    try {
      setBusy(true);
      const orderInfo = await topup(amountPaise).unwrap();
      const checkoutResp = await openCheckout({
        paymentSessionId: orderInfo.paymentSessionId,
        cfOrderId:        orderInfo.cfOrderId,
        cashfreeEnv:      orderInfo.cashfreeEnv || 'sandbox',
        amountPaise:      orderInfo.amountPaise,
        purpose:          'Wallet Top-up',
      });
      await verify({
        cfOrderId:   checkoutResp.cfOrderId,
        cfPaymentId: checkoutResp.cfPaymentId,
      }).unwrap();
      toast.success(`₹${amountPaise / 100} added to wallet`);
      setCustomAmount('');
      refetchWallet();
      refetchTxns();
    } catch (err) {
      const msg = err?.message || err?.data?.error || 'Top-up failed';
      if (msg.includes('cancelled')) toast('Payment cancelled');
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleCustomTopup() {
    const amt = parseInt(customAmount, 10);
    if (!amt || amt < 10) { toast.error('Minimum top-up is ₹10'); return; }
    handleTopup(amt * 100);
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-[#F9FAFB] pb-40">
      <header className="page-header">
        <div className="page-header-inner">
          <motion.button
            onClick={() => nav(-1)}
            className="back-btn"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <h1 className="h-card flex-1">Wallet</h1>
        </div>
      </header>

      <motion.div
        className="page-container pt-4 space-y-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Balance card */}
        <motion.div className="card-hero" variants={scaleIn}>
          <div className="relative z-10">
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-4xl font-extrabold text-white tracking-tight">
              ₹{balance.toLocaleString('en-IN')}
            </p>
            {isFrozen && (
              <div className="mt-3 flex items-center gap-2 bg-red-500/30 backdrop-blur-sm rounded-xl px-3 py-2">
                <AlertCircle size={14} className="text-white" />
                <span className="text-xs text-white font-semibold">Account frozen — contact support</span>
              </div>
            )}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-28 flex items-center justify-center opacity-10">
            <Wallet size={80} strokeWidth={1} className="text-white" />
          </div>
        </motion.div>

        {/* ── Rewards marketing banner ── */}
        <motion.div variants={fadeInUp}>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => nav('/referral')}
            style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
            }}
          >
            {/* Background shimmer */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20"
                style={{ background: 'radial-gradient(ellipse, #8b5cf6, transparent)', filter: 'blur(24px)' }} />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-15"
                style={{ background: 'radial-gradient(ellipse, #6366f1, transparent)', filter: 'blur(20px)' }} />
            </div>

            <div className="relative px-5 py-4 flex items-center gap-4">
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                <span className="text-2xl">💰</span>
              </div>

              {/* Copy */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.15em] mb-0.5">Earn While You Book</p>
                <p className="text-sm font-extrabold text-white leading-tight">
                  5% cashback on every order.
                </p>
                <p className="text-xs text-white/50 mt-0.5 font-medium">
                  Plus 10% on your first 3 orders — automatically.
                </p>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <ChevronRight size={14} className="text-white/60" />
              </div>
            </div>

            {/* Stats row */}
            <div className="relative border-t border-white/10 px-5 py-3 flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-amber-400" />
                <p className="text-xs font-bold text-white/70">Refer friends → ₹100 each</p>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <Gift size={11} className="text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-400">Up to ₹50 / order</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick top-up */}
        <motion.div variants={fadeInUp}>
          <p className="section-title">Quick Add Money</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <motion.button
                key={amt}
                onClick={() => handleTopup(amt)}
                disabled={busy || starting || isFrozen}
                className="card text-center disabled:opacity-50 group"
                whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(37,99,235,0.12)' }}
                whileTap={{ scale: 0.97 }}
              >
                <p className="text-lg font-bold text-[#0F172A] group-hover:text-zappy-600 transition-colors">
                  ₹{amt / 100}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                  <Plus size={9} strokeWidth={2.5} />
                  Add to wallet
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Custom amount */}
        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-3">Custom Amount</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">₹</span>
              <input
                type="number"
                min="10"
                className="input pl-7"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            <button
              onClick={handleCustomTopup}
              disabled={busy || !customAmount || isFrozen}
              className="btn-primary px-5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2.5} />}
              Add
            </button>
          </div>
        </div>

        {/* Transactions */}
        <div>
          <p className="section-title">Recent Transactions</p>
          <div className="card p-0 overflow-hidden">
            {!txns?.items?.length ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400 font-medium">No transactions yet</p>
                <p className="text-xs text-slate-300 mt-1">Your activity will appear here</p>
              </div>
            ) : (
              txns.items.map((t, i) => {
                const positive = t.amountPaise > 0;
                // Smart icon + label + color by reason
                const TXN_META = {
                  cashback:                { Icon: Sparkles, bg: 'bg-violet-50', ic: 'text-violet-600', label: 'Cashback Reward' },
                  referral_reward:         { Icon: Gift,     bg: 'bg-pink-50',   ic: 'text-pink-600',   label: 'Referral Bonus' },
                  admin_adjustment_credit: { Icon: Crown,    bg: 'bg-amber-50',  ic: 'text-amber-600',  label: 'Bonus Credit' },
                  admin_adjustment_debit:  { Icon: Receipt,  bg: 'bg-red-50',    ic: 'text-red-500',    label: 'Deduction' },
                  wallet_topup:            { Icon: ArrowDownToLine, bg: 'bg-emerald-50', ic: 'text-emerald-600', label: 'Money Added' },
                  withdrawal:              { Icon: ArrowUpFromLine, bg: 'bg-orange-50',  ic: 'text-orange-600',  label: 'Withdrawal' },
                  refund:                  { Icon: RefreshCw, bg: 'bg-sky-50',   ic: 'text-sky-600',    label: 'Refund' },
                  worker_earning:          { Icon: TrendingUp, bg: 'bg-green-50', ic: 'text-green-600', label: 'Job Earnings' },
                  platform_commission:     { Icon: Percent,  bg: 'bg-slate-100', ic: 'text-slate-500',  label: 'Platform Fee' },
                  cancellation_fee:        { Icon: AlertCircle, bg: 'bg-red-50', ic: 'text-red-500',   label: 'Cancel Fee' },
                  subscription_revenue:    { Icon: Star,     bg: 'bg-amber-50',  ic: 'text-amber-600',  label: 'Subscription' },
                };
                const meta = TXN_META[t.reason] || (positive
                  ? { Icon: TrendingUp,   bg: 'bg-green-50',  ic: 'text-green-600',  label: t.reason?.replace(/_/g, ' ') || 'Credit' }
                  : { Icon: TrendingDown, bg: 'bg-red-50',    ic: 'text-red-500',    label: t.reason?.replace(/_/g, ' ') || 'Debit' });
                const { Icon: TxnIcon, bg, ic, label } = meta;

                // Special badge for rewards
                const isReward = ['cashback', 'referral_reward', 'admin_adjustment_credit'].includes(t.reason);

                return (
                  <div
                    key={t._id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''} ${isReward ? 'bg-gradient-to-r from-violet-50/40 to-transparent' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                      <TxnIcon size={16} strokeWidth={2} className={ic} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                        {isReward && <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Reward</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${positive ? 'text-success-600' : 'text-red-500'}`}>
                      {positive ? '+' : ''}₹{Math.abs(t.amountPaise) / 100}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>

      <BottomNav active="wallet" />
    </div>
    </PageTransition>
  );
}
