import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LogOut, MapPin, TrendingUp, Clock, CheckCircle,
  AlertTriangle, X, Navigation, Loader2, Briefcase,
} from 'lucide-react';
import {
  useGetWorkerMeQuery, useGoOnlineMutation, useGoOfflineMutation,
  useGetEarningsQuery, useWorkerAcceptMutation, useWorkerRejectMutation,
  useGetKycStatusQuery,
} from '../services/api';
import { useWorkerOfferSocket } from '../hooks/useSocket';
import { setOffer, clearOffer, setOnline, selectWorker } from '../modules/worker/workerSlice';
import { selectAuth, logout } from '../modules/auth/authSlice';
import { useGeolocation } from '../hooks/useGeolocation';
import { getSocket } from '../services/socket';
import { ZappyLogo } from '../components/common/ZappyLogo';
import toast from 'react-hot-toast';

export default function WorkerDashboard() {
  const nav = useNavigate();
  const dispatch = useDispatch();
  const worker = useSelector(selectWorker);
  const { accessToken: token } = useSelector(selectAuth);
  const { data } = useGetWorkerMeQuery();
  const { data: earnings } = useGetEarningsQuery('today');
  const { data: kycData } = useGetKycStatusQuery();
  const [goOnline] = useGoOnlineMutation();
  const [goOffline] = useGoOfflineMutation();
  const [acceptOffer, { isLoading: accepting }] = useWorkerAcceptMutation();
  const [rejectOffer] = useWorkerRejectMutation();
  const { getCurrent, watch } = useGeolocation();
  const watchStop = useRef(null);

  const me = data?.worker;
  const isOnline = me?.isOnline ?? false;
  const kycStatus = kycData?.kyc?.status;
  const kycApproved = kycStatus === 'approved';

  useEffect(() => { dispatch(setOnline(isOnline)); }, [isOnline, dispatch]);

  const handleOffer = useCallback((offer) => {
    dispatch(setOffer(offer));
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
  }, [dispatch]);
  useWorkerOfferSocket(handleOffer);

  useEffect(() => {
    if (!isOnline || !token) {
      watchStop.current?.();
      watchStop.current = null;
      return;
    }
    const socket = getSocket(token);
    let lastSent = 0;
    watchStop.current = watch(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 4000) return;
        lastSent = now;
        socket.emit('worker:location', { lat: pos.lat, lng: pos.lng, orderId: worker.currentOrder?._id });
      },
      (err) => console.warn('watch err', err)
    );
    return () => { watchStop.current?.(); watchStop.current = null; };
  }, [isOnline, token, watch, worker.currentOrder]);

  async function toggleOnline() {
    if (!kycApproved) {
      toast.error('Complete KYC to go online');
      nav('/worker/kyc');
      return;
    }
    try {
      if (isOnline) {
        await goOffline().unwrap();
        toast.success('You are now offline');
      } else {
        const pos = await getCurrent();
        await goOnline({ lat: pos.lat, lng: pos.lng }).unwrap();
        toast.success('You are now online!');
      }
    } catch (err) {
      toast.error(err.data?.error || err.message || 'Failed');
    }
  }

  async function onAccept() {
    if (!worker.currentOffer) return;
    try {
      await acceptOffer(worker.currentOffer._id).unwrap();
      const id = worker.currentOffer._id;
      dispatch(clearOffer());
      nav(`/worker/jobs/${id}`);
    } catch (err) {
      toast.error(err.data?.error || 'Could not accept');
      dispatch(clearOffer());
    }
  }

  async function onReject() {
    if (!worker.currentOffer) return;
    try { await rejectOffer(worker.currentOffer._id).unwrap(); } finally { dispatch(clearOffer()); }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-12">
      {/* Header */}
      <header className="bg-zappy-gradient shadow-soft-lg">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <ZappyLogo size={28} />
            <button
              onClick={() => { dispatch(logout()); nav('/worker/login'); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white/80 bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition"
            >
              <LogOut size={12} strokeWidth={2} />
              Logout
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Partner</p>
            <p className="text-xl font-bold text-white mt-0.5">{me?.name || 'Loading…'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
                <span className="text-amber-400 text-xs font-bold">★</span>
                <span className="text-xs text-white font-semibold">{me?.rating || '5.0'}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-xs text-white/70">{me?.completedJobs || 0} jobs completed</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-3">

        {/* KYC banner */}
        {!kycApproved && (
          <button
            onClick={() => nav('/worker/kyc')}
            className={`w-full card text-left ring-1 ${
              kycStatus === 'rejected' ? 'bg-red-50 ring-red-200' :
              kycStatus === 'pending_review' ? 'bg-amber-50 ring-amber-200' :
              'bg-amber-50 ring-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                kycStatus === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle size={16} strokeWidth={2} className={kycStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${kycStatus === 'rejected' ? 'text-red-700' : 'text-amber-800'}`}>
                  {kycStatus === 'pending_review' ? 'KYC Under Review' :
                   kycStatus === 'rejected' ? 'KYC Rejected' : 'KYC Required'}
                </p>
                <p className={`text-sm font-medium mt-0.5 ${kycStatus === 'rejected' ? 'text-red-600' : 'text-amber-700'}`}>
                  {kycStatus === 'pending_review' ? 'Verification in progress — check back in 24 hours' :
                   kycStatus === 'rejected' ? 'Tap to resubmit your documents' :
                   'Complete verification to start receiving jobs'}
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Online toggle */}
        <div className="card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-success-50' : 'bg-slate-100'}`}>
              <Navigation size={18} strokeWidth={2} className={isOnline ? 'text-success-600' : 'text-slate-400'} />
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] text-sm">{isOnline ? 'Online — accepting jobs' : 'Offline'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOnline ? 'Waiting for job offers' : 'Go online to receive job requests'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleOnline}
            aria-label={isOnline ? 'Go offline' : 'Go online'}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 shrink-0 ${
              isOnline ? 'bg-success-500' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
              isOnline ? 'left-[calc(100%-26px)]' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Earnings stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Earnings" value={`₹${earnings?.totalEarnings || 0}`} Icon={TrendingUp} />
          <StatCard label="Jobs" value={earnings?.jobs || 0} Icon={CheckCircle} />
          <StatCard label="Avg Fare" value={`₹${Math.round(earnings?.avgFare || 0)}`} Icon={Clock} />
        </div>

        {/* Active job shortcut */}
        {me?.currentOrderId && (
          <button
            onClick={() => nav(`/worker/jobs/${me.currentOrderId}`)}
            className="w-full flex items-center gap-3 bg-zappy-600 rounded-card p-4 text-left shadow-soft"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse-slow shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-white/70 uppercase tracking-wide">Active Job</p>
              <p className="text-sm font-semibold text-white">Tap to continue working</p>
            </div>
            <Briefcase size={18} className="text-white/70 shrink-0" />
          </button>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => nav('/plans')} className="card text-left active:scale-[0.98] transition bg-gradient-to-br from-amber-50 to-orange-50 ring-amber-100">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <TrendingUp size={16} strokeWidth={2} className="text-amber-600" />
            </div>
            <p className="font-bold text-sm text-[#0F172A]">Go Pro</p>
            <p className="text-xs text-amber-700 mt-0.5">Lower commission</p>
          </button>
          <button onClick={() => nav('/wallet')} className="card text-left active:scale-[0.98] transition">
            <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center mb-3">
              <MapPin size={16} strokeWidth={2} className="text-success-600" />
            </div>
            <p className="font-bold text-sm text-[#0F172A]">Earnings</p>
            <p className="text-xs text-slate-500 mt-0.5">View wallet</p>
          </button>
        </div>
      </div>

      {/* Offer modal */}
      {worker.currentOffer && (
        <OfferModal
          offer={worker.currentOffer}
          onAccept={onAccept}
          onReject={onReject}
          accepting={accepting}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, Icon }) {
  return (
    <div className="card text-center">
      <Icon size={16} strokeWidth={2} className="text-zappy-600 mx-auto mb-1.5" />
      <p className="text-lg font-extrabold text-[#0F172A] leading-none">{value}</p>
      <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function OfferModal({ offer, onAccept, onReject, accepting }) {
  const [left, setLeft] = useState(15);

  useEffect(() => {
    const expires = new Date(offer.expiresAt).getTime();
    const tick = () => {
      const l = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) onReject();
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [offer, onReject]);

  const progress = Math.max(0, (left / 15) * 100);

  return (
    <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-soft-lg overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-zappy-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="t-label mb-1">New Job Offer</p>
              <h2 className="text-xl font-bold text-[#0F172A] capitalize">
                {offer.service.replace(/_/g, ' ')}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl ${
              left <= 5 ? 'bg-red-50 text-red-600' : 'bg-zappy-50 text-zappy-600'
            }`}>
              {left}s
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2.5">
            <MapPin size={14} strokeWidth={2} className="text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-semibold">Pickup Location</p>
              <p className="text-sm font-medium text-[#0F172A] mt-0.5">{offer.pickupAddress}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-slate-500 font-medium">You will earn</p>
            <p className="text-3xl font-extrabold text-[#0F172A]">₹{offer.price}</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onReject} className="btn-secondary flex-1 gap-2">
              <X size={15} strokeWidth={2.5} />
              Decline
            </button>
            <button onClick={onAccept} disabled={accepting} className="btn-primary flex-1 gap-2">
              {accepting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} strokeWidth={2.5} />}
              {accepting ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
