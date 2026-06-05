import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PawPrint, Clock, MapPin, Stethoscope, Car, Star,
  ToggleLeft, ToggleRight, Rocket, Calendar, AlertTriangle,
  ChevronDown, ChevronUp, Settings, Users, DollarSign,
  Shield, Zap, Eye, EyeOff, Info,
} from 'lucide-react';

/* ─── Static service definitions (pre-configured, not live) ─────────────── */
const SERVICES = [
  {
    id: 'grooming',
    label: 'Grooming',
    icon: '✂️',
    duration: '60 mins',
    description: 'Full bath, blow-dry, nail trimming, ear cleaning, fur styling.',
    gpsTracked: true,
    pricingModel: 'fixed',
    estimatedBasePrice: 499,
    enabled: true,
  },
  {
    id: 'walking',
    label: 'Walking',
    icon: '🦮',
    duration: '20–60 mins',
    description: 'Certified walker picks up your pet, GPS live-tracked walk.',
    gpsTracked: true,
    pricingModel: 'per-minute',
    estimatedBasePrice: 99,
    enabled: true,
  },
  {
    id: 'pet-sitting',
    label: 'Pet Sitting',
    icon: '🏠',
    duration: '2–12 hrs',
    description: "Sitter comes home or pet stays at verified sitter's place.",
    gpsTracked: false,
    pricingModel: 'per-hour',
    estimatedBasePrice: 199,
    enabled: true,
  },
  {
    id: 'vet-help',
    label: 'Vet Help',
    icon: '🩺',
    duration: 'On-demand',
    description: 'Certified vet visits home or video consultation.',
    gpsTracked: false,
    pricingModel: 'fixed',
    estimatedBasePrice: 799,
    enabled: true,
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: '🚗',
    duration: 'Distance-based',
    description: 'Pet-safe vehicle to vet, groomer, or boarding facility.',
    gpsTracked: true,
    pricingModel: 'per-km',
    estimatedBasePrice: 49,
    enabled: false,
  },
];

const PRICING_LABELS = {
  'fixed': 'Fixed Price',
  'per-minute': 'Per Minute',
  'per-hour': 'Per Hour',
  'per-km': 'Per KM',
};

