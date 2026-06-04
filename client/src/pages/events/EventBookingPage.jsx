import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, MapPin, Users, FileText, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useGetEventThemeQuery, useCreateEventBookingMutation, usePresignUploadMutation, useCreateEventAdvanceOrderMutation, useVerifyEventAdvancePaymentMutation } from '../../services/api';
import toast from 'react-hot-toast';

// Dynamically load Razorpay script
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i < step ? 'bg-indigo-600' : i === step ? 'bg-indigo-600 flex-1' : 'bg-slate-200'} ${i === step ? 'w-8' : 'w-4'}`} />
      ))}
    </div>
  );
}

export default function EventBookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [queryParams] = useSearchParams();
  const isScheduled = queryParams.get('scheduled') === 'true';

  const { data } = useGetEventThemeQuery(id);
  const [createBooking]       = useCreateEventBookingMutation();
  const [presignUpload]       = usePresignUploadMutation();
  const [createAdvanceOrder]  = useCreateEventAdvanceOrderMutation();
  const [verifyAdvancePayment]= useVerifyEventAdvancePaymentMutation();

  const theme = data?.theme;

  const [step, setStep] = useState(0); // 0=date, 1=address, 2=details, 3=confirm
  const [form, setForm] = useState({
    eventDate:     '',
    eventTimeSlot: '',
    address:       { line1: '', city: '', pincode: '' },
    guestCount:    1,
    notes:         '',
    roomPhotos:    [],
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function setAddr(key, val) { setForm(p => ({ ...p, address: { ...p.address, [key]: val } })); }

  const advancePaise = Math.round((theme?.startingPricePaise || 0) * 0.2);
  const totalPaise   = theme?.startingPricePaise || 0;

  async function handleRoomPhoto(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const keys = await Promise.all(files.map(async (file) => {
        const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'event-photos' });
        await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
        return signed.key;
      }));
      set('roomPhotos', [...form.roomPhotos, ...keys]);
      toast.success(`${keys.length} photo${keys.length > 1 ? 's' : ''} uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Step 1: Create booking
      const result = await createBooking({
        themeId: id, ...form, guestCount: Number(form.guestCount),
      }).unwrap();
      const bookingId = result.booking._id;

      // Step 2: Load Razorpay + create order
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load. Please try again.'); setSubmitting(false); return; }

      const orderRes = await createAdvanceOrder(bookingId).unwrap();

      // Step 3: Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount:      orderRes.amountPaise,
          currency:    'INR',
          order_id:    orderRes.orderId,
          name:        'Zappy Events',
          description: `Advance for ${theme.title}`,
          theme:       { color: '#7c3aed' },
          handler: async (response) => {
            try {
              await verifyAdvancePayment({
                id:                    bookingId,
                razorpayOrderId:       orderRes.orderId,
                razorpayPaymentId:     response.razorpay_payment_id,
                razorpaySignature:     response.razorpay_signature,
              }).unwrap();
              toast.success('🎉 Booking confirmed! Your event is set.');
              navigate(`/events/bookings/${bookingId}?paid=true`);
              resolve();
            } catch (e) { reject(e); }
          },
          modal: {
            ondismiss: () => {
              toast('Payment cancelled. Your booking slot is saved for 15 minutes.', { icon: '⏱️' });
              navigate(`/events/bookings/${bookingId}`);
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (err) {
      const msg = err?.data?.message || err?.data?.error || 'Booking failed';
      toast.error(msg);
      if (err?.data?.code === 'SLOT_TAKEN') toast.error('This slot was just taken — please choose another time');
    } finally { setSubmitting(false); }
  }

  const canNext = [
    form.eventDate && form.eventTimeSlot,
    form.address.line1 && form.address.city,
    true,
    true,
  ];

  if (!theme) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">
            <ArrowLeft size={18} className="text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-900">{['Choose Date & Time', 'Venue Details', 'Event Details', 'Review & Confirm'][step]}</h1>
            <p className="text-xs text-slate-400">Step {step + 1} of 4</p>
          </div>
        </div>
        <StepIndicator step={step + 1} total={4} />
      </div>

      {/* Theme summary strip */}
      <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <img src={theme.coverImage} alt="" className="w-10 h-10 rounded-xl object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{theme.title}</p>
          <p className="text-xs text-indigo-600 font-medium">₹{Math.round(totalPaise / 100).toLocaleString('en-IN')} total</p>
        </div>
      </div>

      <div className="px-4 py-5">
        {/* Step 0: Date & Time */}
        {step === 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><Calendar size={15} />Event Date</label>
              <input type="date" value={form.eventDate} onChange={e => set('eventDate', e.target.value)}
                min={new Date(Date.now() + 86_400_000).toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><Clock size={15} />Time Slot</label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map(slot => (
                  <button key={slot} onClick={() => set('eventTimeSlot', slot)}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.eventTimeSlot === slot ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}>
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 1: Address */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {[
              { key: 'line1', label: 'Address Line 1', placeholder: 'Flat / House / Building', required: true },
              { key: 'city',  label: 'City',           placeholder: 'Bangalore',               required: true },
              { key: 'pincode', label: 'Pincode',      placeholder: '560001' },
            ].map(({ key, label, placeholder, required }) => (
              <div key={key}>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
                <input value={form.address[key]} onChange={e => setAddr(key, e.target.value)} placeholder={placeholder}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none" />
              </div>
            ))}
          </motion.div>
        )}

        {/* Step 2: Event details */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><Users size={15} />Number of Guests</label>
              <input type="number" min={1} value={form.guestCount} onChange={e => set('guestCount', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><FileText size={15} />Special Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Colour preferences, specific items, allergies, theme modifications…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none" rows={3} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><Camera size={15} />Room Photos (optional)</label>
              <p className="text-xs text-slate-400 mb-2">Helps the partner plan the setup better</p>
              <label className="block w-full border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 transition-all">
                {uploading ? <Loader2 size={18} className="animate-spin text-indigo-400 mx-auto" /> : <><Camera size={18} className="text-slate-300 mx-auto mb-1" /><span className="text-xs text-slate-400">Tap to upload photos</span></>}
                <input type="file" accept="image/*" multiple onChange={handleRoomPhoto} className="hidden" />
              </label>
              {form.roomPhotos.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {form.roomPhotos.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Theme',    value: theme.title },
                { label: 'Date',     value: new Date(form.eventDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
                { label: 'Time',     value: form.eventTimeSlot },
                { label: 'Address',  value: `${form.address.line1}, ${form.address.city} ${form.address.pincode}` },
                { label: 'Guests',   value: `${form.guestCount} guests` },
                ...(form.notes ? [{ label: 'Notes', value: form.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500 font-medium shrink-0">{label}</span>
                  <span className="text-slate-900 text-right">{value}</span>
                </div>
              ))}
            </div>

            {/* Payment breakdown */}
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="font-bold text-sm text-slate-900 mb-3">Payment Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Total amount</span><span className="font-semibold">₹{Math.round(totalPaise / 100).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-indigo-700"><span className="font-semibold">Advance to pay now (20%)</span><span className="font-bold">₹{Math.round(advancePaise / 100).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-slate-500"><span>Remaining (on event day)</span><span>₹{Math.round((totalPaise - advancePaise) / 100).toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 border border-amber-100">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Cancellation policy: Full refund if cancelled 7+ days before event. Partial refund within 3–7 days.</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4">
        {step < 3 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext[step]}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {submitting ? 'Creating Booking…' : `Confirm & Pay ₹${Math.round(advancePaise / 100).toLocaleString('en-IN')} Advance`}
          </button>
        )}
      </div>
    </div>
  );
}
