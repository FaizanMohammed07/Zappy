import { useState, useEffect } from 'react';
import {
  useGetPricingConfigQuery,
  useAdminUpdatePricingMutation,
  useAdminTogglesMutation,
} from '../../services/api';
import { SectionHeader, Card, FormRow, Input, SaveBtn, PageLoader } from './_shared';
import toast from 'react-hot-toast';

export default function Pricing() {
  // Correct endpoint: public GET /pricing → returns { pricing: { baseFeePaise, ... } }
  const { data, isLoading } = useGetPricingConfigQuery();
  // Correct endpoint: PATCH /api/${slug}/pricing → pricingService.updateActiveConfig (persists to Mongo + busts cache)
  const [updatePricing, { isLoading: saving }] = useAdminUpdatePricingMutation();
  // Correct endpoint: PATCH /api/${slug}/toggles → pricingService.updateActiveConfig
  const [setToggles, { isLoading: savingToggles }] = useAdminTogglesMutation();

  // Display in rupees; save as paise
  const [form, setForm] = useState({
    baseFee: 35, perKmFee: 12, perMinFee: 2, platformFee: 15, minFare: 60, surgeMaxMultiplier: 2.5,
  });
  const [toggles, setTogglesState] = useState({
    surgeEnabled: true, surgeMaxCap: 2.5, commissionRate: 0.30,
  });

  useEffect(() => {
    const p = data?.pricing;
    if (!p) return;
    // Convert paise → rupees for fare fields
    setForm({
      baseFee:            (p.baseFeePaise    ?? 3500)  / 100,
      perKmFee:           (p.perKmFeePaise   ?? 1200)  / 100,
      perMinFee:          (p.perMinFeePaise  ?? 200)   / 100,
      platformFee:        (p.platformFeePaise ?? 1500) / 100,
      minFare:            (p.minFarePaise    ?? 6000)  / 100,
      surgeMaxMultiplier: p.surgeMaxCap ?? 2.5,
    });
    // Seed toggle state from real config
    setTogglesState({
      surgeEnabled:  p.surgeEnabled  ?? true,
      surgeMaxCap:   p.surgeMaxCap   ?? 2.5,
      commissionRate: p.commissionRate ?? 0.30,
    });
  }, [data]);

  const field = (key) => ({
    type: 'number', value: form[key] ?? '',
    onChange: (e) => setForm(prev => ({ ...prev, [key]: Number(e.target.value) })),
  });

  async function savePricing() {
    try {
      // Convert rupees → paise; server schema expects integer paise + surgeMaxCap
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Pricing Control" subtitle="Adjust base fare structure. Changes apply to new orders immediately." />

      {/* Base pricing */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Fare Components</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormRow label="Base Fee (₹)" hint="Flat charge for every order">
            <Input {...field('baseFee')} step="1" min="0" />
          </FormRow>
          <FormRow label="Per KM Fee (₹)" hint="Charged per kilometre">
            <Input {...field('perKmFee')} step="0.5" min="0" />
          </FormRow>
          <FormRow label="Per Minute Fee (₹)" hint="Charged per minute">
            <Input {...field('perMinFee')} step="0.5" min="0" />
          </FormRow>
          <FormRow label="Platform Fee (₹)" hint="Fixed platform service charge">
            <Input {...field('platformFee')} step="1" min="0" />
          </FormRow>
          <FormRow label="Min Fare (₹)" hint="Minimum chargeable fare">
            <Input {...field('minFare')} step="5" min="0" />
          </FormRow>
          <FormRow label="Surge Max Multiplier" hint="e.g. 2.5 = max 2.5× surge">
            <Input {...field('surgeMaxMultiplier')} step="0.1" min="1" max="10" />
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={saving} onClick={savePricing} />
        </div>
      </Card>

      {/* Surge + Commission toggles */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Live Controls</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormRow label="Surge Pricing" hint="Toggle surge on/off platform-wide">
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => setTogglesState(p => ({ ...p, surgeEnabled: !p.surgeEnabled }))}
                className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${toggles.surgeEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span
                  className="inline-block w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5"
                  style={{ transform: toggles.surgeEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">{toggles.surgeEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </FormRow>
          <FormRow label="Surge Cap" hint="Maximum surge multiplier (1–5)">
            <Input
              type="number" value={toggles.surgeMaxCap} min="1" max="5" step="0.1"
              onChange={(e) => setTogglesState(p => ({ ...p, surgeMaxCap: Number(e.target.value) }))}
            />
          </FormRow>
          <FormRow label="Commission Rate" hint="Platform cut (0.0 – 0.5 = 0%–50%)">
            <div className="flex items-center gap-2">
              <Input
                type="number" value={toggles.commissionRate} min="0" max="0.5" step="0.01"
                onChange={(e) => setTogglesState(p => ({ ...p, commissionRate: Number(e.target.value) }))}
              />
              <span className="text-lg font-bold text-slate-700 w-12 shrink-0">
                {(toggles.commissionRate * 100).toFixed(0)}%
              </span>
            </div>
          </FormRow>
        </div>
        <div className="mt-5">
          <SaveBtn loading={savingToggles} onClick={saveToggles} />
        </div>
      </Card>
    </div>
  );
}
