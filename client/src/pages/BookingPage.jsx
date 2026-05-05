import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, FileText, CreditCard, ChevronRight,
  Loader2, Zap, TrendingUp, Users, CheckCircle, Calendar,
  Clock, Image as ImageIcon, X, Plus, AlertCircle,
} from 'lucide-react';
import LocationPicker from '../modules/booking/LocationPicker';
import SmartPricingPanel from '../components/booking/SmartPricingPanel';
import {
  useLazyGetQuoteQuery, useCreateOrderMutation,
  usePresignUploadMutation, useLazyGetNearbyWorkersQuery,
} from '../services/api';
import PageTransition from '../components/common/PageTransition';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

const SERVICE_LABELS = {
  puncture: 'Puncture Repair', plumbing: 'Plumbing', electrical: 'Electrical',
  ac_repair: 'AC Repair', carpenter: 'Carpenter', helper: 'Helper',
  cleaning: 'Cleaning', painting: 'Painting',
};

const SERVICE_SUBCATEGORIES = {
  electrical: [
    { key: 'switch_socket', label: 'Switch / Socket' },
    { key: 'wiring',        label: 'Wiring Issue'    },
    { key: 'fan_light',     label: 'Fan / Light'     },
    { key: 'mcb_fuse',      label: 'MCB / Fuse'      },
    { key: 'new_fitting',   label: 'New Fitting'     },
  ],
  plumbing: [
    { key: 'pipe_leak',    label: 'Pipe Leak'      },
    { key: 'tap_faucet',   label: 'Tap / Faucet'   },
    { key: 'drain',        label: 'Drain Blocked'  },
    { key: 'toilet',       label: 'Toilet Issue'   },
    { key: 'water_tank',   label: 'Water Tank'     },
  ],
  ac_repair: [
    { key: 'not_cooling',  label: 'Not Cooling'     },
    { key: 'water_leak',   label: 'Water Leaking'   },
    { key: 'noisy',        label: 'Noisy'           },
    { key: 'not_turning_on', label: 'Not Turning On' },
    { key: 'service',      label: 'Service / Clean' },
  ],
  carpenter: [
    { key: 'door_window',  label: 'Door / Window'   },
    { key: 'furniture',    label: 'Furniture Repair' },
    { key: 'lock',         label: 'Lock Issue'      },
    { key: 'installation', label: 'New Installation' },
  ],
  puncture: [
    { key: 'two_wheeler',  label: 'Two Wheeler'  },
    { key: 'four_wheeler', label: 'Four Wheeler' },
    { key: 'tyre_change',  label: 'Tyre Change'  },
  ],
  helper: [
    { key: 'shifting',      label: 'Home Shifting' },
    { key: 'heavy_lifting', label: 'Heavy Lifting' },
    { key: 'cleaning_help', label: 'Cleaning'      },
    { key: 'other',         label: 'Other Task'    },
  ],
  cleaning: [
    { key: 'full_home',  label: 'Full Home'  },
    { key: 'kitchen',    label: 'Kitchen'    },
    { key: 'bathroom',   label: 'Bathroom'   },
    { key: 'deep_clean', label: 'Deep Clean' },
  ],
  painting: [
    { key: 'walls',     label: 'Walls'     },
    { key: 'exterior',  label: 'Exterior'  },
    { key: 'touch_up',  label: 'Touch Up'  },
    { key: 'full_home', label: 'Full Home' },
  ],
};

const PAYMENT_OPTIONS = [
  { key: 'upi',  label: 'UPI'  },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
];

