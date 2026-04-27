import { useState, useEffect } from 'react';
import { useAdminGetCancellationConfigQuery, useAdminUpdateCancellationConfigMutation } from '../../services/api';
import { SectionHeader, Card, FormRow, Input, SaveBtn, PageLoader } from './_shared';
import toast from 'react-hot-toast';

export default function Cancellation() {
  const { data: cfg, isLoading } = useAdminGetCancellationConfigQuery();
  const [update, { isLoading: saving }] = useAdminUpdateCancellationConfigMutation();

  const [form, setForm] = useState({
    freeWindowMinutes: 2,
    userFlatPenaltyPaise: 2000,
    userPercentPenalty: 10,
    workerFlatPenaltyPaise: 3000,
    workerPercentPenalty: 15,
    maxDailyWorkerCancels: 3,
    cancelStrikeThreshold: 5,
    rejectRatePenaltyWeight: 2,
    cancelRatePenaltyWeight: 3,
  });

  useEffect(() => {
    if (cfg && Object.keys(cfg).length > 0) {
      setForm(prev => ({ ...prev, ...cfg }));
    }
  }, [cfg]);

  const field = (key) => ({
    type: 'number',
    value: form[key] ?? '',
    onChange: (e) => setForm(prev => ({ ...prev, [key]: Number(e.target.value) })),
  });

  async function save() {
    try {
      await update(form).unwrap();
      toast.success('Cancellation config saved');
    } catch (err) {
      toast.error(err.data?.error || 'Save failed');
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Cancellation Settings" subtitle="Configure penalty rules, free windows, and dispatch penalty weights." />

      {/* User penalties */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">User Cancellation Penalties</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormRow label="Free Window (minutes)" hint="No penalty if cancelled within this time">
            <Input {...field('freeWindowMinutes')} step="1" min="0" />
          </FormRow>
          <FormRow label="Flat Penalty (paise)" hint="Fixed charge after free window">
            <Input {...field('userFlatPenaltyPaise')} step="100" min="0" />
          </FormRow>
          <FormRow label="Percent Penalty (%)" hint="% of order value charged (0–100)">
            <Input {...field('userPercentPenalty')} step="1" min="0" max="100" />
          </FormRow>
        </div>
      </Card>

      {/* Worker penalties */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Worker Cancellation Penalties</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormRow label="Flat Penalty (paise)" hint="Deducted from worker wallet">
            <Input {...field('workerFlatPenaltyPaise')} step="100" min="0" />
          </FormRow>
          <FormRow label="Percent Penalty (%)" hint="% of order value deducted">
            <Input {...field('workerPercentPenalty')} step="1" min="0" max="100" />
          </FormRow>
          <FormRow label="Max Daily Cancels" hint="Cancels allowed before strike">
            <Input {...field('maxDailyWorkerCancels')} step="1" min="1" />
          </FormRow>
          <FormRow label="Strike Threshold" hint="Lifetime cancels before escalation">
            <Input {...field('cancelStrikeThreshold')} step="1" min="1" />
          </FormRow>
        </div>
      </Card>

      {/* Dispatch penalty weights */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Dispatch Scoring Weights</h3>
        <p className="text-xs text-slate-400 mb-4">
          Workers with high rejection or cancellation rates receive a penalty added to their dispatch score,
          reducing their priority. Higher weights = stronger penalty.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormRow label="Reject Rate Weight" hint="Multiplied by worker's lifetime reject rate">
            <Input {...field('rejectRatePenaltyWeight')} step="0.1" min="0" max="20" />
          </FormRow>
          <FormRow label="Cancel Rate Weight" hint="Multiplied by worker's lifetime cancel rate">
            <Input {...field('cancelRatePenaltyWeight')} step="0.1" min="0" max="20" />
          </FormRow>
        </div>
        <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 font-mono">
          penalty = rejectRate × {form.rejectRatePenaltyWeight} + cancelRate × {form.cancelRatePenaltyWeight}
        </div>
      </Card>

      <div className="flex">
        <SaveBtn loading={saving} onClick={save} />
      </div>
    </div>
  );
}
