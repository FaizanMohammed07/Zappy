import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, CheckCircle2, Zap, ShieldOff, Award, TrendingUp,
  Target, Loader2, AlertCircle, Crown,
} from 'lucide-react';
import {
  useListPlansQuery, useMySubscriptionQuery,
  useSubscribeMutation, useCancelSubscriptionMutation, useVerifyPaymentMutation,
} from '../services/api';
import { selectAuth } from '../modules/auth/authSlice';
import { openCheckout } from '../services/razorpay';
import toast from 'react-hot-toast';

export default function PlansPage() {
  const nav = useNavigate();
  const { profile, role } = useSelector(selectAuth);
  const audience = role === 'worker' ? 'worker' : 'user';
  const { data: plansData, isLoading } = useListPlansQuery(audience);
  const { data: subData, refetch: refetchSub } = useMySubscriptionQuery();
  const [subscribe] = useSubscribeMutation();
  const [verifyPayment] = useVerifyPaymentMutation();
  const [cancel] = useCancelSubscriptionMutation();
  const [purchasing, setPurchasing] = useState(null);
  const [showCancel, setShowCancel] = useState(false);

  const activeSub = subData?.subscription;

  async function handleSubscribe(plan) {
    try {
      setPurchasing(plan.code);
      const orderInfo = await subscribe(plan.code).unwrap();
      const checkoutResp = await openCheckout({
        razorpayKeyId: orderInfo.razorpayKeyId,
        razorpayOrderId: orderInfo.razorpayOrderId,
        amountPaise: orderInfo.amountPaise,
        name: 'Zappy',
        description: plan.name,
        prefill: { contact: profile?.phone, name: profile?.name, email: profile?.email },
      });
      await verifyPayment({
        razorpayOrderId: checkoutResp.razorpay_order_id,
        razorpayPaymentId: checkoutResp.razorpay_payment_id,
        razorpaySignature: checkoutResp.razorpay_signature,
      }).unwrap();
      toast.success(`${plan.name} activated!`);
      refetchSub();
    } catch (err) {
      const msg = err?.data?.error || err?.message || 'Subscription failed';
      if (msg.includes('cancelled')) toast('Payment cancelled');
      else toast.error(msg);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleCancel() {
    try {
      await cancel(activeSub._id).unwrap();
      toast.success('Subscription cancelled');
      setShowCancel(false);
      refetchSub();
    } catch (err) {
      toast.error(err?.data?.error || 'Failed to cancel');
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 size={28} className="text-zappy-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-12">
      <header className="page-header">
        <div className="page-header-inner">
          <button onClick={() => nav(-1)} className="back-btn">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="t-label">{audience === 'worker' ? 'Partner' : 'Premium'}</p>
            <p className="font-semibold text-[#0F172A]">Subscription Plans</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Active plan banner */}
        {activeSub && (
          <div className="card bg-success-50 ring-1 ring-success-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-success-100 flex items-center justify-center">
                  <Crown size={18} strokeWidth={2} className="text-success-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-success-700 uppercase tracking-wide">Active Plan</p>
                  <p className="font-bold text-[#0F172A]">{activeSub.planCode}</p>
                  <p className="text-xs text-success-600 mt-0.5">
                    Renews {new Date(activeSub.endAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCancel(true)}
                className="text-xs font-semibold text-red-500 shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Cancel confirmation */}
        {showCancel && (
          <div className="card bg-red-50 ring-red-200 space-y-3">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Cancel subscription?</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Benefits remain active until end of billing period.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCancel(false)} className="btn-secondary flex-1 text-sm py-2">Keep plan</button>
              <button onClick={handleCancel} className="btn-danger flex-1 text-sm py-2">Cancel plan</button>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="card-hero">
          <div className="relative z-10">
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
              {audience === 'worker' ? 'Earn More' : 'Better Experiences'}
            </p>
            <h2 className="text-xl font-bold text-white leading-snug">
              {audience === 'worker'
                ? 'Lower commission,\nhigher earnings'
                : 'No surge pricing,\npriority service'}
            </h2>
          </div>
          <div className="absolute right-4 top-4 opacity-20">
            <Crown size={56} strokeWidth={1} className="text-white" />
          </div>
        </div>

        {/* Plans */}
        {plansData?.plans?.map((plan) => {
          const isCurrent = activeSub?.planCode === plan.code;
          return (
            <div
              key={plan.code}
              className={`card ${isCurrent ? 'ring-2 ring-zappy-600 shadow-soft-lg' : ''}`}
            >
              {isCurrent && (
                <div className="flex items-center gap-1.5 mb-3">
                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-zappy-600" />
                  <span className="text-xs font-bold text-zappy-600 uppercase tracking-wide">Current Plan</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-[#0F172A] text-lg">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{plan.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-extrabold text-zappy-600">₹{plan.priceInPaise / 100}</p>
                  <p className="text-xs text-slate-400 font-medium">/{plan.durationDays} days</p>
                </div>
              </div>

              <PlanBenefits effects={plan.effects} audience={audience} />

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isCurrent || !!activeSub || purchasing === plan.code}
                className={`w-full mt-4 ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
              >
                {purchasing === plan.code ? (
                  <><Loader2 size={14} className="animate-spin" /> Opening payment…</>
                ) : isCurrent ? (
                  <><CheckCircle2 size={14} /> Active plan</>
                ) : activeSub ? (
                  'Cancel current plan to switch'
                ) : (
                  <><Zap size={14} strokeWidth={2.5} /> Subscribe for ₹{plan.priceInPaise / 100}</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanBenefits({ effects, audience }) {
  const items = [];
  if (audience === 'user') {
    if (effects?.surgeCap === 1.0) items.push({ Icon: ShieldOff, text: 'No surge pricing, ever' });
    else if (effects?.surgeCap) items.push({ Icon: TrendingDown, text: `Surge capped at ${effects.surgeCap}×` });
    if (effects?.waivePlatformFee) items.push({ Icon: Award, text: 'No platform fees on bookings' });
    if (effects?.priorityAssignment) items.push({ Icon: Zap, text: 'Priority worker assignment' });
  } else {
    if (effects?.commissionDelta < 0) {
      items.push({ Icon: TrendingUp, text: `${Math.abs(effects.commissionDelta * 100).toFixed(0)}% lower platform commission` });
    }
    if (effects?.proBoost) items.push({ Icon: Target, text: 'Higher visibility in job matching' });
    if (effects?.visibilityMultiplier > 1) items.push({ Icon: Zap, text: `${effects.visibilityMultiplier}× more job offers` });
  }

  if (!items.length) return null;

  return (
    <ul className="space-y-2 mt-2">
      {items.map(({ Icon, text }, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-success-50 flex items-center justify-center shrink-0">
            <Icon size={10} strokeWidth={2.5} className="text-success-600" />
          </div>
          <span className="text-sm text-slate-700 font-medium">{text}</span>
        </li>
      ))}
    </ul>
  );
}
