import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Wrench, MapPin, FileText, Calendar,
  ChevronDown, Zap,
} from 'lucide-react';

const SERVICE_OPTIONS = [
  'Electrical',
  'Plumbing',
  'AC Repair',
  'Carpenter',
  'Puncture Repair',
  'Helper',
  'Cleaning',
  'Painting',
];

const SCHEDULE_OPTIONS = [
  { value: 'now',     label: 'As soon as possible' },
  { value: 'morning', label: 'Morning (8 AM – 12 PM)' },
  { value: 'afternoon', label: 'Afternoon (12 PM – 5 PM)' },
  { value: 'evening', label: 'Evening (5 PM – 9 PM)' },
];

function toTitleCase(str) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Booking() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const rawService = params.get('service') || '';
  const prefilled = toTitleCase(rawService);

  const [service, setService] = useState(prefilled || SERVICE_OPTIONS[0]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('now');

  function handleSubmit(e) {
    e.preventDefault();
    nav('/tracking/mockOrderId');
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="back-btn"
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="t-label">New Booking</p>
            <p className="font-semibold text-[#0F172A] truncate">
              {service || 'Select a service'}
            </p>
          </div>
        </div>
      </header>

      {/* Service highlight pill */}
      {service && (
        <div className="bg-zappy-600 border-b border-zappy-700">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
              <Wrench size={11} strokeWidth={2.5} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white">
              {service}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-w-lg mx-auto px-4 pt-5 pb-32 space-y-4">

          {/* Service */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zappy-50 flex items-center justify-center shrink-0">
                <Wrench size={15} strokeWidth={2} className="text-zappy-600" />
              </div>
              <p className="font-semibold text-[#0F172A] text-sm">Service</p>
            </div>

            <div className="relative">
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="input appearance-none pr-10 cursor-pointer"
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          {/* Location */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <MapPin size={15} strokeWidth={2} className="text-slate-500" />
              </div>
              <p className="font-semibold text-[#0F172A] text-sm">Service Location</p>
            </div>

            <input
              type="text"
              className="input"
              placeholder="Enter your full address"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setLocation('Using current location')}
              className="flex items-center gap-2 text-xs font-semibold text-zappy-600 hover:text-zappy-700 transition-colors"
            >
              <MapPin size={12} strokeWidth={2.5} />
              Use my current location
            </button>
          </div>

          {/* Description */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <FileText size={15} strokeWidth={2} className="text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-[#0F172A] text-sm">Describe the Issue</p>
                <p className="text-xs text-slate-400 mt-0.5">Help the worker prepare</p>
              </div>
            </div>

            <textarea
              rows={4}
              className="input resize-none"
              placeholder="e.g. Kitchen tap is leaking near the sink, water dripping continuously…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Schedule */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Calendar size={15} strokeWidth={2} className="text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-[#0F172A] text-sm">Schedule</p>
                <p className="text-xs text-slate-400 mt-0.5">Optional — defaults to ASAP</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SCHEDULE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSchedule(value)}
                  className={`px-3 py-2.5 rounded-btn text-xs font-semibold text-left leading-snug transition-all ${
                    schedule === value
                      ? 'bg-zappy-600 text-white shadow-soft'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary strip */}
          {(service || location) && (
            <div className="bg-slate-100 rounded-card px-4 py-3 space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Booking Summary</p>
              {service && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Service</span>
                  <span className="font-semibold text-[#0F172A]">{service}</span>
                </div>
              )}
              {location && (
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-slate-500 shrink-0">Location</span>
                  <span className="font-semibold text-[#0F172A] text-right truncate">{location}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Schedule</span>
                <span className="font-semibold text-[#0F172A]">
                  {SCHEDULE_OPTIONS.find((o) => o.value === schedule)?.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Fixed CTA */}
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
          <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
            <button type="submit" className="btn-success w-full text-[15px]">
              <Zap size={16} strokeWidth={2.5} />
              Confirm Booking
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