const PHASES = [
  { phase: 'Phase 1', label: 'Grooming + Walking', status: 'planned', quarter: 'Q3 2026' },
  { phase: 'Phase 2', label: 'Pet Sitting + Vet Help', status: 'planned', quarter: 'Q4 2026' },
  { phase: 'Phase 3', label: 'Transport + Subscriptions', status: 'planned', quarter: 'Q1 2027' },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function PetAssistance() {
  const [published, setPublished]       = useState(false);
  const [services, setServices]         = useState(SERVICES);
  const [expandedId, setExpandedId]     = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [notes, setNotes]               = useState('');

  function toggleService(id) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function handlePublishToggle() {
    if (!published) { setConfirmPublish(true); return; }
    setPublished(false);
  }

  const enabledCount = services.filter(s => s.enabled).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl">🐾</div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Pet Assistance</h1>
            <p className="text-sm text-slate-500">GPS-tracked pet care — grooming, walking, vet, transport</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {published ? 'LIVE' : 'NOT PUBLISHED'}
          </span>
          <button
            onClick={handlePublishToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              published
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {published ? <EyeOff size={15} /> : <Eye size={15} />}
            {published ? 'Unpublish' : 'Publish Feature'}
          </button>
        </div>
      </div>

      {/* Publish Confirm Modal */}
      {confirmPublish && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <h3 className="font-black text-slate-900">Publish Pet Assistance?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              This will make Pet Assistance visible to all users on the home screen.
              Ensure backend APIs, worker onboarding, and payment flows are ready before going live.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmPublish(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => { setPublished(true); setConfirmPublish(false); }}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
                Yes, Publish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Warning banner when not published */}
      {!published && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Feature not live</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This page is for pre-configuration only. Pet Assistance will not appear on the user app until published.
              Pre-configure services, pricing, and settings below before launch.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Services',    value: services.length,  icon: PawPrint,  color: 'violet' },
          { label: 'Enabled',           value: enabledCount,     icon: ToggleRight, color: 'emerald' },
          { label: 'GPS Tracked',       value: services.filter(s => s.gpsTracked).length, icon: MapPin, color: 'blue' },
          { label: 'Launch Phase',      value: 'Q3 2026',        icon: Rocket,    color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-xl bg-${color}-100 flex items-center justify-center mb-2`}>
              <Icon size={16} className={`text-${color}-600`} />
            </div>
            <p className="text-lg font-black text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Services list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Settings size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-800 text-sm">Service Configuration</h2>
        </div>

        <div className="divide-y divide-slate-50">
          {services.map(svc => (
            <div key={svc.id}>
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="text-2xl">{svc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm">{svc.label}</p>
                    {svc.gpsTracked && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <MapPin size={9} /> GPS
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock size={9} /> {svc.duration}
                    </span>
                    <span className="text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      {PRICING_LABELS[svc.pricingModel]} · ₹{svc.estimatedBasePrice}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{svc.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setExpandedId(expandedId === svc.id ? null : svc.id)}
                    className="text-slate-400 hover:text-slate-600">
                    {expandedId === svc.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button onClick={() => toggleService(svc.id)}
                    className={`transition-colors ${svc.enabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {svc.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                </div>
              </div>

              {/* Expanded config */}
              {expandedId === svc.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pricing Model</p>
                      <select
                        value={svc.pricingModel}
                        onChange={e => setServices(prev => prev.map(s => s.id === svc.id ? { ...s, pricingModel: e.target.value } : s))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                        <option value="fixed">Fixed Price</option>
                        <option value="per-minute">Per Minute</option>
                        <option value="per-hour">Per Hour</option>
                        <option value="per-km">Per KM</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Base Price (₹)</p>
                      <input
                        type="number"
                        value={svc.estimatedBasePrice}
                        onChange={e => setServices(prev => prev.map(s => s.id === svc.id ? { ...s, estimatedBasePrice: Number(e.target.value) } : s))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={svc.gpsTracked}
                          onChange={() => setServices(prev => prev.map(s => s.id === svc.id ? { ...s, gpsTracked: !s.gpsTracked } : s))}
                          className="rounded"
                        />
                        <span className="text-xs font-semibold text-slate-700">GPS Tracked</span>
                      </label>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3 flex items-center gap-1.5">
                    <Info size={11} /> Configuration saved locally. Will take effect when feature is published.
                  </p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Feature flags */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Zap size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-800 text-sm">Feature Flags</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { id: 'gps_tracking',       label: 'Live GPS Tracking',             desc: 'Real-time worker location during service',   on: true },
            { id: 'pet_insurance',      label: 'Pet Insurance Integration',     desc: 'Optional insurance upsell at checkout',       on: false },
            { id: 'subscription_plans', label: 'Subscription Plans',            desc: 'Monthly grooming / walking bundles',           on: false },
            { id: 'multi_pet',          label: 'Multi-Pet Booking',             desc: 'Book for multiple pets in one order',         on: false },
            { id: 'worker_ratings',     label: 'Worker Specialization Badges',  desc: 'Certified groomer, vet-tech etc.',            on: true },
          ].map(flag => (
            <FlagRow key={flag.id} flag={flag} />
          ))}
        </div>
      </div>

      {/* Launch roadmap */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Rocket size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-800 text-sm">Launch Roadmap</h2>
        </div>
        <div className="p-5 space-y-3">
          {PHASES.map((p, i) => (
            <div key={p.phase} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-black text-violet-600">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">{p.phase} — {p.label}</p>
                <p className="text-xs text-slate-400">{p.quarter}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">Planned</span>
            </div>
          ))}
        </div>
      </div>

      {/* Planning notes */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Info size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-800 text-sm">Planning Notes</h2>
        </div>
        <div className="p-5">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add internal notes — worker onboarding plan, city rollout strategy, pricing research, dependencies…"
            rows={4}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-700 placeholder:text-slate-300"
          />
          <p className="text-[11px] text-slate-400 mt-2">Notes are saved locally in this session. Backend persistence will be wired when feature goes to development.</p>
        </div>
      </div>

    </div>
  );
}

function FlagRow({ flag }) {
  const [on, setOn] = useState(flag.on);
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{flag.label}</p>
        <p className="text-xs text-slate-400">{flag.desc}</p>
      </div>
      <button onClick={() => setOn(v => !v)} className={`transition-colors ${on ? 'text-emerald-500' : 'text-slate-300'}`}>
        {on ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
      </button>
    </div>
  );
}
