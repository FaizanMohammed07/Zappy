import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, FileText, CreditCard, ChevronRight, Loader2, Zap } from 'lucide-react';
import LocationPicker from '../modules/booking/LocationPicker';
import { useLazyGetQuoteQuery, useCreateOrderMutation } from '../services/api';
import PageTransition from '../components/common/PageTransition';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_LABELS = {
  puncture: 'Puncture Repair', plumbing: 'Plumbing', electrical: 'Electrical',
  ac_repair: 'AC Repair', carpenter: 'Carpenter', helper: 'Helper',
};

const PAYMENT_OPTIONS = [
  { key: 'upi',  label: 'UPI' },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
];

export default function BookingPage() {
  const { service } = useParams();
  const nav = useNavigate();
  const [stage, setStage] = useState('location');
  const [location, setLocation] = useState(null);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [fetchQuote, { data: quoteData, isFetching: quoting }] = useLazyGetQuoteQuery();
  const [createOrder, { isLoading: creating }] = useCreateOrderMutation();

  const serviceLabel = SERVICE_LABELS[service] || service?.replace(/_/g, ' ') || 'Service';

  async function onLocationConfirmed(loc) {
    setLocation(loc);
    setStage('details');
    fetchQuote({ service, pickupLat: loc.lat, pickupLng: loc.lng });
  }

  async function placeOrder() {
    try {
      const r = await createOrder({ service, description, pickupLocation: location, paymentMethod }).unwrap();
      toast.success('Order placed — finding a worker');
      nav(`/orders/${r.order._id}`, { replace: true });
    } catch (err) {
      const msg = err.data?.error || 'Failed to place order';
      if (err.data?.activeOrderId) {
        toast.error(`${msg} — redirecting…`);
        nav(`/orders/${err.data.activeOrderId}`, { replace: true });
        return;
      }
      toast.error(msg);
    }
  }

  if (stage === 'location') {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-white border-b border-slate-100 shrink-0">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(-1)} className="back-btn">
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="t-label">Where do you need help?</p>
              <p className="font-semibold text-[#0F172A] capitalize leading-tight">{serviceLabel}</p>
            </div>
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <LocationPicker onConfirm={onLocationConfirmed} onCancel={() => nav(-1)} />
        </div>
      </div>
    );
  }

  const q = quoteData?.quote;

  return (
    <PageTransition>
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      <header className="page-header">
        <div className="page-header-inner">
          <motion.button
            onClick={() => setStage('location')}
            className="back-btn"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="t-label">Booking details</p>
            <p className="font-semibold text-[#0F172A] capitalize leading-tight">{serviceLabel}</p>
          </div>
        </div>
      </header>

      <motion.div
        className="page-container pt-4 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Location */}
        <motion.div className="card" variants={fadeInUp}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-zappy-50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={15} strokeWidth={2} className="text-zappy-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="t-label mb-1">Service Location</p>
              <p className="text-sm font-medium text-[#0F172A] leading-relaxed">{location?.address}</p>
            </div>
            <button
              onClick={() => setStage('location')}
              className="text-xs font-semibold text-zappy-600 flex items-center gap-0.5 shrink-0"
            >
              Change <ChevronRight size={11} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>

        {/* Description */}
        <motion.div className="card" variants={fadeInUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <FileText size={15} strokeWidth={2} className="text-slate-500" />
            </div>
            <p className="font-semibold text-[#0F172A] text-sm">Describe the Issue</p>
          </div>
          <textarea
            rows={3}
            className="input resize-none text-sm"
            placeholder="e.g. Water leaking from kitchen pipe, near the sink…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </motion.div>

        {/* Payment */}
        <motion.div className="card" variants={fadeInUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <CreditCard size={15} strokeWidth={2} className="text-slate-500" />
            </div>
            <p className="font-semibold text-[#0F172A] text-sm">Payment Method</p>
          </div>
          <div className="flex gap-2">
            {PAYMENT_OPTIONS.map(({ key, label }) => (
              <motion.button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex-1 py-2.5 rounded-btn text-xs font-bold transition-all ${
                  paymentMethod === key
                    ? 'bg-zappy-600 text-white shadow-soft'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Fare */}
        <motion.div className="card" variants={fadeInUp}>
          <p className="font-semibold text-[#0F172A] text-sm mb-3">Estimated Fare</p>
          {quoting ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Calculating fare…</span>
            </div>
          ) : q ? (
            <div className="space-y-2">
              <FareRow label="Base fee" value={`₹${q.baseFee}`} />
              <FareRow label={`Distance (${q.distanceKm} km)`} value={`₹${q.distanceFee}`} />
              <FareRow label={`ETA (~${q.etaMinutes} min)`} value={`₹${q.timeFee}`} />
              <FareRow label="Platform fee" value={`₹${q.platformFee}`} />
              {q.surgeMultiplier > 1 && (
                <FareRow label={`Surge pricing (${q.surgeMultiplier}×)`} value="Applied" accent />
              )}
              <div className="border-t border-slate-100 pt-3 mt-1 flex justify-between items-center">
                <span className="font-bold text-[#0F172A]">Total</span>
                <span className="text-xl font-extrabold text-zappy-600">₹{q.total}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-medium">Select a location to see the estimated fare</p>
          )}
        </motion.div>
      </motion.div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="page-container pt-3 pb-2">
          <motion.button
            disabled={creating || !q}
            onClick={placeOrder}
            className="btn-success w-full text-base"
            whileHover={!creating && q ? { scale: 1.02 } : {}}
            whileTap={!creating && q ? { scale: 0.98 } : {}}
          >
            {creating ? (
              <><Loader2 size={16} className="animate-spin" /> Placing order…</>
            ) : (
              <><Zap size={16} strokeWidth={2.5} /> Confirm Booking · ₹{q?.total || '—'}</>
            )}
          </motion.button>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

function FareRow({ label, value, accent }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-accent-600' : 'text-[#0F172A]'}`}>{value}</span>
    </div>
  );
}
