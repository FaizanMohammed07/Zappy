import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, CheckCircle2, Zap, ShieldOff, Award, TrendingUp, TrendingDown,
  Target, Loader2, AlertCircle, Crown, Star, Shield, Rocket,
} from 'lucide-react';
import {
  useListPlansQuery, useMySubscriptionQuery,
  useSubscribeMutation, useCancelSubscriptionMutation, useVerifyPaymentMutation,
} from '../services/api';
import { selectAuth } from '../modules/auth/authSlice';
import { openCheckout } from '../services/cashfree';
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
        paymentSessionId: orderInfo.paymentSessionId,
        cfOrderId:        orderInfo.cfOrderId,
        cashfreeEnv:      orderInfo.cashfreeEnv || 'sandbox',
      });
      await verifyPayment({
        cfOrderId:   checkoutResp.cfOrderId,
        cfPaymentId: checkoutResp.cfPaymentId,
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
        {(plansData?.plans?.length === 0) && (
          <div className="text-center py-12 text-slate-400">
            <Crown size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No plans available right now</p>
          </div>
        )}

        {plansData?.plans?.map((plan, idx) => {
          const isCurrent  = activeSub?.planCode === plan.code;
          const isPremium  = idx > 0; // last plan in list = most premium
          const price      = plan.priceInPaise / 100;
          const monthLabel = plan.durationDays === 30 ? '/month' : `/${plan.durationDays} days`;

          return (
            <div
              key={plan.code}
              className={`rounded-2xl overflow-hidden ${
                isPremium
                  ? 'ring-2 ring-zappy-600'
                  : 'ring-1 ring-slate-200'
              }`}
              style={isPremium ? { boxShadow: '0 8px 32px rgba(99,102,241,0.18)' } : {}}
            >
              {/* Premium badge strip */}
              {isPremium && (
                <div className="bg-gradient-to-r from-zappy-600 to-violet-600 py-1.5 px-4 flex items-center justify-center gap-2">
                  <Star size={11} strokeWidth={2.5} className="text-yellow-300 fill-yellow-300" />
                  <span className="text-[11px] font-extrabold text-white uppercase tracking-widest">Most Popular</span>
                  <Star size={11} strokeWidth={2.5} className="text-yellow-300 fill-yellow-300" />
                </div>
              )}

              <div className={`bg-white p-5`}>
                {isCurrent && (
                  <div className="flex items-center gap-1.5 mb-3 text-zappy-600">
                    <CheckCircle2 size={13} strokeWidth={2.5} />
                    <span className="text-xs font-extrabold uppercase tracking-wide">Your Current Plan</span>
                  </div>
                )}

                {/* Price + name row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <h3 className="font-extrabold text-[#0F172A] text-xl">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{plan.description}</p>
                    )}
                    {plan.trialDays > 0 && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        <Zap size={9} strokeWidth={3} />
                        {plan.trialDays}-day free trial
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-black text-[#0F172A]">₹{price}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">{monthLabel}</p>
                  </div>
                </div>

                {/* Benefits */}
                <PlanBenefits effects={plan.effects} audience={audience} />

                {/* CTA */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || !!activeSub || purchasing === plan.code}
                  className={`w-full mt-5 py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-500 cursor-default'
                      : isPremium
                      ? 'bg-gradient-to-r from-zappy-600 to-violet-600 text-white shadow-lg shadow-zappy-600/25 hover:shadow-zappy-600/40'
                      : 'bg-[#0F172A] text-white hover:bg-slate-800'
                  } disabled:opacity-60`}
                >
                  {purchasing === plan.code ? (
                    <><Loader2 size={14} className="animate-spin" /> Opening payment…</>
                  ) : isCurrent ? (
                    <><CheckCircle2 size={14} strokeWidth={2.5} /> Active Plan</>
                  ) : activeSub ? (
                    'Cancel current plan first'
                  ) : (
                    <><Rocket size={14} strokeWidth={2.5} /> Get {plan.name} — ₹{price}{monthLabel}</>
                  )}
                </button>
              </div>
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
    if (effects?.surgeCap === 1.0) items.push({ Icon: ShieldOff, text: 'No surge pricing, ever', color: 'text-green-600 bg-green-50' });
    else if (effects?.surgeCap) items.push({ Icon: TrendingDown, text: `Surge capped at ${effects.surgeCap}×`, color: 'text-green-600 bg-green-50' });
    if (effects?.waivePlatformFee) items.push({ Icon: Award, text: 'Zero platform fees on every booking', color: 'text-blue-600 bg-blue-50' });
    if (effects?.priorityAssignment) items.push({ Icon: Zap, text: 'Priority worker assignment — faster service', color: 'text-amber-600 bg-amber-50' });
  } else {
    if (effects?.commissionDelta < 0) {
      items.push({ Icon: TrendingUp, text: `${Math.abs(effects.commissionDelta * 100).toFixed(0)}% lower platform commission — keep more earnings`, color: 'text-green-600 bg-green-50' });
    }
    if (effects?.proBoost) items.push({ Icon: Shield, text: 'Pro badge on your profile', color: 'text-violet-600 bg-violet-50' });
    if (effects?.visibilityMultiplier > 1) items.push({ Icon: Target, text: `${effects.visibilityMultiplier}× more job offers sent to you`, color: 'text-blue-600 bg-blue-50' });
  }

  if (!items.length) return null;

  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      {items.map(({ Icon, text, color }, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon size={13} strokeWidth={2.5} />
          </div>
          <span className="text-sm text-slate-700 font-semibold leading-snug">{text}</span>
        </div>
      ))}
    </div>
  );
}
