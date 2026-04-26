import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, MapPin, FileText, BadgeIndianRupee, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import {
  useGetOrderQuery, useWorkerStartTripMutation, useWorkerArriveMutation,
  useWorkerStartServiceMutation, useWorkerCompleteMutation,
} from '../services/api';
import { useOrderSocket } from '../hooks/useSocket';
import { useSelector } from 'react-redux';
import { selectOrder } from '../modules/order/orderSlice';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  assigned:    { label: 'Assigned',       cls: 'chip-blue' },
  on_the_way:  { label: 'On the Way',     cls: 'chip-blue' },
  arrived:     { label: 'Arrived',        cls: 'chip-accent' },
  in_progress: { label: 'In Progress',    cls: 'chip-success' },
  completed:   { label: 'Completed',      cls: 'chip-success' },
  cancelled:   { label: 'Cancelled',      cls: 'chip-red' },
};

export default function WorkerJobPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, refetch } = useGetOrderQuery(id);
  const [startTrip,   { isLoading: starting }]       = useWorkerStartTripMutation();
  const [arrive,      { isLoading: arriving }]        = useWorkerArriveMutation();
  const [startService,{ isLoading: startingService }] = useWorkerStartServiceMutation();
  const [complete,    { isLoading: completing }]      = useWorkerCompleteMutation();
  const [otp, setOtp] = useState('');

  useOrderSocket(id);
  const live = useSelector(selectOrder);

  const order = data?.order;
  if (!order) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 size={28} className="text-zappy-600 animate-spin" />
      </div>
    );
  }

  const status = live.activeOrderId === order._id ? live.status || order.status : order.status;
  const chipCfg = STATUS_CONFIG[status] || { label: status, cls: 'chip-neutral' };
  const [lng, lat] = order.pickupLocation.coordinates;
  const pickup = { lat, lng };
  const terminal = ['completed', 'cancelled', 'failed'].includes(status);

  function openNavigation() {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
  }

  async function onStartTrip() {
    try { await startTrip(id).unwrap(); toast.success('Trip started'); refetch(); }
    catch (err) { toast.error(err.data?.error || 'Failed'); }
  }
  async function onArrive() {
    try { await arrive(id).unwrap(); toast.success('Marked as arrived'); refetch(); }
    catch (err) { toast.error(err.data?.error || 'Failed'); }
  }
  async function onStartService() {
    if (!/^\d{4}$/.test(otp)) { toast.error('Enter 4-digit OTP from customer'); return; }
    try { await startService({ id, otp }).unwrap(); toast.success('Service started'); refetch(); }
    catch (err) { toast.error(err.data?.error || 'Invalid OTP'); }
  }
  async function onComplete() {
    try { await complete(id).unwrap(); toast.success('Job completed!'); nav('/worker', { replace: true }); }
    catch (err) { toast.error(err.data?.error || 'Failed'); }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <button onClick={() => nav('/worker')} className="back-btn">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="t-label">Active Job</p>
            <p className="font-semibold text-[#0F172A] capitalize truncate">
              {order.service.replace(/_/g, ' ')}
            </p>
          </div>
          <span className={`chip ${chipCfg.cls}`}>{chipCfg.label}</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {/* Map */}
        <LiveTrackingMap pickup={pickup} workerLocation={null} height="38vh" />

        {/* Pickup location */}
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-zappy-50 flex items-center justify-center shrink-0">
              <MapPin size={15} strokeWidth={2} className="text-zappy-600" />
            </div>
            <div className="flex-1">
              <p className="t-label mb-1">Pickup Address</p>
              <p className="text-sm font-medium text-[#0F172A] leading-relaxed">
                {order.pickupLocation.address}
              </p>
            </div>
          </div>
          <button
            onClick={openNavigation}
            className="btn-secondary w-full mt-3 gap-2"
          >
            <Navigation size={14} strokeWidth={2} />
            Navigate with Google Maps
          </button>
        </div>

        {/* Customer note */}
        {order.description && (
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <FileText size={15} strokeWidth={2} className="text-slate-500" />
              </div>
              <div>
                <p className="t-label mb-1">Customer Note</p>
                <p className="text-sm text-slate-600 leading-relaxed">{order.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Earnings */}
        <div className="card flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-success-50 flex items-center justify-center shrink-0">
            <BadgeIndianRupee size={15} strokeWidth={2} className="text-success-600" />
          </div>
          <div className="flex-1">
            <p className="t-label mb-0.5">Your Earnings</p>
            <p className="text-2xl font-extrabold text-[#0F172A]">₹{order.pricing?.total}</p>
          </div>
        </div>

        {/* OTP input */}
        {status === 'arrived' && (
          <div className="card bg-amber-50 ring-1 ring-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={14} strokeWidth={2} className="text-amber-700" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Enter Customer OTP to Begin Service
              </p>
            </div>
            <input
              className="input tracking-[0.6em] text-center text-2xl font-extrabold bg-white"
              placeholder="----"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          {status === 'assigned' && (
            <button onClick={onStartTrip} disabled={starting} className="btn-primary w-full">
              {starting ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} strokeWidth={2.5} />}
              {starting ? 'Starting…' : 'Start Trip to Customer'}
            </button>
          )}
          {status === 'on_the_way' && (
            <button onClick={onArrive} disabled={arriving} className="btn-primary w-full">
              {arriving ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} strokeWidth={2.5} />}
              {arriving ? 'Updating…' : "I've Arrived"}
            </button>
          )}
          {status === 'arrived' && (
            <button onClick={onStartService} disabled={startingService} className="btn-success w-full">
              {startingService ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} strokeWidth={2.5} />}
              {startingService ? 'Verifying…' : 'Verify OTP & Start Service'}
            </button>
          )}
          {status === 'in_progress' && (
            <button onClick={onComplete} disabled={completing} className="btn-success w-full">
              {completing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} strokeWidth={2.5} />}
              {completing ? 'Completing…' : 'Mark Job Complete'}
            </button>
          )}
          {terminal && (
            <button onClick={() => nav('/worker')} className="btn-secondary w-full">
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
