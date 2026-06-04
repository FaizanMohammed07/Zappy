import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAuth } from '../../modules/auth/authSlice';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Star, Package, Calendar, Wallet, User, LogOut,
  Plus, Loader2, CheckCircle, XCircle, Clock, ChevronRight, Upload,
  Trash2, Edit3, AlertCircle, TrendingUp, PartyPopper, X, Camera, FileText,
} from 'lucide-react';
import {
  usePartnerOverviewQuery, usePartnerMeQuery, useUpdatePartnerMeMutation,
  usePartnerThemesQuery, useCreateEventThemeMutation, useUpdateEventThemeMutation, useDeleteEventThemeMutation,
  usePartnerBookingsQuery, useUpdatePartnerBookingStatusMutation, useDeclineEventBookingMutation,
  usePartnerCalendarQuery, useBlockEventDateMutation, useUnblockEventDateMutation,
  usePartnerEarningsQuery, useGetEventCategoriesQuery, usePresignUploadMutation,
  useLogoutMutation,
} from '../../services/api';
import { logout } from '../../modules/auth/authSlice';
import toast from 'react-hot-toast';

/* ── Shared Pill ──────────────────────────────────────────────────────────── */
const STATUS_COLORS = {
  pending:          'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved:         'bg-green-50  text-green-700  border-green-200',
  featured:         'bg-purple-50 text-purple-700 border-purple-200',
  rejected:         'bg-red-50    text-red-700    border-red-200',
  hidden:           'bg-slate-50  text-slate-500  border-slate-200',
  confirmed:        'bg-blue-50   text-blue-700   border-blue-200',
  partner_assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress:      'bg-orange-50 text-orange-700 border-orange-200',
  completed:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:        'bg-red-50    text-red-700    border-red-200',
  pending_payment:  'bg-slate-50  text-slate-500  border-slate-200',
};
function Pill({ status }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{status?.replace(/_/g, ' ')}</span>;
}

