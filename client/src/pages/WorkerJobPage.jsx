import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, Navigation, MapPin, FileText, BadgeIndianRupee,
  KeyRound, Loader2, CheckCircle2, MessageCircle, Phone, Image as ImageIcon,
} from 'lucide-react';
import {
  useGetOrderQuery,
  useWorkerStartTripMutation, useWorkerArriveMutation,
  useWorkerStartServiceMutation, useWorkerCompleteMutation,
} from '../services/api';
import { useOrderSocket } from '../hooks/useSocket';
import { useGeolocation } from '../hooks/useGeolocation';
import { selectOrder } from '../modules/order/orderSlice';
import { selectAuth } from '../modules/auth/authSlice';
import { getSocket } from '../services/socket';
import LiveTrackingMap from '../modules/tracking/LiveTrackingMap';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  assigned:    { label: 'Assigned',     cls: 'chip-blue'    },
  on_the_way:  { label: 'On the Way',   cls: 'chip-blue'    },
  arrived:     { label: 'Arrived',      cls: 'chip-accent'  },
  in_progress: { label: 'In Progress',  cls: 'chip-success' },
  completed:   { label: 'Completed',    cls: 'chip-success' },
  cancelled:   { label: 'Cancelled',    cls: 'chip-red'     },
};

const ACTIVE_STATUSES = new Set(['assigned', 'on_the_way', 'arrived', 'in_progress']);

