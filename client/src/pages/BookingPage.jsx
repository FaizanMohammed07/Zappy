import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, FileText, CreditCard, ChevronRight,
  Loader2, Zap, TrendingUp, Users, CheckCircle, Calendar,
  Clock, Image as ImageIcon, X, Plus, Sparkles, Wrench,
  Droplets, Bolt, Wind, Hammer, Car, HelpCircle, Star,
  Paintbrush, Layers, Ticket, Tag,
} from 'lucide-react';
import LocationPicker from '../modules/booking/LocationPicker';
import SmartPricingPanel from '../components/booking/SmartPricingPanel';
import {
  useLazyGetQuoteQuery, useCreateOrderMutation,
  usePresignUploadMutation, useLazyGetNearbyWorkersQuery,
  useValidatePromoMutation,
} from '../services/api';
import PageTransition from '../components/common/PageTransition';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_META = {
  plumbing:   { label: 'Plumbing',       icon: Droplets,   gradient: 'from-cyan-500 to-blue-600',     accent: '#0ea5e9' },
  electrical: { label: 'Electrical',     icon: Bolt,       gradient: 'from-amber-400 to-orange-500',  accent: '#f59e0b' },
  ac_repair:  { label: 'AC Repair',      icon: Wind,       gradient: 'from-sky-400 to-cyan-600',      accent: '#38bdf8' },
  carpenter:  { label: 'Carpenter',      icon: Hammer,     gradient: 'from-amber-600 to-yellow-700',  accent: '#d97706' },
  puncture:   { label: 'Puncture Repair',icon: Car,        gradient: 'from-slate-500 to-slate-700',   accent: '#64748b' },
  helper:     { label: 'Helper',         icon: HelpCircle, gradient: 'from-violet-500 to-purple-600', accent: '#8b5cf6' },
  cleaning:   { label: 'Cleaning',       icon: Sparkles,   gradient: 'from-teal-400 to-emerald-500',  accent: '#14b8a6' },
  painting:   { label: 'Painting',       icon: Paintbrush, gradient: 'from-pink-500 to-rose-500',     accent: '#ec4899' },
};

const SERVICE_SUBCATEGORIES = {
  electrical: [
    { key: 'switch_socket', label: 'Switch / Socket', icon: '🔌' },
    { key: 'wiring',        label: 'Wiring Issue',    icon: '🔧' },
    { key: 'fan_light',     label: 'Fan / Light',     icon: '💡' },
    { key: 'mcb_fuse',      label: 'MCB / Fuse',      icon: '⚡' },
    { key: 'new_fitting',   label: 'New Fitting',     icon: '🪛' },
  ],
  plumbing: [
    { key: 'pipe_leak',  label: 'Pipe Leak',    icon: '💧' },
    { key: 'tap_faucet', label: 'Tap / Faucet', icon: '🚿' },
    { key: 'drain',      label: 'Drain Blocked',icon: '🕳️' },
    { key: 'toilet',     label: 'Toilet Issue', icon: '🚽' },
    { key: 'water_tank', label: 'Water Tank',   icon: '🪣' },
  ],
  ac_repair: [
    { key: 'not_cooling',   label: 'Not Cooling',    icon: '🥵' },
    { key: 'water_leak',    label: 'Water Leaking',  icon: '💦' },
    { key: 'noisy',         label: 'Noisy',          icon: '📢' },
    { key: 'not_turning_on',label: 'Not Turning On', icon: '❌' },
    { key: 'service',       label: 'Service / Clean',icon: '🧹' },
  ],
  carpenter: [
    { key: 'door_window',  label: 'Door / Window',    icon: '🚪' },
    { key: 'furniture',    label: 'Furniture Repair', icon: '🪑' },
    { key: 'lock',         label: 'Lock Issue',       icon: '🔐' },
    { key: 'installation', label: 'New Installation', icon: '🔨' },
  ],
  puncture: [
    { key: 'two_wheeler',  label: 'Two Wheeler',  icon: '🛵' },
    { key: 'four_wheeler', label: 'Four Wheeler', icon: '🚗' },
    { key: 'tyre_change',  label: 'Tyre Change',  icon: '🔄' },
  ],
  helper: [
    { key: 'shifting',      label: 'Home Shifting', icon: '📦' },
    { key: 'heavy_lifting', label: 'Heavy Lifting', icon: '💪' },
    { key: 'cleaning_help', label: 'Cleaning',      icon: '🧽' },
    { key: 'other',         label: 'Other Task',    icon: '📋' },
  ],
  cleaning: [
    { key: 'full_home',  label: 'Full Home',  icon: '🏠' },
    { key: 'kitchen',    label: 'Kitchen',    icon: '🍳' },
    { key: 'bathroom',   label: 'Bathroom',   icon: '🚿' },
    { key: 'deep_clean', label: 'Deep Clean', icon: '✨' },
  ],
  painting: [
    { key: 'walls',     label: 'Walls',     icon: '🖌️' },
    { key: 'exterior',  label: 'Exterior',  icon: '🏡' },
    { key: 'touch_up',  label: 'Touch Up',  icon: '🎨' },
    { key: 'full_home', label: 'Full Home', icon: '🏠' },
  ],
};

