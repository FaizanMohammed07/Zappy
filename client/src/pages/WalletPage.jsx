import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, TrendingUp, TrendingDown, AlertCircle, Loader2, Wallet } from 'lucide-react';
import {
  useGetWalletQuery, useWalletTransactionsQuery,
  useWalletTopupMutation, useVerifyPaymentMutation,
} from '../services/api';
import { selectAuth } from '../modules/auth/authSlice';
import { openCheckout } from '../services/razorpay';
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
        razorpayKeyId: orderInfo.razorpayKeyId,
        razorpayOrderId: orderInfo.razorpayOrderId,
        amountPaise: orderInfo.amountPaise,
        name: 'Zappy',
        description: `Wallet top-up ₹${amountPaise / 100}`,
        prefill: { contact: profile?.phone, name: profile?.name },
      });
      await verify({
        razorpayOrderId: checkoutResp.razorpay_order_id,
        razorpayPaymentId: checkoutResp.razorpay_payment_id,
        razorpaySignature: checkoutResp.razorpay_signature,
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
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
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
                return (
                  <div
                    key={t._id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      positive ? 'bg-success-50' : 'bg-red-50'
                    }`}>
                      {positive
                        ? <TrendingUp size={16} strokeWidth={2} className="text-success-600" />
                        : <TrendingDown size={16} strokeWidth={2} className="text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] capitalize">
                        {t.reason.replace(/_/g, ' ')}
                      </p>
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