export default function WorkerJobPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { accessToken: token } = useSelector(selectAuth);
  const { data, refetch } = useGetOrderQuery(id);
  const [startTrip,    { isLoading: starting }]        = useWorkerStartTripMutation();
  const [arrive,       { isLoading: arriving }]         = useWorkerArriveMutation();
  const [startService, { isLoading: startingService }]  = useWorkerStartServiceMutation();
  const [complete,     { isLoading: completing }]       = useWorkerCompleteMutation();
  const [otp, setOtp] = useState('');
  const [myLocation, setMyLocation] = useState(null);
  const watchCancelRef = useRef(null);
  const lastSentRef = useRef(0);

  useOrderSocket(id);
  const live = useSelector(selectOrder);
  const { watch } = useGeolocation();

  const order = data?.order;
  const status = order
    ? live.activeOrderId === order._id ? live.status || order.status : order.status
    : null;

  /* ── Continuous location stream while job is active ── */
  useEffect(() => {
    if (!status || !ACTIVE_STATUSES.has(status) || !token) return;

    const socket = getSocket(token);

    watchCancelRef.current = watch(
      (pos) => {
        setMyLocation({ lat: pos.lat, lng: pos.lng });
        const now = Date.now();
        if (now - lastSentRef.current < 4000) return; // throttle to ~1/4s
        lastSentRef.current = now;
        socket.emit('worker:location', { lat: pos.lat, lng: pos.lng, orderId: id });
      },
      (err) => console.warn('[WorkerJobPage] geolocation watch error', err),
    );

    return () => {
      watchCancelRef.current?.();
      watchCancelRef.current = null;
    };
  }, [status, token, id, watch]);

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 size={28} className="text-zappy-600 animate-spin" />
      </div>
    );
  }

  const chipCfg = STATUS_CONFIG[status] || { label: status, cls: 'chip-neutral' };
  const [lng, lat] = order.pickupLocation.coordinates;
  const pickup = { lat, lng };
  const terminal = ['completed', 'cancelled', 'failed'].includes(status);

  function openNavigation() {
    const dest = `${lat},${lng}`;
    // Try to open native maps (geo: works on Android, maps: on iOS)
    const url = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? `maps://maps.apple.com/?daddr=${dest}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
  }

  async function callCustomer() {
    try {
      const res = await fetch(`/api/orders/${id}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.proxyNumber) window.location.href = `tel:${data.proxyNumber}`;
      else toast.error('Call service unavailable');
    } catch {
      toast.error('Could not start call');
    }
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
    if (!/^\d{4}$/.test(otp)) { toast.error('Enter the 4-digit OTP from the customer'); return; }
    try { await startService({ id, otp }).unwrap(); toast.success('Service started'); refetch(); }
    catch (err) { toast.error(err.data?.error || 'Invalid OTP'); }
  }
  async function onComplete() {
    try { await complete(id).unwrap(); toast.success('Job completed'); nav('/worker', { replace: true }); }
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

        {/* Live map — worker location + route to pickup */}
        <LiveTrackingMap
          pickup={pickup}
          workerLocation={myLocation}
          service={order.service}
          height="38vh"
        />

        {/* Pickup location + navigation */}
        <div className="card">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={15} strokeWidth={2} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="t-label mb-1">Customer Location</p>
              <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">
                {order.pickupLocation.address}
              </p>
            </div>
          </div>
          <button onClick={openNavigation} className="btn-secondary w-full gap-2">
            <Navigation size={14} strokeWidth={2} />
            Open Navigation
          </button>
        </div>

        {/* Contact customer */}
        {!terminal && (
          <div className="card flex items-center gap-3">
            <div className="flex-1">
              <p className="t-label mb-0.5">Customer</p>
              <p className="text-sm font-semibold text-[#0F172A]">
                {order.userName || 'Customer'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={callCustomer}
                className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"
                aria-label="Call customer"
              >
                <Phone size={16} strokeWidth={2} className="text-green-600" />
              </button>
              <button
                onClick={() => nav(`/orders/${id}/chat`)}
                className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"
                aria-label="Chat with customer"
              >
                <MessageCircle size={16} strokeWidth={2} className="text-blue-600" />
              </button>
            </div>
          </div>
        )}

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

        {/* Attached images */}
        {order.images?.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <ImageIcon size={14} strokeWidth={2} className="text-blue-600" />
              </div>
              <p className="t-label">Photos from customer</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {order.images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Issue photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl ring-1 ring-slate-100 hover:ring-blue-300 transition"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Earnings */}
        <div className="card flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <BadgeIndianRupee size={15} strokeWidth={2} className="text-green-600" />
          </div>
          <div className="flex-1">
            <p className="t-label mb-0.5">Your Earnings</p>
            <p className="text-2xl font-extrabold text-[#0F172A]">₹{order.pricing?.total}</p>
          </div>
          {status === 'completed' && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              Paid
            </span>
          )}
        </div>

        {/* OTP input */}
        {status === 'arrived' && (
          <div className="card bg-amber-50 ring-1 ring-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={14} strokeWidth={2} className="text-amber-700" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Ask customer for the 4-digit OTP
              </p>
            </div>
            <input
              className="input tracking-[0.6em] text-center text-2xl font-extrabold bg-white"
              placeholder="- - - -"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          {status === 'assigned' && (
            <button onClick={onStartTrip} disabled={starting} className="btn-primary w-full">
              {starting
                ? <><Loader2 size={15} className="animate-spin" /> Starting…</>
                : <><Navigation size={15} strokeWidth={2.5} /> Start Trip to Customer</>}
            </button>
          )}
          {status === 'on_the_way' && (
            <button onClick={onArrive} disabled={arriving} className="btn-primary w-full">
              {arriving
                ? <><Loader2 size={15} className="animate-spin" /> Updating…</>
                : <><MapPin size={15} strokeWidth={2.5} /> I&apos;ve Arrived</>}
            </button>
          )}
          {status === 'arrived' && (
            <button onClick={onStartService} disabled={startingService} className="btn-success w-full">
              {startingService
                ? <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                : <><KeyRound size={15} strokeWidth={2.5} /> Verify OTP &amp; Start Service</>}
            </button>
          )}
          {status === 'in_progress' && (
            <button onClick={onComplete} disabled={completing} className="btn-success w-full">
              {completing
                ? <><Loader2 size={15} className="animate-spin" /> Completing…</>
                : <><CheckCircle2 size={15} strokeWidth={2.5} /> Mark Job Complete</>}
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
