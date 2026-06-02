import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Save, Loader2, Info, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { useAdminUpdateCatalogServiceMutation, useAdminServiceActiveOrderCountQuery } from '../../../../services/api';
import toast from 'react-hot-toast';
import { SvcIcon, NumInput, FieldRow, rupees, paise } from './_service-shared';

export default function ServicePricingCard({ svc, accent, gradFrom, gradTo, tabColor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name:        svc.name,
    description: svc.description || '',
    minRs:       rupees(svc.priceRangeMinPaise),
    maxRs:       rupees(svc.priceRangeMaxPaise),
    durationMin: svc.estimatedDurationMinutes,
    isActive:    svc.isActive,
  });
  const [updateSvc, { isLoading: saving }] = useAdminUpdateCatalogServiceMutation();
  const [checkActiveOrders, setCheckActiveOrders] = useState(false);
  const { data: activeOrderData } = useAdminServiceActiveOrderCountQuery(svc.code, { skip: !checkActiveOrders });
  const activeOrderCount = activeOrderData?.activeOrderCount ?? 0;

  useEffect(() => {
    setForm({
      name:        svc.name,
      description: svc.description || '',
      minRs:       rupees(svc.priceRangeMinPaise),
      maxRs:       rupees(svc.priceRangeMaxPaise),
      durationMin: svc.estimatedDurationMinutes,
      isActive:    svc.isActive,
    });
  }, [svc]);

  async function handleSave() {
    try {
      await updateSvc({
        code: svc.code, name: form.name, description: form.description,
        priceRangeMinRs: form.minRs, priceRangeMaxRs: form.maxRs,
        estimatedDurationMinutes: form.durationMin, isActive: form.isActive,
      }).unwrap();
      toast.success(`${svc.name} pricing saved`);
      setOpen(false);
    } catch { toast.error('Save failed'); }
  }

  const f = v => e => setForm(p => ({ ...p, [v]: e.target.value }));

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${open ? 'ring-2 ring-offset-0' : 'ring-0'}`}
      style={{ borderColor: open ? accent + '40' : '#e2e8f0', '--tw-ring-color': accent + '40' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${open ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${gradFrom} ${gradTo}`}>
          <SvcIcon code={svc.code} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-800 truncate">{svc.name}</p>
            {!svc.isActive && <span className="text-[9px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full ring-1 ring-red-100">Inactive</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ₹{rupees(svc.priceRangeMinPaise)} – ₹{rupees(svc.priceRangeMaxPaise)}
            <span className="mx-1.5 text-slate-200">·</span>~{svc.estimatedDurationMinutes}m
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tabColor} bg-opacity-10`}>Edit</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-slate-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-slate-100 bg-white space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Display Name">
                  <input value={form.name} onChange={f('name')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
                </FieldRow>
                <FieldRow label="Duration (minutes)" hint="Shown to customer as estimated time">
                  <NumInput value={form.durationMin} min="5" max="480" step="5" onChange={f('durationMin')} prefix="⏱" />
                </FieldRow>
              </div>

              <FieldRow label="Short Description" hint="Shown in the services grid">
                <textarea rows={2} value={form.description} onChange={f('description')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 resize-none" />
              </FieldRow>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
                  <Tag size={10} /> Price Range (admin-controlled)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Minimum (₹)" hint="Quote will never go below this — enforced server-side">
                    <NumInput value={form.minRs} min="0" step="10" prefix="₹" onChange={f('minRs')} />
                  </FieldRow>
                  <FieldRow label="Maximum (₹)" hint="Shown as the upper range to customers">
                    <NumInput value={form.maxRs} min="0" step="10" prefix="₹" onChange={f('maxRs')} />
                  </FieldRow>
                </div>
                <div className="flex items-start gap-1.5 mt-2 bg-amber-50 rounded-lg px-2.5 py-2 ring-1 ring-amber-100">
                  <Info size={10} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-700 leading-snug">
                    <strong>Minimum price is a hard floor.</strong> Set it to the lowest amount you ever want to charge.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1 border-t border-slate-50">
                {!form.isActive && checkActiveOrders && activeOrderCount > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">
                    <Info size={13} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      <strong>{activeOrderCount} active order{activeOrderCount !== 1 ? 's' : ''}</strong> using this service.
                      Disabling hides it from new bookings but won&apos;t affect orders in progress.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { const next = !form.isActive; setForm(p => ({ ...p, isActive: next })); if (!next) setCheckActiveOrders(true); }}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700"
                  >
                    {form.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-slate-300" />}
                    {form.isActive ? 'Active — visible to customers' : 'Inactive — hidden from catalog'}
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">Cancel</button>
                    <motion.button
                      onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${accent}ee, ${accent})` }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Changes
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