const PAYMENT_OPTIONS = [
  { key: 'upi',  label: 'UPI',  icon: '📱', desc: 'Google Pay, PhonePe…'  },
  { key: 'cash', label: 'Cash', icon: '💵', desc: 'Pay on arrival'         },
  { key: 'card', label: 'Card', icon: '💳', desc: 'Credit / Debit'         },
];

const NUDGE_POOL = [
  { icon: TrendingUp, text: 'High demand right now — workers going fast', color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100' },
  { icon: Users,      text: 'Multiple users booking this service nearby',  color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-100'   },
  { icon: Star,       text: '95% of bookings matched within 60 seconds',   color: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-100'  },
];

function todayMin() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  return d.toISOString().slice(0, 16);
}

export default function BookingPage() {
  const { service } = useParams();
  const nav = useNavigate();
  const [stage,         setStage]         = useState('location');
  const [location,      setLocation]      = useState(null);
  const [subCategory,   setSubCategory]   = useState('');
  const [description,   setDescription]   = useState('');
  const [images,        setImages]        = useState([]);
  const [schedMode,     setSchedMode]     = useState('now');
  const [scheduledAt,   setScheduledAt]   = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [pricingMode,   setPricingMode]   = useState('now');
  const [nudgeIdx,      setNudgeIdx]      = useState(0);
  const [showNudge,     setShowNudge]     = useState(false);
  const [promoCode,     setPromoCode]     = useState('');
  const [promoResult,   setPromoResult]   = useState(null); // { discountPaise, discountDisplay, code }
  const [promoError,    setPromoError]    = useState('');
  const nudgeTimer = useRef(null);
  const fileInputRef = useRef(null);

  const [fetchQuote,     { data: quoteData, isFetching: quoting }] = useLazyGetQuoteQuery();
  const [createOrder,    { isLoading: creating }]                  = useCreateOrderMutation();
  const [presignUpload]                                             = usePresignUploadMutation();
  const [fetchNearby,    { data: nearbyData }]                     = useLazyGetNearbyWorkersQuery();
  const [validatePromo,  { isLoading: validatingPromo }]           = useValidatePromoMutation();

  const meta         = SERVICE_META[service] || { label: service?.replace(/_/g, ' ') || 'Service', icon: Wrench, gradient: 'from-slate-500 to-slate-700', accent: '#64748b' };
  const ServiceIcon  = meta.icon;
  const subCategories = SERVICE_SUBCATEGORIES[service] || [];
  const q = quoteData?.quote;
  const hasSurge = q?.surgeMultiplier > 1;

  useEffect(() => {
    if (stage !== 'details') { setShowNudge(false); return; }
    const initial = setTimeout(() => {
      setShowNudge(true);
      nudgeTimer.current = setInterval(() => {
        setNudgeIdx(i => (i + 1) % NUDGE_POOL.length);
      }, 8000);
    }, 3000);
    return () => { clearTimeout(initial); clearInterval(nudgeTimer.current); };
  }, [stage]);

  async function onLocationConfirmed(loc) {
    setLocation(loc);
    setPricingMode('now');
    setStage('details');
    fetchQuote({ service, pickupLat: loc.lat, pickupLng: loc.lng });
    fetchNearby({ lat: loc.lat, lng: loc.lng });
  }

  async function uploadImage(file) {
    const id = Math.random().toString(36).slice(2);
    setImages(prev => [...prev, { id, url: null, uploading: true }]);
    try {
      const { url: presignedUrl, publicUrl } = await presignUpload({
        filename: file.name,
        contentType: file.type,
        purpose: 'order_image',
      }).unwrap();
      await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      setImages(prev => prev.map(img => img.id === id ? { id, url: publicUrl, uploading: false } : img));
    } catch {
      setImages(prev => prev.filter(img => img.id !== id));
      toast.error('Image upload failed');
    }
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - images.filter(i => !i.uploading).length;
    files.slice(0, remaining).forEach(uploadImage);
    e.target.value = '';
  }

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoError('');
    setPromoResult(null);
    try {
      const res = await validatePromo({
        code: promoCode.trim().toUpperCase(),
        service,
        orderTotalPaise: (q?.total || 0) * 100,
      }).unwrap();
      setPromoResult({
        code: res.promo.code,
        discountPaise: res.discountPaise,
        discountDisplay: `₹${Math.round(res.discountPaise / 100)}`,
      });
    } catch (err) {
      setPromoError(err.data?.error || 'Invalid promo code');
    }
  }

  function clearPromo() {
    setPromoCode('');
    setPromoResult(null);
    setPromoError('');
  }

  async function placeOrder() {
    if (schedMode === 'later' && !scheduledAt) {
      toast.error('Please pick a date and time');
      return;
    }
    setPricingMode('locked');
    try {
      const uploadedUrls = images.filter(i => i.url).map(i => i.url);
      const body = {
        service,
        subCategory: subCategory || undefined,
        description,
        images: uploadedUrls,
        scheduledAt: schedMode === 'later' ? new Date(scheduledAt).toISOString() : undefined,
        pickupLocation: location,
        paymentMethod,
        promoCode: promoResult?.code || undefined,
      };
      const r = await createOrder(body).unwrap();
      toast.success(schedMode === 'later' ? 'Booking scheduled!' : 'Order placed — finding a worker');
      nav(`/orders/${r.order._id}`, { replace: true });
    } catch (err) {
      setPricingMode('now');
      const msg = err.data?.error || 'Failed to place order';
      if (err.data?.activeOrderId) {
        toast.error(`${msg} — redirecting…`);
        nav(`/orders/${err.data.activeOrderId}`, { replace: true });
        return;
      }
      toast.error(msg);
    }
  }

  /* ── Location stage ── */
  if (stage === 'location') {
    return (
      <div className="h-screen flex flex-col">
        {/* Premium header with gradient */}
        <header className="shrink-0 relative overflow-hidden" style={{ background: `linear-gradient(135deg, #0F172A 0%, #1e293b 100%)` }}>
          <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
            <motion.button
              onClick={() => nav(-1)}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-sm"
              whileTap={{ scale: 0.92 }}
            >
              <ArrowLeft size={18} strokeWidth={2.5} className="text-white" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Where do you need help?</p>
              <p className="font-bold text-white capitalize leading-tight flex items-center gap-2">
                <span className={`inline-flex w-5 h-5 rounded-lg bg-gradient-to-br ${meta.gradient} items-center justify-center`}>
                  <ServiceIcon size={11} strokeWidth={2.5} className="text-white" />
                </span>
                {meta.label}
              </p>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-6 h-1.5 rounded-full bg-white" />
              <div className="w-6 h-1.5 rounded-full bg-white/30" />
            </div>
          </div>
          {/* Subtle gradient line */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </header>
        <div className="flex-1 min-h-0">
          <LocationPicker onConfirm={onLocationConfirmed} onCancel={() => nav(-1)} serviceLabel={meta.label} />
        </div>
      </div>
    );
  }

  /* ── Details stage ── */
  const hasUploadingImages = images.some(i => i.uploading);
  const canBook = !!q && !creating && pricingMode !== 'wait' && !hasUploadingImages;

  return (
    <PageTransition>
    <div className="min-h-screen pb-32" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f9fafb 120px)' }}>

      {/* Premium header */}
      <header className="sticky top-0 z-20 backdrop-blur-md" style={{ background: 'rgba(15,23,42,0.97)' }}>
        <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
          <motion.button
            onClick={() => { setStage('location'); setPricingMode('now'); }}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={18} strokeWidth={2.5} className="text-white" />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Step 2 — Confirm booking</p>
            <p className="font-bold text-white capitalize leading-tight flex items-center gap-2">
              <span className={`inline-flex w-5 h-5 rounded-lg bg-gradient-to-br ${meta.gradient} items-center justify-center`}>
                <ServiceIcon size={11} strokeWidth={2.5} className="text-white" />
              </span>
              {meta.label}
            </p>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-1.5 rounded-full bg-white/40" />
            <div className="w-6 h-1.5 rounded-full bg-white" />
          </div>
          {hasSurge && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30 px-2 py-0.5 rounded-full ml-1">
              <TrendingUp size={9} />
              {q.surgeMultiplier}×
            </span>
          )}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </header>

      {/* Nudge banner */}
      <AnimatePresence mode="wait">
        {showNudge && (
          <motion.div
            key={nudgeIdx}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0  }}
            exit={{    opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-3"
          >
            {(() => {
              const { icon: Icon, text, color, bg, ring } = NUDGE_POOL[nudgeIdx];
              return (
                <div className={`flex items-center gap-2.5 px-4 py-2.5 ${bg} rounded-xl ring-1 ${ring}`}>
                  <Icon size={13} className={`${color} shrink-0`} />
                  <p className={`text-xs font-semibold ${color}`}>{text}</p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pt-4 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Location card — with map preview */}
        <motion.div
          className="rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          {location && import.meta.env.VITE_MAPBOX_TOKEN && (
            <div className="relative w-full h-32 overflow-hidden">
              <img
                src={
                  `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
                  `pin-l+2563eb(${location.lng},${location.lat})/` +
                  `${location.lng},${location.lat},14,0/600x200@2x` +
                  `?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&attribution=false&logo=false`
                }
                alt="Service location map"
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              {nearbyData?.count > 0 && (
                <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-[#0F172A]">
                    {nearbyData.count} worker{nearbyData.count === 1 ? '' : 's'} nearby
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
              <MapPin size={15} strokeWidth={2} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Service Location</p>
              <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">{location?.address}</p>
            </div>
            <motion.button
              onClick={() => { setStage('location'); setPricingMode('now'); }}
              className="text-xs font-bold text-blue-600 flex items-center gap-0.5 shrink-0 bg-blue-50 px-2.5 py-1.5 rounded-lg ring-1 ring-blue-100"
              whileTap={{ scale: 0.95 }}
            >
              Change <ChevronRight size={11} strokeWidth={2.5} />
            </motion.button>
          </div>
        </motion.div>

        {/* Sub-categories */}
        {subCategories.length > 0 && (
          <motion.div
            className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
            variants={fadeInUp}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
                <ServiceIcon size={14} strokeWidth={2.5} className="text-white" />
              </div>
              <p className="font-bold text-[#0F172A] text-sm">What's the issue?</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {subCategories.map(({ key, label, icon }) => (
                <motion.button
                  key={key}
                  onClick={() => setSubCategory(prev => prev === key ? '' : key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    subCategory === key
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-600 border-slate-150 hover:border-slate-300 bg-slate-50'
                  }`}
                  style={subCategory === key ? {
                    background: `linear-gradient(135deg, ${meta.accent}ee, ${meta.accent})`,
                    borderColor: 'transparent',
                  } : {}}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{icon}</span>
                  {label}
                </motion.button>
              ))}
            </div>
            {subCategory && (
              <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1.5">
                <CheckCircle size={11} className="text-green-500" />
                <span>Selected: <span className="font-bold text-slate-600">{subCategories.find(s => s.key === subCategory)?.label}</span></span>
              </p>
            )}
          </motion.div>
        )}

        {/* Smart pricing panel */}
        <motion.div variants={fadeInUp}>
          {quoting ? (
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 flex items-center gap-3" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Loader2 size={18} className="animate-spin text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Calculating fare…</p>
                <p className="text-xs text-slate-400 mt-0.5">Checking demand, distance &amp; worker availability</p>
              </div>
            </div>
          ) : q ? (
            <SmartPricingPanel
              quote={q}
              mode={pricingMode}
              onModeChange={setPricingMode}
              onRefetch={() => fetchQuote({ service, pickupLat: location.lat, pickupLng: location.lng })}
              accentGradient={meta.gradient}
            />
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-4" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <p className="text-sm text-slate-400 font-medium text-center py-2">
                Could not load fare estimate
              </p>
            </div>
          )}
        </motion.div>

        {/* Description + images */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText size={15} strokeWidth={2} className="text-slate-600" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-sm">Describe the Issue</p>
              <p className="text-[10px] text-slate-400">Optional but helps the worker prepare</p>
            </div>
          </div>
          <textarea
            rows={3}
            className="input resize-none text-sm"
            placeholder="e.g. Water leaking from kitchen pipe near the sink…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Image upload */}
          <div className="mt-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <ImageIcon size={13} strokeWidth={2} className="text-slate-400" />
              <p className="text-xs font-bold text-slate-500">Add photos <span className="text-slate-300 font-normal">(optional · up to 5)</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-200"
                >
                  {img.uploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <Loader2 size={16} className="animate-spin text-blue-400" />
                    </div>
                  ) : (
                    <>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </>
                  )}
                </motion.div>
              ))}
              {images.filter(i => !i.uploading).length < 5 && (
                <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:border-blue-300 hover:bg-blue-50/50 transition-all gap-0.5"
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus size={16} strokeWidth={2.5} className="text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-medium">Add</span>
                </motion.button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </motion.div>

        {/* Schedule booking */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Calendar size={15} strokeWidth={2} className="text-slate-600" />
            </div>
            <p className="font-bold text-[#0F172A] text-sm">When do you need it?</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { key: 'now',   label: 'Book Now',           icon: Zap,   sub: 'Worker dispatched instantly' },
              { key: 'later', label: 'Schedule for Later', icon: Clock, sub: 'Pick a convenient time'      },
            ].map(({ key, label, icon: Icon, sub }) => (
              <motion.button
                key={key}
                onClick={() => setSchedMode(key)}
                className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all text-left ${
                  schedMode === key
                    ? 'border-transparent text-white'
                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                }`}
                style={schedMode === key ? { background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)', borderColor: 'transparent' } : {}}
                whileTap={{ scale: 0.97 }}
              >
                <Icon size={16} strokeWidth={2.5} className={schedMode === key ? 'text-white mb-2' : 'text-slate-500 mb-2'} />
                <p className={`text-xs font-bold ${schedMode === key ? 'text-white' : 'text-[#0F172A]'}`}>{label}</p>
                <p className={`text-[10px] mt-0.5 ${schedMode === key ? 'text-white/60' : 'text-slate-400'}`}>{sub}</p>
              </motion.button>
            ))}
          </div>
          <AnimatePresence>
            {schedMode === 'later' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
                    Select date &amp; time
                  </label>
                  <input
                    type="datetime-local"
                    min={todayMin()}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="input text-sm w-full"
                  />
                  {scheduledAt && (
                    <p className="text-xs text-green-600 font-bold mt-2 flex items-center gap-1.5">
                      <CheckCircle size={12} />
                      Scheduled for {new Date(scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">Dispatch starts 5 min before scheduled time</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Payment method */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <CreditCard size={15} strokeWidth={2} className="text-slate-600" />
            </div>
            <p className="font-bold text-[#0F172A] text-sm">Payment Method</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(({ key, label, icon, desc }) => (
              <motion.button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                  paymentMethod === key
                    ? 'border-transparent text-white'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
                style={paymentMethod === key ? { background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' } : {}}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-xl mb-1">{icon}</span>
                <span className={`text-xs font-bold ${paymentMethod === key ? 'text-white' : 'text-[#0F172A]'}`}>{label}</span>
                <span className={`text-[9px] mt-0.5 text-center ${paymentMethod === key ? 'text-white/50' : 'text-slate-400'}`}>{desc}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Promo code */}
        <motion.div
          className="rounded-2xl bg-white ring-1 ring-slate-100 p-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          variants={fadeInUp}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <Ticket size={15} strokeWidth={2} className="text-green-600" />
            </div>
            <p className="font-bold text-[#0F172A] text-sm">Promo Code</p>
            {promoResult && (
              <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {promoResult.discountDisplay} off
              </span>
            )}
          </div>

          {promoResult ? (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2.5 ring-1 ring-green-100">
              <Tag size={13} className="text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-green-700">{promoResult.code}</p>
                <p className="text-[10px] text-green-600">{promoResult.discountDisplay} will be deducted at checkout</p>
              </div>
              <button onClick={clearPromo} className="w-6 h-6 rounded-full bg-green-200/60 flex items-center justify-center shrink-0">
                <X size={11} className="text-green-700" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                placeholder="Enter promo code"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono font-semibold text-slate-800 uppercase tracking-widest outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition placeholder:font-normal placeholder:tracking-normal placeholder:uppercase-none"
              />
              <motion.button
                onClick={applyPromo}
                disabled={!promoCode.trim() || validatingPromo}
                className="flex items-center gap-1.5 bg-green-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
                whileTap={{ scale: 0.95 }}
              >
                {validatingPromo ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
              </motion.button>
            </div>
          )}
          {promoError && (
            <p className="text-xs text-red-500 font-semibold mt-2 flex items-center gap-1.5">
              <X size={11} /> {promoError}
            </p>
          )}
        </motion.div>

        {/* Assurance strip */}
        <motion.div variants={fadeInUp} className="flex items-center justify-center gap-6 py-2">
          {[
            { label: 'Insured Work', emoji: '🛡️' },
            { label: 'No Hidden Fee', emoji: '✅' },
            { label: 'Verified Pro', emoji: '⭐' },
          ].map(({ label, emoji }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-xl">{emoji}</span>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </motion.div>

      </motion.div>

      {/* Fixed confirm bar */}
      <div className="fixed bottom-0 inset-x-0 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 -8px 32px rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {hasUploadingImages && (
            <p className="text-xs text-slate-400 text-center mb-2 flex items-center justify-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              Uploading photos…
            </p>
          )}
          {pricingMode === 'wait' ? (
            <div className="text-center py-2">
              <p className="text-sm font-semibold text-slate-500">Waiting for a better price…</p>
              <p className="text-xs text-slate-400 mt-0.5">You can still book now at ₹{q?.total}</p>
              <button
                onClick={() => setPricingMode('now')}
                className="mt-2 text-xs font-bold text-blue-600 underline"
              >
                Book at current price
              </button>
            </div>
          ) : (
            <motion.button
              disabled={!canBook}
              onClick={placeOrder}
              className="w-full relative overflow-hidden rounded-2xl py-4 flex items-center justify-center gap-2.5 text-white font-bold text-base disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: canBook
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : '#94a3b8',
                boxShadow: canBook ? '0 8px 24px rgba(34,197,94,0.35)' : 'none',
              }}
              whileTap={canBook ? { scale: 0.98 } : {}}
            >
              {/* Animated shimmer */}
              {canBook && (
                <div
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2.5s ease-in-out infinite',
                  }}
                />
              )}
              {creating ? (
                <><Loader2 size={18} className="animate-spin" /> Placing order…</>
              ) : schedMode === 'later' ? (
                <><Calendar size={18} strokeWidth={2.5} /> Schedule Booking · ₹{q?.total || '—'}</>
              ) : (
                <>
                  <Zap size={18} strokeWidth={2.5} />
                  {promoResult
                    ? <>Confirm Booking · <s className="opacity-60 text-sm">₹{q?.total}</s> ₹{Math.max(0, (q?.total || 0) - Math.round(promoResult.discountPaise / 100))}</>
                    : <>Confirm Booking · ₹{q?.total || '—'}</>
                  }
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>

    </div>
    </PageTransition>
  );
}
