import { useState, useEffect } from 'react';
import {
  useGetPricingConfigQuery,
  useAdminUpdatePricingMutation,
  useAdminTogglesMutation,
  useAdminToggleDispatchMutation,
} from '../../services/api';
import { SectionHeader, Card, FormRow, Input, SaveBtn, PageLoader } from './_shared';
import toast from 'react-hot-toast';

function Toggle({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span
          className="inline-block w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
      <span className="text-sm font-medium text-slate-700">{label || (value ? 'Enabled' : 'Disabled')}</span>
    </div>
  );
}

export default function Pricing() {
  // Correct endpoint: public GET /pricing → returns { pricing: { baseFeePaise, ... } }
  const { data, isLoading } = useGetPricingConfigQuery();
  // Correct endpoint: PATCH /api/${slug}/pricing → pricingService.updateActiveConfig (persists to Mongo + busts cache)
  const [updatePricing, { isLoading: saving }] = useAdminUpdatePricingMutation();
  // Correct endpoint: PATCH /api/${slug}/toggles → pricingService.updateActiveConfig
  const [setToggles, { isLoading: savingToggles }] = useAdminTogglesMutation();
  const [toggleDispatchMutation, { isLoading: togglingDispatch }] = useAdminToggleDispatchMutation();

  // Display in rupees; save as paise
  const [form, setForm] = useState({
    baseFee: 35, perKmFee: 12, perMinFee: 2, platformFee: 15, minFare: 60, surgeMaxMultiplier: 2.5,
  });
  const [toggles, setTogglesState] = useState({
    surgeEnabled: true, surgeMaxCap: 2.5, commissionRate: 0.30,
  });
  const [dispatchEnabled, setDispatchEnabled] = useState(true);
  const [dispatchConfirm, setDispatchConfirm] = useState(false);
  const [dispatch, setDispatch] = useState({
    forceAssignBonusRs: 15,
    workerAutoOfflineRejectRate: 70,
    workerRejectWarnRate: 50,
    rejectRatePenaltyWeight: 3.0,
    cancelRatePenaltyWeight: 5.0,
    minWorkerRating: 3.0,
  });
  const [stale, setStale] = useState({
    staleNudgeMinutes: 5,
    staleRedispatchMinutes: 10,
    staleOtwAlertMinutes: 20,
  });
  const [tips, setTips] = useState({
    tipMaxRs: 500,
    tipOptions: '20,50,100',
  });
  const [referral, setReferral] = useState({
    referralReferrerBonusRs: 150,
    referralRefereeBonusRs: 50,
  });
  const [wallet, setWallet] = useState({
    earnedWageAdvanceEnabled: true,
    earnedWageAdvanceRate: 80,
    emergencyFundContributionRate: 0.5,
  });

  useEffect(() => {
    const p = data?.pricing;
    if (!p) return;
    setForm({
      baseFee:            (p.baseFeePaise    ?? 3500)  / 100,
      perKmFee:           (p.perKmFeePaise   ?? 1200)  / 100,
      perMinFee:          (p.perMinFeePaise  ?? 200)   / 100,
      platformFee:        (p.platformFeePaise ?? 1500) / 100,
      minFare:            (p.minFarePaise    ?? 6000)  / 100,
      surgeMaxMultiplier: p.surgeMaxCap ?? 2.5,
    });
    setTogglesState({
      surgeEnabled:   p.surgeEnabled   ?? true,
      surgeMaxCap:    p.surgeMaxCap    ?? 2.5,
      commissionRate: p.commissionRate ?? 0.30,
    });
    setDispatchEnabled(p.dispatchEnabled ?? true);
    setDispatch({
      forceAssignBonusRs:          (p.forceAssignBonusPaise       ?? 1500) / 100,
      workerAutoOfflineRejectRate:  Math.round((p.workerAutoOfflineRejectRate ?? 0.70) * 100),
      workerRejectWarnRate:         Math.round((p.workerRejectWarnRate        ?? 0.50) * 100),
      rejectRatePenaltyWeight:      p.rejectRatePenaltyWeight ?? 3.0,
      cancelRatePenaltyWeight:      p.cancelRatePenaltyWeight ?? 5.0,
      minWorkerRating:              p.minWorkerRating          ?? 3.0,
    });
    setStale({
      staleNudgeMinutes:       p.staleNudgeMinutes       ?? 5,
      staleRedispatchMinutes:  p.staleRedispatchMinutes  ?? 10,
      staleOtwAlertMinutes:    p.staleOtwAlertMinutes    ?? 20,
    });
    setTips({
      tipMaxRs:    (p.tipMaxPaise ?? 50000) / 100,
      tipOptions:  (p.tipOptions  ?? [20, 50, 100]).join(','),
    });
    setReferral({
      referralReferrerBonusRs: (p.referralReferrerBonusPaise ?? 15000) / 100,
      referralRefereeBonusRs:  (p.referralRefereeBonusPaise  ?? 5000)  / 100,
    });
    setWallet({
      earnedWageAdvanceEnabled:      p.earnedWageAdvanceEnabled      ?? true,
      earnedWageAdvanceRate:         Math.round((p.earnedWageAdvanceRate ?? 0.80) * 100),
      emergencyFundContributionRate: Math.round((p.emergencyFundContributionRate ?? 0.005) * 1000) / 10,
    });
  }, [data]);

  const field = (key) => ({
    type: 'number', value: form[key] ?? '',
    onChange: (e) => setForm(prev => ({ ...prev, [key]: Number(e.target.value) })),
  });

  async function saveSection(patch) {
    try {
      await updatePricing(patch).unwrap();
      toast.success('Saved');
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed');
    }
  }

  async function savePricing() {
    try {
      await updatePricing({
        baseFeePaise:    Math.round(form.baseFee    * 100),
        perKmFeePaise:   Math.round(form.perKmFee   * 100),
        perMinFeePaise:  Math.round(form.perMinFee  * 100),
        platformFeePaise: Math.round(form.platformFee * 100),
        minFarePaise:    Math.round(form.minFare    * 100),
        surgeMaxCap:     form.surgeMaxMultiplier,
      }).unwrap();
      toast.success('Pricing config saved');
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed');
    }
  }

  async function saveToggles() {
    try {
      await setToggles(toggles).unwrap();
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed');
    }
  }

  const df = (key) => ({ type: 'number', value: dispatch[key] ?? '', onChange: (e) => setDispatch(p => ({ ...p, [key]: Number(e.target.value) })) });
  const sf = (key) => ({ type: 'number', value: stale[key] ?? '', onChange: (e) => setStale(p => ({ ...p, [key]: Number(e.target.value) })) });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <SectionHeader title="Platform Control Centre" subtitle="All pricing, bonuses, thresholds, and behaviour — controlled from here. Changes apply instantly." />

      {/* ── Base Fare ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Fare Components</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormRow label="Base Fee (₹)" hint="Flat charge for every order"><Input {...field('baseFee')} step="1" min="0" /></FormRow>
          <FormRow label="Per KM Fee (₹)" hint="Charged per kilometre"><Input {...field('perKmFee')} step="0.5" min="0" /></FormRow>
          <FormRow label="Per Minute Fee (₹)" hint="Charged per minute"><Input {...field('perMinFee')} step="0.5" min="0" /></FormRow>
          <FormRow label="Platform Fee (₹)" hint="Fixed platform service charge"><Input {...field('platformFee')} step="1" min="0" /></FormRow>
          <FormRow label="Min Fare (₹)" hint="Minimum chargeable fare"><Input {...field('minFare')} step="5" min="0" /></FormRow>
          <FormRow label="Surge Max Multiplier" hint="e.g. 2.5 = max 2.5×"><Input {...field('surgeMaxMultiplier')} step="0.1" min="1" max="10" /></FormRow>
        </div>
        <div className="mt-5"><SaveBtn loading={saving} onClick={savePricing} /></div>
      </Card>

      {/* ── Surge + Commission ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Surge &amp; Commission</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormRow label="Surge Pricing" hint="Toggle surge on/off platform-wide">
            <Toggle value={toggles.surgeEnabled} onChange={(v) => setTogglesState(p => ({ ...p, surgeEnabled: v }))} />
          </FormRow>
          <FormRow label="Surge Cap" hint="Maximum surge multiplier (1–5)">
            <Input type="number" value={toggles.surgeMaxCap} min="1" max="5" step="0.1"
              onChange={(e) => setTogglesState(p => ({ ...p, surgeMaxCap: Number(e.target.value) }))} />
          </FormRow>
          <FormRow label="Commission Rate" hint="Platform cut — 0 to 50%">
            <div className="flex items-center gap-2">
              <Input type="number" value={toggles.commissionRate} min="0" max="0.5" step="0.01"
                onChange={(e) => setTogglesState(p => ({ ...p, commissionRate: Number(e.target.value) }))} />
              <span className="text-base font-bold text-slate-700 w-12 shrink-0">{(toggles.commissionRate * 100).toFixed(0)}%</span>
            </div>
          </FormRow>
        </div>
        <div className="mt-5"><SaveBtn loading={savingToggles} onClick={saveToggles} /></div>
      </Card>

      {/* ── Dispatch Kill-Switch ── */}
      <Card className={`p-6 ${!dispatchEnabled ? 'ring-2 ring-red-300 bg-red-50' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Dispatch Engine</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {dispatchEnabled
                ? 'Active — new orders are being dispatched to workers normally.'
                : '⚠️ PAUSED — all new dispatch jobs re-queue every 60 s. Orders will not be assigned until re-enabled.'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {!dispatchConfirm ? (
              <button
                onClick={() => setDispatchConfirm(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  dispatchEnabled
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-200'
                    : 'bg-green-50 text-green-700 hover:bg-green-100 ring-1 ring-green-200'
                }`}
              >
                {dispatchEnabled ? 'Pause Dispatch' : 'Resume Dispatch'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">
                  {dispatchEnabled ? 'Pause dispatch?' : 'Resume dispatch?'}
                </span>
                <button
                  disabled={togglingDispatch}
                  onClick={async () => {
                    try {
                      const next = !dispatchEnabled;
                      const res = await toggleDispatchMutation({ dispatchEnabled: next }).unwrap();
                      setDispatchEnabled(next);
                      setDispatchConfirm(false);
                      toast[next ? 'success' : 'error'](res.message, { duration: 6000 });
                    } catch { toast.error('Failed to toggle dispatch'); setDispatchConfirm(false); }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-white rounded-lg disabled:opacity-50"
                >
                  {togglingDispatch ? '…' : 'Confirm'}
                </button>
                <button onClick={() => setDispatchConfirm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Dispatch & Worker Behaviour ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Dispatch &amp; Worker Behaviour</h3>
        <p className="text-xs text-slate-400 mb-4">Controls auto-assign bonus, reject-rate penalties, and quality thresholds.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormRow label="Force-Assign Bonus (₹)" hint="Credited to worker when auto-assigned">
            <Input {...df('forceAssignBonusRs')} step="5" min="0" />
          </FormRow>
          <FormRow label="Auto-Offline Reject Rate (%)" hint="Worker taken offline above this ignore rate">
            <Input {...df('workerAutoOfflineRejectRate')} step="5" min="10" max="100" />
          </FormRow>
          <FormRow label="Reject Rate Warning (%)" hint="Early warning nudge threshold">
            <Input {...df('workerRejectWarnRate')} step="5" min="10" max="100" />
          </FormRow>
          <FormRow label="Reject Rate Penalty Weight" hint="Higher = chronic ignorers ranked worse">
            <Input {...df('rejectRatePenaltyWeight')} step="0.5" min="0" max="20" />
          </FormRow>
          <FormRow label="Cancel Rate Penalty Weight" hint="Higher = chronic cancellers ranked worse">
            <Input {...df('cancelRatePenaltyWeight')} step="0.5" min="0" max="20" />
          </FormRow>
          <FormRow label="Min Worker Rating" hint="Workers below this are excluded from dispatch">
            <Input {...df('minWorkerRating')} step="0.1" min="1" max="5" />
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={() => saveSection({
            forceAssignBonusPaise:       Math.round(dispatch.forceAssignBonusRs * 100),
            workerAutoOfflineRejectRate: dispatch.workerAutoOfflineRejectRate / 100,
            workerRejectWarnRate:        dispatch.workerRejectWarnRate / 100,
            rejectRatePenaltyWeight:     dispatch.rejectRatePenaltyWeight,
            cancelRatePenaltyWeight:     dispatch.cancelRatePenaltyWeight,
            minWorkerRating:             dispatch.minWorkerRating,
          })} />
        </div>
      </Card>

      {/* ── Stale Order Watchdog ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Stale Order Watchdog</h3>
        <p className="text-xs text-slate-400 mb-4">Timers (in minutes) that trigger worker nudges and re-dispatch for stuck orders.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormRow label="Nudge Worker After (min)" hint="Assigned but no trip start → push alert">
            <Input {...sf('staleNudgeMinutes')} step="1" min="1" max="30" />
          </FormRow>
          <FormRow label="Re-Dispatch After (min)" hint="Strip & find new worker after this delay">
            <Input {...sf('staleRedispatchMinutes')} step="1" min="2" max="60" />
          </FormRow>
          <FormRow label="On-The-Way Alert After (min)" hint="Alert when worker takes too long en route">
            <Input {...sf('staleOtwAlertMinutes')} step="5" min="5" max="120" />
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={() => saveSection(stale)} />
        </div>
      </Card>

      {/* ── Tip Controls ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Tip Settings</h3>
        <p className="text-xs text-slate-400 mb-4">Control what customers can tip workers.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormRow label="Max Tip (₹)" hint="Maximum tip a customer can give">
            <Input type="number" value={tips.tipMaxRs} step="50" min="0"
              onChange={(e) => setTips(p => ({ ...p, tipMaxRs: Number(e.target.value) }))} />
          </FormRow>
          <FormRow label="Quick Tip Options (₹, comma-separated)" hint="e.g. 20,50,100">
            <Input type="text" value={tips.tipOptions}
              onChange={(e) => setTips(p => ({ ...p, tipOptions: e.target.value }))} />
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={() => saveSection({
            tipMaxPaise: Math.round(tips.tipMaxRs * 100),
            tipOptions:  tips.tipOptions.split(',').map(Number).filter(Boolean),
          })} />
        </div>
      </Card>

      {/* ── Referral Rewards ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Referral Rewards</h3>
        <p className="text-xs text-slate-400 mb-4">Bonus amounts credited when a user invites a friend who completes their first order.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormRow label="Referrer Bonus (₹)" hint="The person who shared the code earns this">
            <Input type="number" value={referral.referralReferrerBonusRs} step="10" min="0"
              onChange={(e) => setReferral(p => ({ ...p, referralReferrerBonusRs: Number(e.target.value) }))} />
          </FormRow>
          <FormRow label="Referee Bonus (₹)" hint="The new user who signed up earns this">
            <Input type="number" value={referral.referralRefereeBonusRs} step="10" min="0"
              onChange={(e) => setReferral(p => ({ ...p, referralRefereeBonusRs: Number(e.target.value) }))} />
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={() => saveSection({
            referralReferrerBonusPaise: Math.round(referral.referralReferrerBonusRs * 100),
            referralRefereeBonusPaise:  Math.round(referral.referralRefereeBonusRs  * 100),
          })} />
        </div>
      </Card>

      {/* ── Earned Wage + Emergency Fund ── */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Worker Finance</h3>
        <p className="text-xs text-slate-400 mb-4">Earned wage advance and emergency mutual fund settings.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormRow label="Earned Wage Advance" hint="Allow workers to withdraw earned wages early">
            <Toggle value={wallet.earnedWageAdvanceEnabled}
              onChange={(v) => setWallet(p => ({ ...p, earnedWageAdvanceEnabled: v }))} />
          </FormRow>
          <FormRow label="Advance Rate (%)" hint="% of earned wages worker can withdraw early">
            <div className="flex items-center gap-2">
              <Input type="number" value={wallet.earnedWageAdvanceRate} step="5" min="10" max="100"
                onChange={(e) => setWallet(p => ({ ...p, earnedWageAdvanceRate: Number(e.target.value) }))} />
              <span className="text-base font-bold text-slate-700">{wallet.earnedWageAdvanceRate}%</span>
            </div>
          </FormRow>
          <FormRow label="Emergency Fund Contribution (%)" hint="% of platform commission that goes to worker mutual aid">
            <div className="flex items-center gap-2">
              <Input type="number" value={wallet.emergencyFundContributionRate} step="0.1" min="0" max="5"
                onChange={(e) => setWallet(p => ({ ...p, emergencyFundContributionRate: Number(e.target.value) }))} />
              <span className="text-base font-bold text-slate-700">{wallet.emergencyFundContributionRate}%</span>
            </div>
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={() => saveSection({
            earnedWageAdvanceEnabled:      wallet.earnedWageAdvanceEnabled,
            earnedWageAdvanceRate:         wallet.earnedWageAdvanceRate / 100,
            emergencyFundContributionRate: wallet.emergencyFundContributionRate / 100,
          })} />
        </div>
      </Card>
    </div>
  );
}