/* ── Overview Tab ─────────────────────────────────────────────────────────── */
function OverviewTab() {
  const { data, isLoading } = usePartnerOverviewQuery();
  if (isLoading) return <Spinner />;
  const { partner, stats } = data || {};

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">Welcome back,</p>
        <h2 className="text-xl font-black">{partner?.businessName}</h2>
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1"><Star size={13} className="text-yellow-300 fill-yellow-300" />{partner?.rating?.toFixed(1) || '–'} rating</div>
          <div>{partner?.completedEvents || 0} events done</div>
          <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${partner?.kyc?.status === 'approved' ? 'bg-green-400/20 text-green-200' : 'bg-yellow-400/20 text-yellow-200'}`}>KYC: {partner?.kyc?.status}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'My Themes',          value: stats?.themes || 0,                color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Upcoming (7 days)',  value: stats?.upcomingEvents || 0,         color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Pending Confirm',    value: stats?.pendingConfirmations || 0,   color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Net Earned',         value: `₹${Math.round((stats?.netEarningsPaise || 0) / 100).toLocaleString('en-IN')}`, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {partner?.kyc?.status !== 'approved' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">KYC Not Approved</p>
            <p className="text-xs text-amber-600 mt-0.5">You can't upload themes until KYC is approved. Contact your Zappy account manager.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Themes Tab ───────────────────────────────────────────────────────────── */
function ThemesTab() {
  const { data, isLoading, refetch } = usePartnerThemesQuery();
  const [deleteTheme] = useDeleteEventThemeMutation();
  const [showUpload, setShowUpload] = useState(false);
  const [editTheme, setEditTheme] = useState(null);

  async function handleDelete(id) {
    if (!window.confirm('Delete this theme?')) return;
    try { await deleteTheme(id).unwrap(); toast.success('Deleted'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Cannot delete'); }
  }

  const themes = data?.themes || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{themes.length} theme{themes.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditTheme(null); setShowUpload(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Plus size={14} />Add Theme
        </button>
      </div>

      {isLoading ? <Spinner /> : themes.length === 0 ? (
        <EmptyState icon={Star} text="No themes yet" sub="Upload your first decoration theme" />
      ) : (
        <div className="space-y-2">
          {themes.map(theme => (
            <div key={theme._id} className="bg-white rounded-xl border border-slate-200 p-3 flex gap-3 items-start">
              {theme.coverImage && <img src={theme.coverImage} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 truncate">{theme.title}</span>
                  <Pill status={theme.status} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{theme.categoryId?.name} · ₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')}</p>
                {theme.status === 'rejected' && theme.adminNote && (
                  <p className="text-xs text-red-500 mt-1 italic">Rejection note: {theme.adminNote}</p>
                )}
                {theme.status === 'pending' && <p className="text-xs text-amber-600 mt-1">Under admin review</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {['pending', 'rejected'].includes(theme.status) && (
                  <button onClick={() => { setEditTheme(theme); setShowUpload(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"><Edit3 size={13} /></button>
                )}
                {!['approved', 'featured'].includes(theme.status) && (
                  <button onClick={() => handleDelete(theme._id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <ThemeUploadModal theme={editTheme} onClose={() => { setShowUpload(false); setEditTheme(null); }} onSuccess={() => { setShowUpload(false); setEditTheme(null); refetch(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Theme Upload Modal ───────────────────────────────────────────────────── */
function ThemeUploadModal({ theme, onClose, onSuccess }) {
  const { data: catData } = useGetEventCategoriesQuery();
  const [createTheme] = useCreateEventThemeMutation();
  const [updateTheme] = useUpdateEventThemeMutation();
  const [presignUpload] = usePresignUploadMutation();
  const isEdit = !!theme;

  const [form, setForm] = useState({
    title:               theme?.title || '',
    description:         theme?.description || '',
    categoryId:          theme?.categoryId?._id || theme?.categoryId || '',
    startingPricePaise:  theme?.startingPricePaise ? Math.round(theme.startingPricePaise / 100) : '',
    coverImage:          theme?.coverImage || '',
    gallery:             theme?.gallery || [],
    videoUrl:            theme?.videoUrl || '',
    includedItems:       theme?.includedItems?.join(', ') || '',
    excludedItems:       theme?.excludedItems?.join(', ') || '',
    setupDurationMinutes:theme?.setupDurationMinutes || 120,
    cities:              theme?.cities?.join(', ') || '',
    guestCapacityMax:    theme?.guestCapacity?.max || 200,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function uploadImage(file, multi = false) {
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'event-photos' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (multi) set('gallery', [...form.gallery, signed.key]);
      else set('coverImage', signed.key);
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!form.title || !form.categoryId || !form.startingPricePaise || !form.coverImage) {
      return toast.error('Fill in required fields (title, category, price, cover photo)');
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, categoryId: form.categoryId,
        startingPricePaise: Number(form.startingPricePaise) * 100,
        coverImage: form.coverImage, gallery: form.gallery, videoUrl: form.videoUrl || undefined,
        includedItems: form.includedItems.split(',').map(s => s.trim()).filter(Boolean),
        excludedItems: form.excludedItems ? form.excludedItems.split(',').map(s => s.trim()).filter(Boolean) : [],
        setupDurationMinutes: Number(form.setupDurationMinutes),
        cities: form.cities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        guestCapacity: { min: 1, max: Number(form.guestCapacityMax) },
      };
      if (isEdit) await updateTheme({ id: theme._id, ...payload }).unwrap();
      else await createTheme(payload).unwrap();
      toast.success(isEdit ? 'Theme updated — pending review' : 'Theme submitted for review');
      onSuccess();
    } catch (e) { toast.error(e?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Theme' : 'Upload New Theme'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cover photo */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Cover Photo <span className="text-red-400">*</span></label>
            <label className="block border-2 border-dashed border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-violet-300 transition-all">
              {form.coverImage ? (
                <img src={form.coverImage.startsWith('http') ? form.coverImage : `#`} alt="" className="w-full h-40 object-cover" onError={e => e.target.style.display='none'} />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                  {uploading ? <Loader2 size={20} className="animate-spin text-violet-400" /> : <><Camera size={20} className="mb-1" /><span className="text-xs">Upload cover photo</span></>}
                </div>
              )}
              <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} className="hidden" />
            </label>
          </div>

          {/* Gallery */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Gallery (up to 10 photos)</label>
            <div className="flex gap-2 flex-wrap">
              {form.gallery.map((k, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
                  <button onClick={() => set('gallery', form.gallery.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center z-10">
                    <X size={8} className="text-white" />
                  </button>
                </div>
              ))}
              {form.gallery.length < 10 && (
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-violet-300">
                  <Plus size={16} className="text-slate-400" />
                  <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadImage(e.target.files[0], true)} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Fields */}
          {[
            { k: 'title',       label: 'Theme Title *',           placeholder: 'e.g. Pastel Birthday Wonderland',    required: true },
            { k: 'description', label: 'Description',             placeholder: 'Describe the setup, mood, style…',   multi: true },
            { k: 'videoUrl',    label: 'Video URL (optional)',     placeholder: 'YouTube / Drive link or S3 key' },
            { k: 'includedItems', label: 'Included (comma separated)', placeholder: 'Balloons, Backdrop, Table setup…' },
            { k: 'excludedItems', label: 'Not Included (comma separated)', placeholder: 'Cake, DJ, Catering…' },
            { k: 'cities',        label: 'Cities Served (comma separated)', placeholder: 'bangalore, mumbai, hyderabad' },
          ].map(({ k, label, placeholder, required, multi }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">{label}</label>
              {multi ? (
                <textarea value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none resize-none" />
              ) : (
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} required={required}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
              )}
            </div>
          ))}

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Category <span className="text-red-400">*</span></label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none bg-white">
                <option value="">Select…</option>
                {(catData?.categories || []).map(c => <option key={c._id} value={c._id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Starting Price (₹) <span className="text-red-400">*</span></label>
              <input type="number" min={0} value={form.startingPricePaise} onChange={e => set('startingPricePaise', e.target.value)}
                placeholder="e.g. 3500" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Setup Duration (min)</label>
              <input type="number" min={30} value={form.setupDurationMinutes} onChange={e => set('setupDurationMinutes', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Max Guests</label>
              <input type="number" min={1} value={form.guestCapacityMax} onChange={e => set('guestCapacityMax', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || uploading}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {saving ? 'Saving…' : isEdit ? 'Update & Resubmit' : 'Submit for Review'}
          </button>
          <p className="text-center text-xs text-slate-400">Admin will review within 24 hours before it goes live</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Bookings Tab ─────────────────────────────────────────────────────────── */
function BookingsTab() {
  const [statusFilter, setStatusFilter] = useState('confirmed');
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = usePartnerBookingsQuery({ status: statusFilter || undefined, page });
  const [updateStatus]  = useUpdatePartnerBookingStatusMutation();
  const [declineBooking]= useDeclineEventBookingMutation();

  const NEXT_STATUS = {
    confirmed:        { label: 'Mark On Way',   next: 'partner_assigned', color: 'bg-blue-500' },
    partner_assigned: { label: 'Start Work',    next: 'in_progress',      color: 'bg-orange-500' },
    in_progress:      { label: 'Mark Complete', next: 'completed',        color: 'bg-green-500' },
  };

  async function handleStatus(id, next) {
    try { await updateStatus({ id, status: next }).unwrap(); toast.success('Updated'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Failed'); }
  }

  async function handleDecline(id) {
    const reason = window.prompt('Reason for declining this booking:');
    if (reason === null) return;
    try { await declineBooking({ id, reason: reason || 'Partner unavailable' }).unwrap(); toast.success('Booking declined'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Failed to decline'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {['', 'confirmed', 'partner_assigned', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {s.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (data?.bookings || []).length === 0 ? (
        <EmptyState icon={Package} text="No bookings" sub="Bookings will appear here" />
      ) : (
        <div className="space-y-2">
          {(data.bookings || []).map(b => (
            <div key={b._id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-900">{b.themeId?.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.userId?.name} · {b.userId?.phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    📅 {b.eventDate ? new Date(b.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {b.eventTimeSlot}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">📍 {b.address?.line1}, {b.address?.city} · 👥 {b.guestCount} guests</p>
                  {b.notes && <p className="text-xs text-indigo-600 mt-1">📝 {b.notes}</p>}
                </div>
                <Pill status={b.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">₹{Math.round((b.pricing?.totalPaise || 0) / 100).toLocaleString('en-IN')}</span>
                <div className="flex gap-1.5">
                  {b.status === 'confirmed' && (
                    <button onClick={() => handleDecline(b._id)}
                      className="px-2.5 py-1.5 border border-red-200 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-50">
                      Decline
                    </button>
                  )}
                  {NEXT_STATUS[b.status] && (
                    <button onClick={() => handleStatus(b._id, NEXT_STATUS[b.status].next)}
                      className={`px-3 py-1.5 ${NEXT_STATUS[b.status].color} text-white rounded-xl text-xs font-semibold`}>
                      {NEXT_STATUS[b.status].label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Calendar Tab ─────────────────────────────────────────────────────────── */
function CalendarTab() {
  const { data, isLoading, refetch } = usePartnerCalendarQuery();
  const [blockDate]   = useBlockEventDateMutation();
  const [unblockDate] = useUnblockEventDateMutation();
  const [selectedDate, setSelectedDate] = useState('');

  const blockedDates = (data?.blockedDates || []).map(d => new Date(d).toDateString());
  const bookedDates  = (data?.bookings || []).map(b => ({
    date: new Date(b.eventDate).toDateString(),
    label: b.themeId?.title, time: b.eventTimeSlot, status: b.status,
  }));

  async function handleToggle(dateStr) {
    const d = new Date(dateStr);
    const iso = d.toISOString().split('T')[0];
    try {
      if (blockedDates.includes(d.toDateString())) {
        await unblockDate(iso).unwrap(); toast.success('Date unblocked');
      } else {
        await blockDate({ date: iso }).unwrap(); toast.success('Date blocked');
      }
      refetch();
    } catch { toast.error('Failed'); }
  }

  // Build next 60 days
  const days = Array.from({ length: 60 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Tap a date to block/unblock. Booked dates cannot be blocked.</p>
      {isLoading ? <Spinner /> : (
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 pb-1">{d}</div>
          ))}
          {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const ds = day.toDateString();
            const isBlocked = blockedDates.includes(ds);
            const booked    = bookedDates.find(b => b.date === ds);
            const isPast    = day < new Date(new Date().setHours(0,0,0,0));
            return (
              <button key={ds} disabled={isPast || !!booked}
                onClick={() => !isPast && !booked && handleToggle(ds)}
                className={`aspect-square rounded-lg text-xs font-semibold transition-all flex items-center justify-center
                  ${isPast ? 'opacity-30 cursor-not-allowed text-slate-400'
                  : booked ? 'bg-blue-500 text-white cursor-not-allowed'
                  : isBlocked ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-700'}`}>
                {day.getDate()}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 text-xs flex-wrap">
        {[['bg-blue-500', 'Booked'], ['bg-red-500', 'Blocked'], ['bg-slate-100', 'Available']].map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded ${bg}`} /><span className="text-slate-600">{label}</span></div>
        ))}
      </div>

      {(data?.bookings || []).length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Upcoming Events</p>
          <div className="space-y-1.5">
            {data.bookings.map(b => (
              <div key={b._id} className="flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">{b.themeId?.title}</span>
                  <span className="text-slate-500 ml-2">{new Date(b.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {b.eventTimeSlot}</span>
                </div>
                <Pill status={b.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Earnings Tab ─────────────────────────────────────────────────────────── */
function EarningsTab() {
  const { data, isLoading } = usePartnerEarningsQuery();
  if (isLoading) return <Spinner />;
  const d = data || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gross Earned', value: `₹${Math.round((d.grossPaise || 0) / 100).toLocaleString('en-IN')}`, color: 'text-slate-900' },
          { label: 'Platform Fee', value: `₹${Math.round((d.platformPaise || 0) / 100).toLocaleString('en-IN')}`, color: 'text-red-500' },
          { label: 'Net Earnings', value: `₹${Math.round((d.netPaise || 0) / 100).toLocaleString('en-IN')}`, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[10px] text-slate-500 font-medium">{label}</p>
            <p className={`text-base font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Monthly Breakdown</p>
        <div className="space-y-2">
          {(d.monthly || []).map(m => (
            <div key={`${m._id.year}-${m._id.month}`} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{new Date(m._id.year, m._id.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
              <div className="text-right">
                <span className="font-bold text-slate-900">₹{Math.round((m.grossPaise || 0) / 100).toLocaleString('en-IN')}</span>
                <span className="text-xs text-slate-400 ml-1">({m.count} jobs)</span>
              </div>
            </div>
          ))}
          {!d.monthly?.length && <p className="text-sm text-slate-400">No completed jobs yet</p>}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-700">💡 Platform commission is {15}%. Payouts are processed weekly to your registered bank account.</p>
      </div>
    </div>
  );
}

/* ── Profile Tab ──────────────────────────────────────────────────────────── */
function ProfileTab() {
  const { data, refetch } = usePartnerMeQuery();
  const [updateMe] = useUpdatePartnerMeMutation();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const partner = data?.partner;
  const values = form || partner || {};

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMe({
        bio: values.bio,
        yearsExperience: Number(values.yearsExperience),
        cities: typeof values.cities === 'string'
          ? values.cities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          : values.cities,
        serviceRadiusKm: Number(values.serviceRadiusKm),
      }).unwrap();
      toast.success('Profile updated');
      setForm(null);
      refetch();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  if (!partner) return <Spinner />;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <label className="relative cursor-pointer shrink-0">
          {partner.profilePhotoKey ? (
            <img src={partner.profilePhotoKey} alt="" className="w-16 h-16 rounded-xl object-cover" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-fuchsia-400 rounded-xl flex items-center justify-center text-white font-black text-xl">
              {partner.businessName?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
            <Camera size={10} className="text-white" />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            try {
              const { data: signed } = await presignUpload({ contentType: file.type, folder: 'event-photos' });
              await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
              await updateMe({ profilePhotoKey: signed.key }).unwrap();
              toast.success('Photo updated'); refetch();
            } catch { toast.error('Upload failed'); }
          }} />
        </label>
        <div>
          <p className="font-bold text-slate-900">{partner.businessName}</p>
          <p className="text-xs text-slate-500">{partner.phone} · {partner.email || 'No email'}</p>
          <div className="flex items-center gap-2 mt-1">
            <Pill status={partner.kyc?.status === 'approved' ? 'approved' : partner.kyc?.status || 'pending'} />
            <span className="text-xs text-slate-400">KYC Status</span>
          </div>
        </div>
      </div>

      {[
        { k: 'bio',               label: 'About Your Business',        placeholder: 'Tell customers about your work…', multi: true },
        { k: 'yearsExperience',   label: 'Years of Experience',        placeholder: '5', type: 'number' },
        { k: 'cities',            label: 'Cities Served (comma separated)', placeholder: 'bangalore, mumbai' },
        { k: 'serviceRadiusKm',   label: 'Service Radius (km)',        placeholder: '30', type: 'number' },
      ].map(({ k, label, placeholder, multi, type }) => (
        <div key={k}>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">{label}</label>
          {multi ? (
            <textarea value={values[k] || ''} onChange={e => setForm(p => ({ ...(p || values), [k]: e.target.value }))}
              placeholder={placeholder} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none resize-none" />
          ) : (
            <input type={type || 'text'} value={values[k] || ''} onChange={e => setForm(p => ({ ...(p || values), [k]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
          )}
        </div>
      ))}

      <button type="submit" disabled={saving || !form}
        className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-40">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        {saving ? 'Saving…' : 'Save Profile'}
      </button>

      {/* KYC Document Upload */}
      <KycUploadSection partner={partner} onRefresh={refetch} />
    </form>
  );
}

/* ── KYC Doc image loader (fetches from authenticated stream endpoint) ──────── */
function KycDocThumb({ idx, token }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const objRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/events/partner/kyc/stream/${idx}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => {
        if (cancelled) return;
        if (objRef.current) URL.revokeObjectURL(objRef.current);
        const u = URL.createObjectURL(blob);
        objRef.current = u;
        setUrl(u);
      })
      .catch(() => setUrl(null))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [idx, token]);

  useEffect(() => () => { if (objRef.current) URL.revokeObjectURL(objRef.current); }, []);

  return (
    <>
      {lightbox && url && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={() => setLightbox(false)}>
          <img src={url} alt={`KYC Doc ${idx + 1}`} className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(false)}>✕</button>
        </div>
      )}
      <div onClick={() => url && setLightbox(true)}
        className={`w-16 h-16 rounded-lg border-2 overflow-hidden flex items-center justify-center ${url ? 'border-green-300 cursor-pointer hover:opacity-80' : 'border-slate-200 bg-slate-50'}`}>
        {loading ? <Loader2 size={14} className="animate-spin text-slate-300" />
          : url ? <img src={url} alt={`Doc ${idx + 1}`} className="w-full h-full object-cover" />
          : <FileText size={16} className="text-slate-300" />}
      </div>
    </>
  );
}

/* ── KYC Upload Section ───────────────────────────────────────────────────── */
function KycUploadSection({ partner, onRefresh }) {
  const { accessToken: token } = useSelector(selectAuth);
  const [presignUpload] = usePresignUploadMutation();
  const [updateMe] = useUpdatePartnerMeMutation();
  const [uploading, setUploading] = useState(false);
  const docs = partner?.kyc?.documents || [];

  async function handleUpload(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('File too large — max 8MB');
    if (docs.length >= 5) return toast.error('Max 5 KYC documents allowed');
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'event-photos' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await updateMe({ kycDocument: signed.key }).unwrap();
      toast.success('Document uploaded — pending admin review');
      onRefresh();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  const kycStatus = partner?.kyc?.status || 'not_submitted';
  const KYC_COLOR = { approved: 'bg-green-50 border-green-200 text-green-700', rejected: 'bg-red-50 border-red-200 text-red-600', pending: 'bg-yellow-50 border-yellow-200 text-yellow-700', not_submitted: 'bg-slate-50 border-slate-200 text-slate-500' };

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">KYC Documents</p>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${KYC_COLOR[kycStatus]}`}>{kycStatus.replace('_', ' ')}</span>
      </div>

      {kycStatus === 'rejected' && partner?.kyc?.reviewNote && (
        <div className="flex items-start gap-2 bg-red-50 rounded-lg p-2.5">
          <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">Rejected: {partner.kyc.reviewNote}. Please re-upload correct documents.</p>
        </div>
      )}

      <p className="text-xs text-slate-500">Upload GST certificate, PAN card, or business registration. Tap to view. Admin reviews within 24 hours.</p>

      <div className="flex gap-2 flex-wrap">
        {docs.map((_, i) => (
          <KycDocThumb key={i} idx={i} token={token} />
        ))}
        {docs.length < 5 && kycStatus !== 'approved' && (
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-violet-200 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
            {uploading ? <Loader2 size={16} className="animate-spin text-violet-400" /> : <><Plus size={16} className="text-violet-400" /><span className="text-[9px] text-violet-400 mt-0.5">Upload</span></>}
            <input type="file" accept="image/*,.pdf" onChange={e => handleUpload(e.target.files?.[0])} className="hidden" />
          </label>
        )}
      </div>

      {docs.length === 0 && kycStatus !== 'approved' && (
        <p className="text-xs text-amber-600 font-medium">⚠️ Upload at least 1 document to apply for KYC review</p>
      )}
      {kycStatus === 'approved' && (
        <p className="text-xs text-green-600 font-medium">✅ KYC approved — you can upload and manage themes</p>
      )}
    </div>
  );
}

/* ── Shared helpers ───────────────────────────────────────────────────────── */
function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-violet-400" /></div>;
}
function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div className="text-center py-12">
      <Icon size={32} className="text-slate-200 mx-auto mb-2" />
      <p className="font-semibold text-slate-600 text-sm">{text}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
  { id: 'themes',    label: 'Themes',    Icon: Star            },
  { id: 'bookings',  label: 'Bookings',  Icon: Package         },
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar        },
  { id: 'earnings',  label: 'Earnings',  Icon: Wallet          },
  { id: 'profile',   label: 'Profile',   Icon: User            },
];

export default function PartnerDashboard() {
  const dispatch = useDispatch();
  const [doLogout] = useLogoutMutation();
  const [activeTab, setActiveTab] = useState('overview');

  async function handleLogout() {
    try { await doLogout().unwrap(); } catch {}
    dispatch(logout());
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
            <PartyPopper size={14} className="text-white" />
          </div>
          <span className="font-black text-slate-900 text-sm">Zappy Partner</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors">
          <LogOut size={14} />Logout
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'themes'   && <ThemesTab />}
            {activeTab === 'bookings' && <BookingsTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'earnings' && <EarningsTab />}
            {activeTab === 'profile'  && <ProfileTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all ${activeTab === id ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 1.8} />
            <span className={`text-[9px] font-semibold ${activeTab === id ? 'font-bold' : ''}`}>{label}</span>
            {activeTab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-600 rounded-full" />}
          </button>
        ))}
      </div>
    </div>
  );
}