const NUDGE_POOL = [
  { icon: TrendingUp, text: 'High demand right now — workers are going fast' },
  { icon: Users,      text: 'Multiple users booking the same service nearby'  },
  { icon: CheckCircle,text: '95% of bookings matched within 60 seconds'       },
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
  const [images,        setImages]        = useState([]); // [{url, uploading, id}]
  const [schedMode,     setSchedMode]     = useState('now'); // 'now' | 'later'
  const [scheduledAt,   setScheduledAt]   = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [pricingMode,   setPricingMode]   = useState('now');
  const [nudgeIdx,      setNudgeIdx]      = useState(0);
  const [showNudge,     setShowNudge]     = useState(false);
  const nudgeTimer = useRef(null);
  const fileInputRef = useRef(null);

  const [fetchQuote,  { data: quoteData, isFetching: quoting }] = useLazyGetQuoteQuery();
  const [createOrder, { isLoading: creating }]                  = useCreateOrderMutation();
  const [presignUpload]                                          = usePresignUploadMutation();
  const [fetchNearby, { data: nearbyData }]                     = useLazyGetNearbyWorkersQuery();

  const serviceLabel  = SERVICE_LABELS[service] || service?.replace(/_/g, ' ') || 'Service';
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

  /* ── Details stage ── */
  const hasUploadingImages = images.some(i => i.uploading);
  const canBook = !!q && !creating && pricingMode !== 'wait' && !hasUploadingImages;

  return (
    <PageTransition>
    <div className="min-h-screen bg-[#F9FAFB] pb-32">

      {/* Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <motion.button
            onClick={() => { setStage('location'); setPricingMode('now'); }}
            className="back-btn"
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="t-label">Confirm booking</p>
            <p className="font-semibold text-[#0F172A] capitalize leading-tight">{serviceLabel}</p>
          </div>
          {hasSurge && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 rounded-full">
              <TrendingUp size={9} />
              {q.surgeMultiplier}×
            </span>
          )}
        </div>
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
            className="max-w-lg mx-auto px-4 pt-3"
          >
            {(() => {
              const { icon: Icon, text } = NUDGE_POOL[nudgeIdx];
              return (
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl shadow-soft ring-1 ring-slate-100">
                  <Icon size={13} className="text-blue-600 shrink-0" />
                  <p className="text-xs font-semibold text-slate-700">{text}</p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="page-container pt-3 space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Location card */}
        <motion.div className="card overflow-hidden !p-0" variants={fadeInUp}>
          {/* Static map preview */}
          {location && import.meta.env.VITE_MAPBOX_TOKEN && (
            <div className="relative w-full h-28 overflow-hidden">
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
              {/* Workers nearby chip over map */}
              {nearbyData?.count > 0 && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 shadow-md ring-1 ring-slate-100">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-[#0F172A]">
                    {nearbyData.count} worker{nearbyData.count === 1 ? '' : 's'} nearby
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Address row */}
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={15} strokeWidth={2} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="t-label mb-1">Service Location</p>
              <p className="text-sm font-medium text-[#0F172A] leading-relaxed">{location?.address}</p>
            </div>
            <button
              onClick={() => { setStage('location'); setPricingMode('now'); }}
              className="text-xs font-semibold text-blue-600 flex items-center gap-0.5 shrink-0 mt-0.5"
            >
              Change <ChevronRight size={11} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>

        {/* Sub-categories */}
        {subCategories.length > 0 && (
          <motion.div className="card" variants={fadeInUp}>
            <p className="font-semibold text-[#0F172A] text-sm mb-3">What's the issue?</p>
            <div className="flex flex-wrap gap-2">
              {subCategories.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSubCategory(prev => prev === key ? '' : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    subCategory === key
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {subCategory && (
              <p className="text-xs text-slate-400 mt-2">
                Selected: <span className="font-semibold text-slate-600">{subCategories.find(s => s.key === subCategory)?.label}</span>
              </p>
            )}
          </motion.div>
        )}

        {/* Smart pricing panel */}
        <motion.div variants={fadeInUp}>
          {quoting ? (
            <div className="card flex items-center gap-2.5">
              <Loader2 size={15} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Calculating fare…</p>
                <p className="text-xs text-slate-400 mt-0.5">Checking demand, distance and worker availability</p>
              </div>
            </div>
          ) : q ? (
            <SmartPricingPanel
              quote={q}
              mode={pricingMode}
              onModeChange={setPricingMode}
              onRefetch={() => fetchQuote({ service, pickupLat: location.lat, pickupLng: location.lng })}
            />
          ) : (
            <div className="card">
              <p className="text-sm text-slate-400 font-medium text-center py-2">
                Could not load fare estimate
              </p>
            </div>
          )}
        </motion.div>

        {/* Description + images */}
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
            placeholder="e.g. Water leaking from kitchen pipe near the sink…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Image upload */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon size={13} strokeWidth={2} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-500">Add photos (optional, up to 5)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                  {img.uploading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {images.filter(i => !i.uploading).length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center hover:border-slate-400 transition"
                >
                  <Plus size={18} strokeWidth={2} className="text-slate-400" />
                </button>
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
        <motion.div className="card" variants={fadeInUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <Calendar size={15} strokeWidth={2} className="text-slate-500" />
            </div>
            <p className="font-semibold text-[#0F172A] text-sm">When do you need it?</p>
          </div>
          <div className="flex gap-2 mb-3">
            {[
              { key: 'now',   label: 'Book Now',          icon: Zap     },
              { key: 'later', label: 'Schedule for Later', icon: Clock   },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSchedMode(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn text-xs font-bold transition-all ${
                  schedMode === key
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={12} strokeWidth={2.5} />
                {label}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {schedMode === 'later' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
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
                    <p className="text-xs text-blue-600 font-semibold mt-1.5 flex items-center gap-1">
                      <CheckCircle size={11} />
                      Scheduled for {new Date(scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Dispatch starts 5 min before scheduled time</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex-1 py-2.5 rounded-btn text-xs font-bold transition-all ${
                  paymentMethod === key
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </motion.div>

      </motion.div>

      {/* Fixed confirm bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="page-container pt-3 pb-2">
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
              className="btn-success w-full text-base"
              whileTap={canBook ? { scale: 0.98 } : {}}
            >
              {creating ? (
                <><Loader2 size={16} className="animate-spin" /> Placing order…</>
              ) : schedMode === 'later' ? (
                <><Calendar size={16} strokeWidth={2.5} /> Schedule Booking · ₹{q?.total || '—'}</>
              ) : (
                <><Zap size={16} strokeWidth={2.5} /> Confirm Booking · ₹{q?.total || '—'}</>
              )}
            </motion.button>
          )}
        </div>
      </div>

    </div>
    </PageTransition>
  );
}
