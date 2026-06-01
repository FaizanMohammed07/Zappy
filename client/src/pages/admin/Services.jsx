import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Home, Car, Plus, Trash2, Edit2, Save, X,
  ChevronDown, ChevronUp, CheckCircle, Loader2, Battery,
  Clock, Shield, Percent, DollarSign, Zap, Wrench, Droplets,
  Bolt, Wind, Hammer, Users, Sparkles, Paintbrush2, TrendingUp,
  Info, Moon, ChevronRight, ToggleLeft, ToggleRight, Tag, Star,
} from 'lucide-react';
import {
  useAdminGetCatalogServicesQuery,
  useAdminUpdateCatalogServiceMutation,
  useAdminGetVerticalsQuery,
  useAdminUpdateVerticalMutation,
  useAdminAddSparePartMutation,
  useAdminUpdateSparePartMutation,
  useAdminRemoveSparePartMutation,
  useGetPricingConfigQuery,
  useAdminUpdatePricingMutation,
  useAdminTogglesMutation,
  useAdminServiceActiveOrderCountQuery,
} from '../../services/api';
import toast from 'react-hot-toast';

/* ─── Tabs ─────────────────────────────────────────────────────────────── */
const TABS = [
  { key: 'home',         label: 'Home Services',  Icon: Home,       color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200', accent: '#7c3aed', gradFrom: 'from-violet-500', gradTo: 'to-purple-600' },
  { key: 'mobile',       label: 'Mobile Phone',   Icon: Smartphone, color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200', accent: '#4f46e5', gradFrom: 'from-indigo-500', gradTo: 'to-blue-600'   },
  { key: 'construction', label: 'Construction',   Icon: Wrench,     color: 'text-stone-600',   bg: 'bg-stone-50',   border: 'border-stone-200',  accent: '#78716c', gradFrom: 'from-stone-500',  gradTo: 'to-slate-600'  },
  { key: 'vehicle',      label: 'Car & Bike',     Icon: Car,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',   accent: '#2563eb', gradFrom: 'from-blue-500',   gradTo: 'to-cyan-600'   },
];

/* ─── Category → vertical key mapping ─────────────────────────────────── */
const CAT_MAP = {
  home: ['home', 'helper', 'beauty', 'other'],
  mobile: ['mobile'],
  construction: ['construction'],
  vehicle: ['vehicle'],
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function rupees(p) { return p != null ? Math.round(p / 100) : 0; }
function paise(r)  { return Math.round(Number(r) * 100); }

const SVC_ICONS = {
  electrical: Bolt, plumbing: Droplets, ac_repair: Wind,
  carpenter: Hammer, helper: Users, cleaning: Sparkles,
  painting: Paintbrush2, screen_replacement: Smartphone,
  battery_replacement: Battery, charging_issue: Bolt,
  speaker_mic_issue: Wrench, software_issue: Wrench,
  water_damage_check: Droplets, mason: Home, puncture: Car,
  battery_jump_start: Zap, fuel_delivery: Car, bike_wash: Car,
  car_wash: Car, minor_roadside_repair: Car,
};

function SvcIcon({ code, className = '' }) {
  const Icon = SVC_ICONS[code] || Wrench;
  return <Icon size={14} strokeWidth={2} className={className} />;
}

function NumInput({ value, onChange, step = '1', min = '0', max, prefix, className = '' }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">{prefix}</span>
      )}
      <input
        type="number" value={value} onChange={onChange}
        step={step} min={min} max={max}
        className={`w-full border border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none ${prefix ? 'pl-7 pr-3 py-2' : 'px-3 py-2'} ${className}`}
      />
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
      {hint && <p className="text-[9px] text-slate-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function InfoBox({ children, variant = 'blue' }) {
  const s = { blue: 'bg-blue-50 text-blue-700 ring-blue-100', violet: 'bg-violet-50 text-violet-700 ring-violet-100', stone: 'bg-stone-50 text-stone-700 ring-stone-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100' };
  return <div className={`rounded-xl p-3 text-xs ring-1 space-y-1 ${s[variant]}`}>{children}</div>;
}

/* ════════════════════════════════════════════════════════════════════════
   PER-SERVICE PRICING CARD
   Click to expand → edit min/max price, duration, toggle active, save
════════════════════════════════════════════════════════════════════════ */
function ServicePricingCard({ svc, accent, gradFrom, gradTo, tabColor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: svc.name,
    description: svc.description || '',
    minRs: rupees(svc.priceRangeMinPaise),
    maxRs: rupees(svc.priceRangeMaxPaise),
    durationMin: svc.estimatedDurationMinutes,
    isActive: svc.isActive,
  });
  const [updateSvc, { isLoading: saving }] = useAdminUpdateCatalogServiceMutation();
  // Lazy-loaded only when admin tries to disable an active service
  const [checkActiveOrders, setCheckActiveOrders] = useState(false);
  const { data: activeOrderData } = useAdminServiceActiveOrderCountQuery(svc.code, {
    skip: !checkActiveOrders,
  });
  const activeOrderCount = activeOrderData?.activeOrderCount ?? 0;

  // Keep form in sync if parent data refreshes
  useEffect(() => {
    setForm({
      name: svc.name,
      description: svc.description || '',
      minRs: rupees(svc.priceRangeMinPaise),
      maxRs: rupees(svc.priceRangeMaxPaise),
      durationMin: svc.estimatedDurationMinutes,
      isActive: svc.isActive,
    });
  }, [svc]);

  async function handleSave() {
    try {
      await updateSvc({
        code: svc.code,
        name: form.name,
        description: form.description,
        priceRangeMinRs: form.minRs,
        priceRangeMaxRs: form.maxRs,
        estimatedDurationMinutes: form.durationMin,
        isActive: form.isActive,
      }).unwrap();
      toast.success(`${svc.name} pricing saved`);
      setOpen(false);
    } catch { toast.error('Save failed'); }
  }

  const f = v => e => setForm(p => ({ ...p, [v]: e.target.value }));

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${open ? 'ring-2 ring-offset-0' : 'ring-0'}`}
      style={{ borderColor: open ? accent + '40' : '#e2e8f0', '--tw-ring-color': accent + '40' }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${open ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
      >
        {/* Icon badge */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${gradFrom} ${gradTo}`}
        >
          <SvcIcon code={svc.code} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-800 truncate">{svc.name}</p>
            {!svc.isActive && (
              <span className="text-[9px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full ring-1 ring-red-100">Inactive</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ₹{rupees(svc.priceRangeMinPaise)} – ₹{rupees(svc.priceRangeMaxPaise)}
            <span className="mx-1.5 text-slate-200">·</span>
            ~{svc.estimatedDurationMinutes}m
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tabColor} bg-opacity-10`}>Edit</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-slate-400" />
          </motion.div>
        </div>
      </button>

      {/* Expanded edit panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-slate-100 bg-white space-y-4">
              {/* Name & description */}
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Display Name">
                  <input
                    value={form.name}
                    onChange={f('name')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                </FieldRow>
                <FieldRow label="Duration (minutes)" hint="Shown to customer as estimated time">
                  <NumInput value={form.durationMin} min="5" max="480" step="5" onChange={f('durationMin')} prefix="⏱" />
                </FieldRow>
              </div>

              <FieldRow label="Short Description" hint="Shown in the services grid">
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={f('description')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 resize-none"
                />
              </FieldRow>

              {/* Price range */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
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
                    <strong>Minimum price is a hard floor.</strong> The server-side quote formula (base + distance + time) will never return a value below this — even for nearby bookings. Set it to the lowest amount you ever want to charge.
                  </p>
                </div>
              </div>

              {/* Active toggle + save */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-50">
                {/* Warning: active orders exist for this service */}
                {!form.isActive && checkActiveOrders && activeOrderCount > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">
                    <Info size={13} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      <strong>{activeOrderCount} active order{activeOrderCount !== 1 ? 's' : ''}</strong> are currently using this service.
                      Disabling it hides it from new bookings but won&apos;t affect orders already in progress.
                    </p>
                  </div>
                )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const next = !form.isActive;
                    setForm(p => ({ ...p, isActive: next }));
                    // Trigger active-order check when admin switches to inactive
                    if (!next) setCheckActiveOrders(true);
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  {form.isActive
                    ? <ToggleRight size={20} className="text-green-500" />
                    : <ToggleLeft size={20} className="text-slate-300" />}
                  {form.isActive ? 'Active — visible to customers' : 'Inactive — hidden from catalog'}
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                    Cancel
                  </button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${accent}ee, ${accent})` }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save Changes
                  </motion.button>
                </div>
              </div>
              </div> {/* closes flex flex-col gap-2 */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CATEGORY-LEVEL PRICING PANELS (collapsed by default)
════════════════════════════════════════════════════════════════════════ */
function HomeCategoryPanel() {
  const { data, isLoading } = useGetPricingConfigQuery();
  const [updatePricing, { isLoading: savingFares }] = useAdminUpdatePricingMutation();
  const [setToggles,    { isLoading: savingToggles }] = useAdminTogglesMutation();
  const [open, setOpen] = useState(false);

  const [fares, setFares] = useState({ baseFee: 35, perKmFee: 12, perMinFee: 2, platformFee: 15, minFare: 60, surgeMaxMultiplier: 2.5 });
  const [controls, setControls] = useState({ surgeEnabled: true, surgeMaxCap: 2.5, commissionRate: 0.30 });

  useEffect(() => {
    const p = data?.pricing;
    if (!p) return;
    setFares({ baseFee: (p.baseFeePaise ?? 3500) / 100, perKmFee: (p.perKmFeePaise ?? 1200) / 100, perMinFee: (p.perMinFeePaise ?? 200) / 100, platformFee: (p.platformFeePaise ?? 1500) / 100, minFare: (p.minFarePaise ?? 6000) / 100, surgeMaxMultiplier: p.surgeMaxCap ?? 2.5 });
    setControls({ surgeEnabled: p.surgeEnabled ?? true, surgeMaxCap: p.surgeMaxCap ?? 2.5, commissionRate: p.commissionRate ?? 0.30 });
  }, [data]);

  async function saveFares() {
    try {
      await updatePricing({ baseFeePaise: Math.round(fares.baseFee * 100), perKmFeePaise: Math.round(fares.perKmFee * 100), perMinFeePaise: Math.round(fares.perMinFee * 100), platformFeePaise: Math.round(fares.platformFee * 100), minFarePaise: Math.round(fares.minFare * 100), surgeMaxCap: fares.surgeMaxMultiplier }).unwrap();
      toast.success('Fare formula saved');
    } catch { toast.error('Save failed'); }
  }

  async function saveControls() {
    try { await setToggles(controls).unwrap(); toast.success('Controls saved'); }
    catch { toast.error('Save failed'); }
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
        <span className="flex items-center gap-2"><DollarSign size={15} className="text-violet-600" /> Category Pricing Formula & Controls</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} className="text-slate-400" /></motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-5">
              {isLoading ? <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : (
                <>
                  <InfoBox variant="violet">
                    <p><strong>Formula:</strong> (Base + Distance × PerKm + ETA × PerMin + Platform) × Surge × Service Multiplier</p>
                    <p>Service multipliers: Electrical 1.2× · Carpenter 1.3× · AC Repair 1.5× · Painting 1.4× · Helper 0.9×</p>
                  </InfoBox>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { key: 'baseFee', label: 'Base Fee (₹)', step: '1' },
                      { key: 'perKmFee', label: 'Per KM (₹)', step: '0.5' },
                      { key: 'perMinFee', label: 'Per Min (₹)', step: '0.5' },
                      { key: 'platformFee', label: 'Platform Fee (₹)', step: '1' },
                      { key: 'minFare', label: 'Min Fare (₹)', step: '5' },
                      { key: 'surgeMaxMultiplier', label: 'Surge Cap ×', step: '0.1', min: '1', max: '10' },
                    ].map(({ key, label, step, min = '0', max }) => (
                      <FieldRow key={key} label={label}>
                        <NumInput value={fares[key] ?? ''} step={step} min={min} max={max} prefix="₹" onChange={e => setFares(f => ({ ...f, [key]: Number(e.target.value) }))} />
                      </FieldRow>
                    ))}
                  </div>
                  <motion.button onClick={saveFares} disabled={savingFares} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.96 }}>
                    {savingFares ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Formula
                  </motion.button>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-3 gap-4">
                    <FieldRow label="Surge Pricing">
                      <button onClick={() => setControls(p => ({ ...p, surgeEnabled: !p.surgeEnabled }))} className={`mt-1 relative inline-flex w-10 h-5 rounded-full transition-colors ${controls.surgeEnabled ? 'bg-violet-600' : 'bg-slate-200'}`}>
                        <span className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5" style={{ transform: controls.surgeEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                      </button>
                    </FieldRow>
                    <FieldRow label="Surge Cap">
                      <NumInput value={controls.surgeMaxCap} min="1" max="5" step="0.1" onChange={e => setControls(p => ({ ...p, surgeMaxCap: Number(e.target.value) }))} />
                    </FieldRow>
                    <FieldRow label="Commission Rate">
                      <div className="flex items-center gap-2">
                        <NumInput value={controls.commissionRate} min="0" max="0.5" step="0.01" onChange={e => setControls(p => ({ ...p, commissionRate: Number(e.target.value) }))} />
                        <span className="text-sm font-black text-slate-700 w-10 shrink-0">{(controls.commissionRate * 100).toFixed(0)}%</span>
                      </div>
                    </FieldRow>
                  </div>
                  <motion.button onClick={saveControls} disabled={savingToggles} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.96 }}>
                    {savingToggles ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Controls
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileCategoryPanel({ config, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ inspectionFeePaise: config?.inspectionFeePaise ?? 15000, urgentSurchargePaise: config?.urgentSurchargePaise ?? 10000, warrantyDays: config?.warrantyDays ?? 30 });
  const [addPart, setAddPart] = useState(false);
  const [newPart, setNewPart] = useState({ brand: 'Apple', service: 'screen_replacement', model: 'all', costRs: '' });
  const [editPart, setEditPart] = useState(null);
  const [doAdd] = useAdminAddSparePartMutation();
  const [doRemove] = useAdminRemoveSparePartMutation();
  const [doUpdate] = useAdminUpdateSparePartMutation();
  const BRANDS = ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Others'];
  const MOBILE_SVC = { screen_replacement: 'Screen Replacement', battery_replacement: 'Battery Replacement', charging_issue: 'Charging Issue', speaker_mic_issue: 'Speaker/Mic', software_issue: 'Software Issue', water_damage_check: 'Water Damage' };
  const spareParts = config?.spareParts || [];

  useEffect(() => {
    if (config) setForm({ inspectionFeePaise: config.inspectionFeePaise ?? 15000, urgentSurchargePaise: config.urgentSurchargePaise ?? 10000, warrantyDays: config.warrantyDays ?? 30 });
  }, [config]);

  async function addPartHandler() {
    try { await doAdd({ ...newPart, costPaise: paise(newPart.costRs || 0) }).unwrap(); toast.success('Spare part added'); setAddPart(false); setNewPart({ brand: 'Apple', service: 'screen_replacement', model: 'all', costRs: '' }); }
    catch { toast.error('Failed'); }
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
        <span className="flex items-center gap-2"><DollarSign size={15} className="text-indigo-600" /> Category Fees & Spare Parts</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} className="text-slate-400" /></motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              <InfoBox variant="blue">
                <p><strong>Formula:</strong> Inspection Fee + Labor (mid-range) + Spare Part Cost + [Urgent Surcharge]</p>
              </InfoBox>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'inspectionFeePaise', label: 'Inspection Fee (₹)', isPaise: true },
                  { key: 'urgentSurchargePaise', label: 'Urgent Surcharge (₹)', isPaise: true },
                  { key: 'warrantyDays', label: 'Warranty (days)', isPaise: false },
                ].map(({ key, label, isPaise }) => (
                  <FieldRow key={key} label={label}>
                    <NumInput prefix={isPaise ? '₹' : '📅'} value={isPaise ? rupees(form[key]) : form[key]} onChange={e => setForm(f => ({ ...f, [key]: isPaise ? paise(e.target.value) : Number(e.target.value) }))} />
                  </FieldRow>
                ))}
              </div>
              <motion.button onClick={() => onSave('mobile', form)} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.96 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Fees
              </motion.button>

              {/* Spare parts */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Battery size={12} /> Spare Part Pricing ({spareParts.length} entries)</p>
                  {!addPart && <button onClick={() => setAddPart(true)} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus size={11} /> Add</button>}
                </div>
                {addPart && (
                  <div className="bg-indigo-50 rounded-xl p-3 mb-3 space-y-2 ring-1 ring-indigo-100">
                    <div className="grid grid-cols-2 gap-2">
                      <FieldRow label="Brand"><select value={newPart.brand} onChange={e => setNewPart(p => ({ ...p, brand: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-white">{BRANDS.map(b => <option key={b}>{b}</option>)}</select></FieldRow>
                      <FieldRow label="Service"><select value={newPart.service} onChange={e => setNewPart(p => ({ ...p, service: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-white">{Object.entries(MOBILE_SVC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FieldRow>
                      <FieldRow label="Model (or 'all')"><input value={newPart.model} onChange={e => setNewPart(p => ({ ...p, model: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none" /></FieldRow>
                      <FieldRow label="Part Cost (₹)"><input type="number" value={newPart.costRs} onChange={e => setNewPart(p => ({ ...p, costRs: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none" /></FieldRow>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addPartHandler} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"><Save size={10} /> Add</button>
                      <button onClick={() => setAddPart(false)} className="px-3 py-1 bg-slate-100 text-xs font-bold rounded-lg"><X size={10} /></button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100"><th className="text-left py-1.5 pr-2">Brand</th><th className="text-left py-1.5 pr-2">Service</th><th className="text-left py-1.5 pr-2">Model</th><th className="text-right py-1.5 pr-2">₹</th><th className="text-center py-1.5 pr-2">Active</th><th className="text-right py-1.5" /></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {spareParts.map(sp => (
                        <tr key={sp._id} className="hover:bg-slate-50">
                          {editPart === sp._id ? (
                            <td colSpan={6} className="py-1.5">
                              <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-2 py-1.5 flex-wrap">
                                <span className="text-xs text-slate-600">{sp.brand} · {MOBILE_SVC[sp.service] || sp.service} · {sp.model}</span>
                                <input type="number" defaultValue={rupees(sp.costPaise)} id={`ep-${sp._id}`} className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg" />
                                <button onClick={() => doUpdate({ sparePartId: sp._id, costPaise: paise(document.getElementById(`ep-${sp._id}`).value) }).unwrap().then(() => { toast.success('Updated'); setEditPart(null); }).catch(() => toast.error('Failed'))} className="px-2 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-0.5"><Save size={10} /></button>
                                <button onClick={() => setEditPart(null)} className="px-2 py-1 bg-slate-100 text-xs rounded-lg"><X size={10} /></button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-1.5 pr-2 font-medium">{sp.brand}</td>
                              <td className="py-1.5 pr-2 text-slate-500">{MOBILE_SVC[sp.service] || sp.service}</td>
                              <td className="py-1.5 pr-2 text-slate-400 italic">{sp.model}</td>
                              <td className="py-1.5 pr-2 text-right font-bold">₹{rupees(sp.costPaise)}</td>
                              <td className="py-1.5 pr-2 text-center">{sp.isActive ? <CheckCircle size={11} className="text-green-500 mx-auto" /> : <X size={11} className="text-red-400 mx-auto" />}</td>
                              <td className="py-1.5 text-right space-x-1">
                                <button onClick={() => setEditPart(sp._id)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={10} /></button>
                                <button onClick={() => window.confirm('Remove?') && doRemove(sp._id).unwrap().then(() => toast.success('Removed')).catch(() => toast.error('Failed'))} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={10} /></button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {spareParts.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-400 italic text-xs">No spare part pricing yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConstructionCategoryPanel({ config, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ visitFeePaise: config?.visitFeePaise ?? 10000, perHourFeePaise: config?.perHourFeePaise ?? 40000, materialMarkupPct: config?.materialMarkupPct ?? 15, urgentSurchargePct: config?.urgentSurchargePct ?? 20 });
  useEffect(() => { if (config) setForm({ visitFeePaise: config.visitFeePaise ?? 10000, perHourFeePaise: config.perHourFeePaise ?? 40000, materialMarkupPct: config.materialMarkupPct ?? 15, urgentSurchargePct: config.urgentSurchargePct ?? 20 }); }, [config]);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
        <span className="flex items-center gap-2"><DollarSign size={15} className="text-stone-600" /> Category Pricing Configuration</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} className="text-slate-400" /></motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              <InfoBox variant="stone">
                <p><strong>Standard:</strong> Visit fee + flat labor (≈1.5× hourly) · <strong>Hourly:</strong> Visit fee + hours × rate · <strong>Project:</strong> Visit fee only (admin quotes later)</p>
              </InfoBox>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'visitFeePaise', label: 'Site Visit Fee (₹)', isPaise: true },
                  { key: 'perHourFeePaise', label: 'Hourly Rate (₹/hr)', isPaise: true },
                  { key: 'materialMarkupPct', label: 'Material Markup (%)', isPaise: false },
                  { key: 'urgentSurchargePct', label: 'Urgent Surcharge (%)', isPaise: false },
                ].map(({ key, label, isPaise }) => (
                  <FieldRow key={key} label={label}>
                    <NumInput prefix={isPaise ? '₹' : '%'} value={isPaise ? rupees(form[key]) : form[key]} onChange={e => setForm(f => ({ ...f, [key]: isPaise ? paise(e.target.value) : Number(e.target.value) }))} />
                  </FieldRow>
                ))}
              </div>
              <motion.button onClick={() => onSave('construction', form)} disabled={saving} className="px-4 py-2 bg-stone-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.96 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Configuration
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VehicleCategoryPanel({ config, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ baseVisitFeePaise: config?.baseVisitFeePaise ?? 5000, perKmFeePaise: config?.perKmFeePaise ?? 1500, emergencySurchargePaise: config?.emergencySurchargePaise ?? 10000, nightSurchargePaise: config?.nightSurchargePaise ?? 8000, nightStartHour: config?.nightStartHour ?? 22, nightEndHour: config?.nightEndHour ?? 6 });
  useEffect(() => { if (config) setForm({ baseVisitFeePaise: config.baseVisitFeePaise ?? 5000, perKmFeePaise: config.perKmFeePaise ?? 1500, emergencySurchargePaise: config.emergencySurchargePaise ?? 10000, nightSurchargePaise: config.nightSurchargePaise ?? 8000, nightStartHour: config.nightStartHour ?? 22, nightEndHour: config.nightEndHour ?? 6 }); }, [config]);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
        <span className="flex items-center gap-2"><DollarSign size={15} className="text-blue-600" /> Category Pricing Configuration</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} className="text-slate-400" /></motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              <InfoBox variant="blue">
                <p><strong>Formula:</strong> Base visit fee + (Distance km × per km fee) + [Emergency surcharge] + [Night surcharge]</p>
                <p>Night surcharge is server-side evaluated. Currently: {form.nightStartHour}:00 – {form.nightEndHour}:00</p>
              </InfoBox>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'baseVisitFeePaise', label: 'Base Visit Fee (₹)', isPaise: true },
                  { key: 'perKmFeePaise', label: 'Per KM Fee (₹)', isPaise: true },
                  { key: 'emergencySurchargePaise', label: 'Emergency Surcharge (₹)', isPaise: true },
                  { key: 'nightSurchargePaise', label: 'Night Surcharge (₹)', isPaise: true },
                ].map(({ key, label, isPaise }) => (
                  <FieldRow key={key} label={label}>
                    <NumInput prefix="₹" value={isPaise ? rupees(form[key]) : form[key]} onChange={e => setForm(f => ({ ...f, [key]: isPaise ? paise(e.target.value) : Number(e.target.value) }))} />
                  </FieldRow>
                ))}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-100">
                <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1 mb-2"><Moon size={10} className="text-indigo-400" /> Night Window (24-hr)</p>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Night Starts (hour)"><NumInput value={form.nightStartHour} min="0" max="23" onChange={e => setForm(f => ({ ...f, nightStartHour: parseInt(e.target.value, 10) }))} /></FieldRow>
                  <FieldRow label="Night Ends (hour)"><NumInput value={form.nightEndHour} min="0" max="23" onChange={e => setForm(f => ({ ...f, nightEndHour: parseInt(e.target.value, 10) }))} /></FieldRow>
                </div>
              </div>
              <motion.button onClick={() => onSave('vehicle', form)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.96 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Configuration
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN PANEL
════════════════════════════════════════════════════════════════════════ */
export default function Services() {
  const [activeTab, setActiveTab] = useState('vehicle');
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');

  const { data: catalogData, isLoading: catalogLoading } = useAdminGetCatalogServicesQuery();
  const { data: verticalData, isLoading: verticalLoading, refetch } = useAdminGetVerticalsQuery();
  const [doUpdate] = useAdminUpdateVerticalMutation();

  const allServices = catalogData?.services || [];
  const configs = verticalData?.configs || {};

  const currentTab = TABS.find(t => t.key === activeTab);

  // Filter services belonging to the active tab's categories
  const tabServices = allServices.filter(s => CAT_MAP[activeTab]?.includes(s.category));
  const filteredServices = search.trim()
    ? tabServices.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    : tabServices;

  async function handleVerticalSave(vertical, patch) {
    setSaving(true);
    try { await doUpdate({ vertical, ...patch }).unwrap(); toast.success(`${vertical} pricing saved`); refetch(); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  const isLoading = catalogLoading || verticalLoading;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Pricing Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">Click any service to edit its pricing. Category-level settings apply as the base formula for all services in that group.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, Icon, color, bg, border }) => (
          <motion.button
            key={key}
            onClick={() => { setActiveTab(key); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
              activeTab === key ? `${bg} ${color} ${border} shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            whileTap={{ scale: 0.96 }}
          >
            <Icon size={15} />
            {label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="space-y-4"
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search in ${currentTab?.label}…`} className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500"><X size={14} /></button>}
          </div>

          {/* Per-service pricing cards */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} — click to edit pricing
                </p>
              </div>

              {filteredServices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {search ? `No services matching "${search}"` : 'No services in this category yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredServices.map(svc => (
                    <ServicePricingCard
                      key={svc._id}
                      svc={svc}
                      accent={currentTab?.accent}
                      gradFrom={currentTab?.gradFrom}
                      gradTo={currentTab?.gradTo}
                      tabColor={currentTab?.color}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category-level config (collapsed accordion) */}
          {!isLoading && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category-level pricing formula</p>
              {activeTab === 'home'         && <HomeCategoryPanel />}
              {activeTab === 'mobile'       && <MobileCategoryPanel config={configs.mobile} onSave={handleVerticalSave} saving={saving} />}
              {activeTab === 'construction' && <ConstructionCategoryPanel config={configs.construction} onSave={handleVerticalSave} saving={saving} />}
              {activeTab === 'vehicle'      && <VehicleCategoryPanel config={configs.vehicle} onSave={handleVerticalSave} saving={saving} />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
