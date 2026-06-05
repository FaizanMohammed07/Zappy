import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAuth } from '../../modules/auth/authSlice';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Star, Package, Calendar, Wallet, User, LogOut,
  Plus, Loader2, CheckCircle, Clock, ChevronRight, Upload,
  Trash2, Edit3, AlertCircle, PartyPopper, X, Camera, FileText,
  TrendingUp, BadgeCheck, IndianRupee, CalendarCheck, Sparkles,
  ShieldCheck, ArrowRight, Bell, ChevronDown,
} from 'lucide-react';
import {
  usePartnerOverviewQuery, usePartnerMeQuery, useUpdatePartnerMeMutation,
  usePartnerThemesQuery, useCreateEventThemeMutation, useUpdateEventThemeMutation, useDeleteEventThemeMutation,
  usePartnerBookingsQuery, useUpdatePartnerBookingStatusMutation, useDeclineEventBookingMutation,
  usePartnerCalendarQuery, useBlockEventDateMutation, useUnblockEventDateMutation,
  usePartnerEarningsQuery, useGetEventCategoriesQuery, usePresignUploadMutation,
  usePartnerNotificationsQuery, useMarkPartnerNotificationReadMutation, useMarkAllPartnerNotificationsReadMutation,
  useLogoutMutation,
} from '../../services/api';
import { logout } from '../../modules/auth/authSlice';
import LiveSelfieCapture from '../../components/kyc/LiveSelfieCapture';
import toast from 'react-hot-toast';

/* ─── Status pill ───────────────────────────────────────────────────────────── */
const PILL = {
  pending:          'bg-amber-50  text-amber-700  border-amber-200',
  approved:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  featured:         'bg-purple-50 text-purple-700 border-purple-200',
  rejected:         'bg-red-50    text-red-700    border-red-200',
  hidden:           'bg-slate-100 text-slate-500  border-slate-200',
  confirmed:        'bg-blue-50   text-blue-700   border-blue-200',
  partner_assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress:      'bg-orange-50 text-orange-600 border-orange-200',
  completed:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:        'bg-red-50    text-red-500    border-red-200',
  not_submitted:    'bg-slate-100 text-slate-500  border-slate-200',
};
function Pill({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${PILL[status] || PILL.hidden} ${className}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

/* ─── Spinner / Empty ───────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-violet-500" />
      </div>
    </div>
  );
}
function EmptyState({ icon: Icon, text, sub, action }) {
  return (
    <div className="text-center py-14">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Icon size={28} className="text-slate-300" />
      </div>
      <p className="font-bold text-slate-700 text-sm">{text}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, gradient, sub }) {
  return (
    <div className={`rounded-2xl p-4 ${gradient} relative overflow-hidden`}>
      <div className="absolute top-2 right-2 opacity-10">
        <Icon size={40} />
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="opacity-70" />
        <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Overview ──────────────────────────────────────────────────────────────── */
function OverviewTab({ onNavigate }) {
  const { data, isLoading } = usePartnerOverviewQuery();
  if (isLoading) return <Spinner />;
  const { partner, stats } = data || {};
  const kycOk = partner?.kyc?.status === 'approved';

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
        <div className="relative p-5 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/70 text-xs font-medium">Welcome back 👋</p>
              <h2 className="text-xl font-black text-white mt-0.5">{partner?.businessName}</h2>
              <p className="text-white/60 text-xs mt-1">{partner?.email || partner?.phone}</p>
            </div>
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
              <PartyPopper size={20} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <Star size={11} className="text-yellow-300 fill-yellow-300" />
              <span className="text-white text-xs font-bold">{partner?.rating?.toFixed(1) || '0.0'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <CalendarCheck size={11} className="text-white/80" />
              <span className="text-white text-xs font-bold">{partner?.completedEvents || 0} events</span>
            </div>
            <button
              onClick={() => onNavigate('profile')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${kycOk ? 'bg-emerald-400/20 border border-emerald-400/40' : 'bg-amber-400/20 border border-amber-400/40'}`}
            >
              {kycOk ? <BadgeCheck size={11} className="text-emerald-300" /> : <AlertCircle size={11} className="text-amber-300" />}
              <span className={`text-xs font-bold ${kycOk ? 'text-emerald-200' : 'text-amber-200'}`}>
                KYC {kycOk ? 'Verified' : partner?.kyc?.status?.replace('_', ' ') || 'not submitted'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="My Themes"       value={stats?.themes || 0}       icon={Star}        gradient="bg-violet-50 text-violet-700" />
        <StatCard label="Upcoming"        value={stats?.upcomingEvents || 0}  icon={CalendarCheck} gradient="bg-blue-50 text-blue-700"   sub="next 7 days" />
        <StatCard label="Pending Confirm" value={stats?.pendingConfirmations || 0} icon={Clock} gradient="bg-amber-50 text-amber-700" />
        <StatCard label="Net Earned"
          value={`₹${Math.round((stats?.netEarningsPaise || 0) / 100).toLocaleString('en-IN')}`}
          icon={IndianRupee} gradient="bg-emerald-50 text-emerald-700" />
      </div>

      {/* KYC action banner */}
      {!kycOk && (
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => onNavigate('profile')}
          className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 text-left group hover:shadow-md transition-shadow"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Complete KYC Verification</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {partner?.kyc?.status === 'pending' ? 'Documents submitted — admin reviewing within 24h' : 'Upload documents to start accepting bookings'}
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-amber-500 shrink-0 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Upload Theme', icon: Plus,       tab: 'themes',   gradient: 'from-violet-500 to-fuchsia-500' },
          { label: 'View Bookings', icon: Package,    tab: 'bookings', gradient: 'from-blue-500 to-indigo-500' },
          { label: 'My Earnings',   icon: TrendingUp, tab: 'earnings', gradient: 'from-emerald-500 to-teal-500' },
          { label: 'Calendar',      icon: Calendar,   tab: 'calendar', gradient: 'from-orange-500 to-rose-500' },
        ].map(({ label, icon: Icon, tab, gradient }) => (
          <button key={tab} onClick={() => onNavigate(tab)}
            className={`flex items-center gap-2.5 bg-gradient-to-r ${gradient} text-white rounded-2xl p-3.5 hover:opacity-90 transition-opacity active:scale-95`}>
            <Icon size={16} />
            <span className="text-sm font-bold">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Themes ────────────────────────────────────────────────────────────────── */
function ThemesTab() {
  const { data, isLoading, refetch } = usePartnerThemesQuery();
  const [deleteTheme] = useDeleteEventThemeMutation();
  const [showUpload, setShowUpload] = useState(false);
  const [editTheme, setEditTheme]   = useState(null);

  async function handleDelete(id) {
    if (!window.confirm('Delete this theme?')) return;
    try { await deleteTheme(id).unwrap(); toast.success('Deleted'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Cannot delete'); }
  }

  const themes = data?.themes || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">{themes.length} theme{themes.length !== 1 ? 's' : ''}</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setEditTheme(null); setShowUpload(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-violet-200">
          <Plus size={13} />Add Theme
        </motion.button>
      </div>

      {isLoading ? <Spinner /> : themes.length === 0 ? (
        <EmptyState icon={Sparkles} text="No themes yet"
          sub="Upload your first decoration theme to start getting bookings"
          action={
            <button onClick={() => setShowUpload(true)}
              className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold">
              Upload First Theme
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {themes.map(theme => (
            <motion.div key={theme._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-3 p-3.5">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  {theme.coverImage ? (
                    <img src={theme.coverImage} alt=""
                      className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Star size={20} className="text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-slate-900 leading-tight truncate">{theme.title}</p>
                    <Pill status={theme.status} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{theme.categoryId?.emoji} {theme.categoryId?.name}</p>
                  <p className="text-sm font-black text-violet-600 mt-1">₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')}+</p>
                  {theme.status === 'rejected' && theme.adminNote && (
                    <p className="text-[10px] text-red-500 mt-1 bg-red-50 rounded-lg px-2 py-1">⚠️ {theme.adminNote}</p>
                  )}
                  {theme.status === 'pending' && (
                    <p className="text-[10px] text-amber-600 mt-1">⏳ Under admin review</p>
                  )}
                </div>
              </div>
              {['pending', 'rejected'].includes(theme.status) && (
                <div className="flex gap-2 px-3.5 pb-3">
                  <button onClick={() => { setEditTheme(theme); setShowUpload(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 transition-colors">
                    <Edit3 size={12} />Edit
                  </button>
                  <button onClick={() => handleDelete(theme._id)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-semibold text-red-500 transition-colors">
                    <Trash2 size={12} />Delete
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <ThemeUploadModal theme={editTheme}
            onClose={() => { setShowUpload(false); setEditTheme(null); }}
            onSuccess={() => { setShowUpload(false); setEditTheme(null); refetch(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Theme Upload Modal ────────────────────────────────────────────────────── */
function ThemeUploadModal({ theme, onClose, onSuccess }) {
  const { data: catData } = useGetEventCategoriesQuery();
  const [createTheme]   = useCreateEventThemeMutation();
  const [updateTheme]   = useUpdateEventThemeMutation();
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
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [coverPreview, setCoverPreview] = useState(theme?.coverImage || null);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function uploadImage(file, multi = false) {
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'event-photos' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (multi) {
        set('gallery', [...form.gallery, signed.key]);
      } else {
        set('coverImage', signed.key);
        setCoverPreview(URL.createObjectURL(file));
      }
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!form.title || !form.categoryId || !form.startingPricePaise || !form.coverImage) {
      return toast.error('Fill in title, category, price and cover photo');
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
      toast.success(isEdit ? 'Theme updated — pending review' : 'Theme submitted for review! 🎉');
      onSuccess();
    } catch (e) { toast.error(e?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'spring', damping: 25 }}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-black text-slate-900">{isEdit ? 'Edit Theme' : 'Upload New Theme'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Admin reviews within 24 hours</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
            <X size={15} className="text-slate-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cover photo */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Cover Photo <span className="text-red-400">*</span></label>
            <label className="block border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-violet-300 transition-all">
              {coverPreview ? (
                <div className="relative h-44">
                  <img src={coverPreview} alt=""
                    className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-2">
                  {uploading ? <Loader2 size={22} className="animate-spin text-violet-400" /> : (
                    <><Camera size={22} className="text-slate-300" /><span className="text-xs font-medium">Upload cover photo</span></>
                  )}
                </div>
              )}
              <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} className="hidden" />
            </label>
          </div>

          {/* Core fields */}
          {[
            { k: 'title',       label: 'Theme Title *',     placeholder: 'e.g. Pastel Birthday Wonderland' },
            { k: 'description', label: 'Description',       placeholder: 'Describe the setup, mood, style…', multi: true },
            { k: 'includedItems', label: 'Included (comma separated)', placeholder: 'Balloons, Backdrop, Table setup…' },
            { k: 'excludedItems', label: 'Not Included',    placeholder: 'Cake, DJ, Catering…' },
            { k: 'cities',        label: 'Cities Served',   placeholder: 'bangalore, mumbai, hyderabad' },
            { k: 'videoUrl',      label: 'Video URL (optional)', placeholder: 'YouTube / Drive link' },
          ].map(({ k, label, placeholder, multi }) => (
            <div key={k}>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">{label}</label>
              {multi ? (
                <textarea value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none transition-all" />
              ) : (
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" />
              )}
            </div>
          ))}

          {/* Category + Price grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Category *</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none bg-white">
                <option value="">Select…</option>
                {(catData?.categories || []).map(c => <option key={c._id} value={c._id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Starting Price (₹) *</label>
              <input type="number" min={0} value={form.startingPricePaise} onChange={e => set('startingPricePaise', e.target.value)}
                placeholder="3500"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Setup Duration (min)</label>
              <input type="number" min={30} value={form.setupDurationMinutes} onChange={e => set('setupDurationMinutes', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Max Guests</label>
              <input type="number" min={1} value={form.guestCapacityMax} onChange={e => set('guestCapacityMax', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 outline-none" />
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving || uploading}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-200">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {saving ? 'Saving…' : isEdit ? 'Update & Resubmit' : 'Submit for Review'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Bookings ──────────────────────────────────────────────────────────────── */
function BookingsTab() {
  const [statusFilter, setStatusFilter] = useState('confirmed');
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = usePartnerBookingsQuery({ status: statusFilter || undefined, page });
  const [updateStatus]   = useUpdatePartnerBookingStatusMutation();
  const [declineBooking] = useDeclineEventBookingMutation();

  const NEXT = {
    confirmed:        { label: 'On My Way',    next: 'partner_assigned', color: 'bg-blue-500' },
    partner_assigned: { label: 'Start Setup',  next: 'in_progress',      color: 'bg-orange-500' },
    in_progress:      { label: 'Mark Done ✓',  next: 'completed',        color: 'bg-emerald-500' },
  };
  const FILTERS = ['', 'confirmed', 'partner_assigned', 'in_progress', 'completed', 'cancelled'];

  async function handleStatus(id, next) {
    try { await updateStatus({ id, status: next }).unwrap(); toast.success('Status updated'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Failed'); }
  }
  async function handleDecline(id) {
    const reason = window.prompt('Reason for declining:');
    if (reason === null) return;
    try { await declineBooking({ id, reason: reason || 'Partner unavailable' }).unwrap(); toast.success('Booking declined'); refetch(); }
    catch (e) { toast.error(e?.data?.error || 'Failed'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {FILTERS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${statusFilter === s ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            {s.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : !(data?.bookings?.length) ? (
        <EmptyState icon={Package} text="No bookings" sub="Bookings will appear here once customers book your themes" />
      ) : (
        <div className="space-y-3">
          {data.bookings.map(b => (
            <motion.div key={b._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-900">{b.themeId?.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.userId?.name} · {b.userId?.phone}</p>
                </div>
                <Pill status={b.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                  <p className="text-slate-400 text-[10px] font-medium">DATE</p>
                  <p className="font-bold text-slate-700 mt-0.5">
                    {b.eventDate ? new Date(b.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    {b.eventTimeSlot && ` · ${b.eventTimeSlot}`}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                  <p className="text-slate-400 text-[10px] font-medium">AMOUNT</p>
                  <p className="font-black text-slate-900 mt-0.5">₹{Math.round((b.pricing?.totalPaise || 0) / 100).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2 col-span-2">
                  <p className="text-slate-400 text-[10px] font-medium">VENUE</p>
                  <p className="font-bold text-slate-700 mt-0.5 truncate">{b.address?.line1}, {b.address?.city} · 👥 {b.guestCount}</p>
                </div>
              </div>

              {b.notes && (
                <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2">📝 {b.notes}</p>
              )}

              <div className="flex gap-2">
                {b.status === 'confirmed' && (
                  <button onClick={() => handleDecline(b._id)}
                    className="flex-1 py-2.5 border border-red-200 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                    Decline
                  </button>
                )}
                {NEXT[b.status] && (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleStatus(b._id, NEXT[b.status].next)}
                    className={`flex-1 py-2.5 ${NEXT[b.status].color} text-white rounded-xl text-xs font-bold shadow-sm`}>
                    {NEXT[b.status].label}
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Calendar date action sheet ───────────────────────────────────────────── */
function DateActionSheet({ day, isBlocked, booking, onBlock, onUnblock, onClose }) {
  const [loading, setLoading] = useState(false);
  const label = day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function act(fn) {
    setLoading(true);
    try { await fn(); onClose(); }
    catch { /* errors toasted in caller */ }
    finally { setLoading(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="bg-white w-full max-w-sm rounded-t-3xl px-5 pt-5 pb-8 space-y-3">

        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

        {/* Date header */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl
            ${booking ? 'bg-blue-100 text-blue-600' : isBlocked ? 'bg-red-100 text-red-500' : 'bg-violet-100 text-violet-600'}`}>
            {day.getDate()}
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {booking ? `Booked · ${booking.themeId?.title}` : isBlocked ? 'Blocked by you' : 'Available'}
            </p>
          </div>
        </div>

        {/* Booking details */}
        {booking && (
          <div className="bg-blue-50 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-blue-900">{booking.themeId?.title}</p>
              <Pill status={booking.status} />
            </div>
            <p className="text-xs text-blue-700">{booking.eventTimeSlot || 'Time not set'} · 👥 {booking.guestCount} guests</p>
            <p className="text-xs text-blue-600 truncate">📍 {booking.address?.city || 'Location not set'}</p>
            <p className="text-xs font-black text-blue-900">₹{Math.round((booking.pricing?.totalPaise || 0) / 100).toLocaleString('en-IN')}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {!booking && !isBlocked && (
            <motion.button whileTap={{ scale: 0.97 }} disabled={loading}
              onClick={() => act(onBlock)}
              className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
              {loading ? <Loader2 size={15} className="animate-spin" /> : '🔒'}
              Block this date
            </motion.button>
          )}
          {!booking && isBlocked && (
            <motion.button whileTap={{ scale: 0.97 }} disabled={loading}
              onClick={() => act(onUnblock)}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
              {loading ? <Loader2 size={15} className="animate-spin" /> : '🔓'}
              Unblock this date
            </motion.button>
          )}
          {booking && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-amber-700 font-medium">This date has a confirmed booking. Cancel the booking first to block it.</p>
            </div>
          )}
          <button onClick={onClose}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Calendar ──────────────────────────────────────────────────────────────── */
function CalendarTab() {
  const { data, isLoading, refetch } = usePartnerCalendarQuery();
  const [blockDate]   = useBlockEventDateMutation();
  const [unblockDate] = useUnblockEventDateMutation();
  const [selected, setSelected] = useState(null); // { day, isBlocked, booking }

  const blocked  = (data?.blockedDates || []).map(d => new Date(d).toDateString());
  const bookings = data?.bookings || [];
  const days     = Array.from({ length: 60 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  function handleDayClick(day) {
    const ds      = day.toDateString();
    const isBlk   = blocked.includes(ds);
    const booking = bookings.find(b => new Date(b.eventDate).toDateString() === ds);
    setSelected({ day, isBlocked: isBlk, booking });
  }

  async function doBlock() {
    const iso = selected.day.toISOString().split('T')[0];
    await blockDate({ date: iso }).unwrap();
    toast.success('Date blocked');
    refetch();
  }

  async function doUnblock() {
    const iso = selected.day.toISOString().split('T')[0];
    await unblockDate(iso).unwrap();
    toast.success('Date unblocked');
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-violet-50 rounded-2xl px-4 py-3">
        <Calendar size={15} className="text-violet-500 shrink-0" />
        <p className="text-xs text-violet-700 font-medium">Tap any date to see options — block, unblock, or view booking details.</p>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(day => {
              const ds      = day.toDateString();
              const isBlk   = blocked.includes(ds);
              const isBkd   = !!bookings.find(b => new Date(b.eventDate).toDateString() === ds);
              const isPast  = day < new Date(new Date().setHours(0, 0, 0, 0));
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <motion.button key={ds}
                  whileHover={!isPast ? { scale: 1.08 } : {}}
                  whileTap={!isPast ? { scale: 0.88 } : {}}
                  disabled={isPast}
                  onClick={() => !isPast && handleDayClick(day)}
                  className={`aspect-square rounded-xl text-xs font-bold transition-all flex items-center justify-center relative
                    ${isPast  ? 'opacity-20 cursor-not-allowed text-slate-400'
                    : isBkd   ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                    : isBlk   ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                    : isToday ? 'bg-violet-600 text-white shadow-sm shadow-violet-200 ring-2 ring-violet-300'
                    : 'bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-700'}`}>
                  {day.getDate()}
                  {(isBkd || isBlk) && !isPast && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          ['bg-violet-600', 'Today'],
          ['bg-blue-500',   'Booked'],
          ['bg-red-500',    'Blocked'],
          ['bg-slate-100 border border-slate-200', 'Available'],
        ].map(([cls, lbl]) => (
          <div key={lbl} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded-md ${cls}`} />
            <span className="text-slate-500 font-medium">{lbl}</span>
          </div>
        ))}
      </div>

      {/* Upcoming events list */}
      {bookings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Upcoming Bookings</p>
          {bookings.map(b => (
            <div key={b._id} className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => handleDayClick(new Date(b.eventDate))}>
              <div>
                <p className="font-bold text-sm text-slate-900">{b.themeId?.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(b.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {b.eventTimeSlot && ` · ${b.eventTimeSlot}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill status={b.status} />
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action sheet */}
      <AnimatePresence>
        {selected && (
          <DateActionSheet
            day={selected.day}
            isBlocked={selected.isBlocked}
            booking={selected.booking}
            onBlock={doBlock}
            onUnblock={doUnblock}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Earnings ──────────────────────────────────────────────────────────────── */
function EarningsTab() {
  const { data, isLoading } = usePartnerEarningsQuery();
  if (isLoading) return <Spinner />;
  const d = data || {};
  const gross  = d.grossPaise  || 0;
  const net    = d.netPaise    || 0;
  const plat   = d.platformPaise || 0;
  const netPct = gross > 0 ? Math.round((net / gross) * 100) : 85;

  return (
    <div className="space-y-4">
      {/* Hero earnings */}
      <div className="rounded-3xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 60%, #34d399 100%)' }}>
        <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Total Net Earnings</p>
        <p className="text-4xl font-black mt-1">₹{Math.round(net / 100).toLocaleString('en-IN')}</p>
        <p className="text-white/60 text-xs mt-2">From {d.totalJobs || 0} completed events</p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Gross',    value: `₹${Math.round(gross / 100).toLocaleString('en-IN')}`,  color: 'text-slate-900', bg: 'bg-white' },
          { label: 'You Keep', value: `100%`,                                             color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl border border-slate-100 p-3 text-center`}>
            <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
            <p className={`text-base font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Monthly */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Monthly Breakdown</p>
        {d.monthly?.length ? (
          <div className="space-y-3">
            {d.monthly.map(m => {
              const mGross = m.grossPaise || 0;
              const maxMonth = Math.max(...(d.monthly || []).map(x => x.grossPaise || 0)) || 1;
              const pct = Math.round((mGross / maxMonth) * 100);
              return (
                <div key={`${m._id.year}-${m._id.month}`}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium text-xs">
                      {new Date(m._id.year, m._id.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-slate-900">₹{Math.round(mGross / 100).toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({m.count} jobs)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">No completed jobs yet</p>
        )}
      </div>
    </div>
  );
}

/* ─── KYC Doc thumbnail ─────────────────────────────────────────────────────── */
function KycDocThumb({ idx, token }) {
  const [url, setUrl]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const objRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
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
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur flex items-center justify-center"
          onClick={() => setLightbox(false)}>
          <img src={url} alt={`Doc ${idx + 1}`} className="max-h-[90vh] max-w-[90vw] rounded-2xl" />
          <button className="absolute top-5 right-5 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
            <X size={16} />
          </button>
        </div>
      )}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => url && setLightbox(true)}
        className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex items-center justify-center cursor-pointer
          ${url ? 'border-emerald-300 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-slate-50'}`}>
        {loading ? <Loader2 size={14} className="animate-spin text-slate-300" />
          : url ? <img src={url} alt="" className="w-full h-full object-cover" />
          : <FileText size={16} className="text-slate-300" />}
      </motion.div>
    </>
  );
}

/* ─── KYC Section ──────────────────────────────────────────────────────────── */
const KYC_FIELDS = [
  { key: 'aadharFront',          label: 'Aadhar Card — Front',     emoji: '🪪', mandatory: true,  hint: 'Front side of your Aadhar card' },
  { key: 'aadharBack',           label: 'Aadhar Card — Back',      emoji: '🪪', mandatory: true,  hint: 'Back side of your Aadhar card' },
  { key: 'panCard',              label: 'PAN Card',                emoji: '🗂️', mandatory: true,  hint: 'Clear photo of your PAN card' },
  { key: 'liveSelfie',           label: 'Live Selfie',             emoji: '🤳', mandatory: true,  hint: 'Take a clear selfie right now', camera: true },
  { key: 'gstCertificate',       label: 'GST Certificate',         emoji: '📋', mandatory: false, hint: 'GST registration certificate (optional)' },
  { key: 'businessRegistration', label: 'Business Registration',   emoji: '📄', mandatory: false, hint: 'Shop act / MSME / any biz registration' },
];

function KycDocUploadField({ field, currentKey, onUploaded, disabled, token }) {
  const [presignUpload] = usePresignUploadMutation();
  const [uploading, setUploading]   = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Load existing doc preview
  useEffect(() => {
    if (!currentKey || !token) return;
    let cancelled = false;
    fetch(`/api/events/partner/kyc/stream/field/${field.key}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => { if (!cancelled && blob) setPreviewUrl(URL.createObjectURL(blob)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentKey, field.key, token]);

  async function upload(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Max 10MB');
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'kyc-docs' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      setPreviewUrl(URL.createObjectURL(file));
      onUploaded(field.key, signed.key);
      toast.success(`${field.label} uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSelfieCapture(blob) {
    setCameraOpen(false);
    const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
    await upload(file);
  }

  const uploaded = !!currentKey;

  return (
    <>
      {cameraOpen && (
        <LiveSelfieCapture
          onCapture={handleSelfieCapture}
          onCancel={() => setCameraOpen(false)}
        />
      )}

      <div className={`rounded-2xl border-2 p-4 transition-all ${uploaded ? 'border-emerald-200 bg-emerald-50/30' : field.mandatory ? 'border-violet-200 bg-violet-50/20' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          {/* Preview / icon */}
          <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center relative
            ${uploaded ? 'border-emerald-300' : 'border-slate-200 bg-slate-50'}`}>
            {previewUrl ? (
              <img src={previewUrl} alt={field.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{field.emoji}</span>
            )}
            {uploaded && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle size={10} className="text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900 leading-tight">{field.label}</p>
              {field.mandatory && <span className="text-[10px] text-red-500 font-bold">*</span>}
              {!field.mandatory && <span className="text-[10px] text-slate-400 font-medium">(optional)</span>}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{field.hint}</p>
            {uploaded && <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">✓ Uploaded</p>}
          </div>

          {/* Action buttons */}
          {!disabled && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {field.camera ? (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCameraOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold">
                  <Camera size={11} />{uploaded ? 'Retake' : 'Selfie'}
                </motion.button>
              ) : (
                <label className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  {uploaded ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/*,.pdf" onChange={e => upload(e.target.files?.[0])} className="hidden" />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function KycSection({ partner, token, onRefresh }) {
  const [updateMe]      = useUpdatePartnerMeMutation();
  const [saving, setSaving] = useState(false);
  const kycStatus = partner?.kyc?.status || 'not_submitted';
  const kyc       = partner?.kyc || {};

  // Track unsaved uploads: fieldKey → s3Key
  const [pending, setPending] = useState({});

  function handleUploaded(fieldKey, s3Key) {
    setPending(p => ({ ...p, [fieldKey]: s3Key }));
  }

  const mandatoryDone = KYC_FIELDS.filter(f => f.mandatory).every(f => kyc[f.key] || pending[f.key]);
  const hasPending    = Object.keys(pending).length > 0;

  async function submitKyc() {
    if (!mandatoryDone) return toast.error('Upload all mandatory documents first');
    setSaving(true);
    try {
      await updateMe({ ...pending, gstNumber: kyc.gstNumber, panNumber: kyc.panNumber }).unwrap();
      setPending({});
      toast.success('KYC documents submitted for review 🎉');
      onRefresh();
    } catch (e) { toast.error(e?.data?.error || 'Submission failed'); }
    finally { setSaving(false); }
  }

  const KYC_STYLE = {
    approved:      'bg-emerald-100 text-emerald-700 border-emerald-300',
    pending:       'bg-amber-100   text-amber-700   border-amber-200',
    rejected:      'bg-red-100     text-red-600     border-red-200',
    not_submitted: 'bg-slate-100   text-slate-500   border-slate-200',
  };

  // Progress
  const totalMandatory = KYC_FIELDS.filter(f => f.mandatory).length;
  const doneMandatory  = KYC_FIELDS.filter(f => f.mandatory).filter(f => kyc[f.key] || pending[f.key]).length;
  const progressPct    = Math.round((doneMandatory / totalMandatory) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-violet-500" />
          <p className="font-black text-slate-900">KYC Verification</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${KYC_STYLE[kycStatus]}`}>
          {kycStatus.replace('_', ' ')}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Status banners */}
        {kycStatus === 'approved' && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <BadgeCheck size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 font-semibold">KYC approved — you can upload themes and accept bookings</p>
          </div>
        )}
        {kycStatus === 'pending' && (
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Clock size={16} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 font-semibold">Documents under review — admin will respond within 24 hours</p>
          </div>
        )}
        {kycStatus === 'rejected' && kyc.reviewNote && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-semibold">Rejected: {kyc.reviewNote} — re-upload correct documents</p>
          </div>
        )}

        {/* Progress bar */}
        {kycStatus !== 'approved' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-slate-600">Mandatory documents</p>
              <p className="text-xs font-black text-violet-600">{doneMandatory}/{totalMandatory}</p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`} />
            </div>
          </div>
        )}

        {/* Document fields */}
        {kycStatus !== 'approved' && (
          <div className="space-y-3">
            {KYC_FIELDS.map(field => (
              <KycDocUploadField key={field.key} field={field}
                currentKey={kyc[field.key] || pending[field.key]}
                onUploaded={handleUploaded}
                disabled={kycStatus === 'pending'}
                token={token} />
            ))}
          </div>
        )}

        {/* Text fields */}
        {kycStatus !== 'approved' && (
          <div className="grid grid-cols-2 gap-3">
            {[{ k: 'panNumber', label: 'PAN Number', placeholder: 'ABCDE1234F' },
              { k: 'gstNumber', label: 'GST Number (optional)', placeholder: '22AAAAA0000A1Z5' }
            ].map(({ k, label, placeholder }) => (
              <div key={k}>
                <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
                <input defaultValue={kyc[k] || ''} placeholder={placeholder}
                  onChange={e => setPending(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-violet-400 outline-none uppercase" />
              </div>
            ))}
          </div>
        )}

        {/* Submit button */}
        {kycStatus !== 'approved' && kycStatus !== 'pending' && (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={submitKyc}
            disabled={saving || !mandatoryDone || (!hasPending && kycStatus !== 'rejected')}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-violet-200">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {saving ? 'Submitting…' : mandatoryDone ? 'Submit for KYC Review' : `Upload ${totalMandatory - doneMandatory} more required doc${totalMandatory - doneMandatory !== 1 ? 's' : ''}`}
          </motion.button>
        )}

        {kycStatus === 'approved' && (
          <div className="space-y-2">
            {KYC_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-2 text-xs">
                <span>{f.emoji}</span>
                <span className="font-medium text-slate-600">{f.label}</span>
                <span className="ml-auto">{kyc[f.key] ? '✅' : f.mandatory ? '—' : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────────────────── */
function ProfileTab() {
  const { accessToken: token } = useSelector(selectAuth);
  const { data, refetch }      = usePartnerMeQuery();
  const [updateMe]             = useUpdatePartnerMeMutation();
  const [presignUpload]        = usePresignUploadMutation();
  const [form, setForm]        = useState(null);
  const [saving, setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);

  const partner = data?.partner;
  const values  = form || partner || {};
  const kycStatus = partner?.kyc?.status || 'not_submitted';
  const docs      = partner?.kyc?.documents || [];

  async function handlePhotoUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type, folder: 'event-photos' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await updateMe({ profilePhotoKey: signed.key }).unwrap();
      toast.success('Photo updated');
      refetch();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleKycUpload(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('File too large — max 8MB');
    if (docs.length >= 5) return toast.error('Max 5 documents allowed');
    setUploading(true);
    try {
      const { data: signed } = await presignUpload({ contentType: file.type || 'image/jpeg', folder: 'kyc-docs' });
      await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await updateMe({ kycDocument: signed.key }).unwrap();
      toast.success('Document submitted for review 🎉');
      refetch();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await updateMe({
        bio:             values.bio,
        yearsExperience: Number(values.yearsExperience),
        cities: typeof values.cities === 'string'
          ? values.cities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          : values.cities,
        serviceRadiusKm: Number(values.serviceRadiusKm),
      }).unwrap();
      toast.success('Profile saved');
      setForm(null);
      refetch();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  if (!partner) return <Spinner />;

  const KYC_STYLE = {
    approved:      'bg-emerald-50 border-emerald-200 text-emerald-700',
    pending:       'bg-amber-50   border-amber-200   text-amber-700',
    rejected:      'bg-red-50     border-red-200     text-red-600',
    not_submitted: 'bg-slate-50   border-slate-200   text-slate-500',
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer shrink-0 group">
            <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl overflow-hidden bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center">
              {partner.profilePhotoKey ? (
                <img src={partner.profilePhotoKey} alt="" className="w-full h-full object-cover"
                  onError={e => e.target.style.display = 'none'} />
              ) : (
                <span className="text-white font-black text-2xl">{partner.businessName?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center border-2 border-white group-hover:bg-violet-700 transition-colors">
              {uploading ? <Loader2 size={10} className="text-white animate-spin" /> : <Camera size={11} className="text-white" />}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e.target.files?.[0])} />
          </label>
          <div className="flex-1">
            <p className="font-black text-slate-900">{partner.businessName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{partner.phone || partner.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Star size={11} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-slate-700">{partner.rating?.toFixed(1) || '0.0'}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{partner.completedEvents || 0} events</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bio fields */}
      {[
        { k: 'bio',             label: 'About Your Business', placeholder: 'Tell customers about your work…', multi: true },
        { k: 'yearsExperience', label: 'Years of Experience', placeholder: '5', type: 'number' },
        { k: 'cities',          label: 'Cities Served',       placeholder: 'bangalore, mumbai' },
        { k: 'serviceRadiusKm', label: 'Service Radius (km)', placeholder: '30', type: 'number' },
      ].map(({ k, label, placeholder, multi, type }) => (
        <div key={k}>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">{label}</label>
          {multi ? (
            <textarea value={values[k] || ''} onChange={e => setForm(p => ({ ...(p || values), [k]: e.target.value }))}
              placeholder={placeholder} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none transition-all" />
          ) : (
            <input type={type || 'text'} value={values[k] || ''} onChange={e => setForm(p => ({ ...(p || values), [k]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" />
          )}
        </div>
      ))}

      <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={saving || !form}
        className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm shadow-violet-200">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        {saving ? 'Saving…' : 'Save Profile'}
      </motion.button>

      {/* KYC Section */}
      <KycSection partner={partner} token={token} onRefresh={refetch} />
    </form>
  );
}

/* ─── Notification icon config ─────────────────────────────────────────────── */
const NOTIF_META = {
  event_booking_new:            { icon: '🎉', color: 'bg-violet-100 text-violet-600' },
  event_partner_kyc_approved:   { icon: '✅', color: 'bg-emerald-100 text-emerald-600' },
  event_partner_kyc_rejected:   { icon: '❌', color: 'bg-red-100 text-red-600' },
  event_booking_cancelled:      { icon: '⚠️', color: 'bg-amber-100 text-amber-600' },
  event_completed:              { icon: '🏆', color: 'bg-blue-100 text-blue-600' },
  wallet_credited:              { icon: '💰', color: 'bg-green-100 text-green-600' },
  system_alert:                 { icon: '📢', color: 'bg-slate-100 text-slate-600' },
  promotional:                  { icon: '🎁', color: 'bg-pink-100 text-pink-600' },
};
function notifMeta(type) { return NOTIF_META[type] || { icon: '🔔', color: 'bg-slate-100 text-slate-600' }; }

/* ─── Notification Panel ────────────────────────────────────────────────────── */
function NotificationPanel({ onClose }) {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, refetch } = usePartnerNotificationsQuery({ page, unreadOnly });
  const [markRead]    = useMarkPartnerNotificationReadMutation();
  const [markAllRead] = useMarkAllPartnerNotificationsReadMutation();

  const notifications = data?.items || [];
  const unreadCount   = data?.unread || 0;

  async function handleRead(id) {
    await markRead(id).unwrap().catch(() => {});
    refetch();
  }
  async function handleMarkAll() {
    await markAllRead().unwrap().catch(() => {});
    refetch();
    toast.success('All marked as read');
  }

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
              <Bell size={16} className="text-violet-600" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Notifications</p>
              {unreadCount > 0 && <p className="text-[10px] text-violet-500 font-semibold">{unreadCount} unread</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-violet-600 font-bold hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
              <X size={15} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="px-5 py-3 border-b border-slate-50 flex gap-2 shrink-0">
          {[false, true].map(val => (
            <button key={String(val)} onClick={() => { setUnreadOnly(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${unreadOnly === val ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {val ? 'Unread' : 'All'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-violet-300" /></div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">🔔</div>
              <p className="font-bold text-slate-700 text-sm">No notifications yet</p>
              <p className="text-xs text-slate-400">Booking updates, KYC status, and earnings will show up here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map(n => {
                const { icon, color } = notifMeta(n.type);
                const unread = !n.readAt;
                return (
                  <motion.div key={n._id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    onClick={() => unread && handleRead(n._id)}
                    className={`flex gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${unread ? 'bg-violet-50/40' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${color}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {n.title}
                        </p>
                        {unread && <div className="w-2 h-2 bg-violet-500 rounded-full shrink-0 mt-1" />}
                      </div>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">{timeAgo(n.createdAt)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {data?.pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-30 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-slate-400">{page} / {data.pages}</span>
            <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-30 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              Next →
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview',  Icon: LayoutDashboard },
  { id: 'themes',   label: 'Themes',    Icon: Star            },
  { id: 'bookings', label: 'Bookings',  Icon: Package         },
  { id: 'calendar', label: 'Calendar',  Icon: Calendar        },
  { id: 'earnings', label: 'Earnings',  Icon: Wallet          },
  { id: 'profile',  label: 'Profile',   Icon: User            },
];

export default function PartnerDashboard() {
  const dispatch    = useDispatch();
  const { accessToken } = useSelector(selectAuth);
  const [doLogout]  = useLogoutMutation();
  const [activeTab, setActiveTab]   = useState('overview');
  const [notifOpen, setNotifOpen]   = useState(false);
  const { data: overview, refetch: refetchOverview } = usePartnerOverviewQuery();
  const { data: meData }   = usePartnerMeQuery();
  const { data: notifData, refetch: refetchNotifs } = usePartnerNotificationsQuery(
    { page: 1, unreadOnly: false },
    { skip: !accessToken }
  );
  const pendingCount  = overview?.stats?.pendingConfirmations || 0;
  const partner       = meData?.partner || overview?.partner;
  const unreadNotifs  = notifData?.unread || 0;

  // Poll notifications every 30s for new unread count
  useEffect(() => {
    const id = setInterval(() => refetchNotifs(), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleLogout() {
    try { await doLogout().unwrap(); } catch {}
    dispatch(logout());
  }

  const kycStatus  = partner?.kyc?.status;
  const kycApproved = kycStatus === 'approved';
  const KYC_GATED  = ['themes', 'bookings', 'calendar', 'earnings'];

  // If trying to access gated tab without KYC → redirect to profile
  useEffect(() => {
    if (!kycApproved && KYC_GATED.includes(activeTab)) setActiveTab('profile');
  }, [kycApproved, activeTab]);

  const content = (
    <AnimatePresence mode="wait">
      <motion.div key={activeTab}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
        {activeTab === 'overview' && <OverviewTab onNavigate={setActiveTab} />}
        {activeTab === 'themes'   && <ThemesTab />}
        {activeTab === 'bookings' && <BookingsTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'earnings' && <EarningsTab />}
        {activeTab === 'profile'  && <ProfileTab />}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── DESKTOP layout (lg+): sidebar + content ── */}
      <div className="hidden lg:flex min-h-screen">

        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen">
          {/* Logo */}
          <div className="px-6 py-6 border-b border-slate-100 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-zappy-500/10 via-zappy-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-zappy-400/20 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-zappy-500/30 transition-colors duration-700 pointer-events-none" />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 bg-zappy-gradient rounded-[18px] flex items-center justify-center shadow-[0_8px_16px_rgba(37,99,235,0.3)] ring-2 ring-white/50"
                >
                  <PartyPopper size={22} className="text-white drop-shadow-md" />
                </motion.div>
                <div className="absolute inset-0 bg-white opacity-0 hover:opacity-20 rounded-[18px] transition-opacity cursor-pointer" />
              </div>
              <div>
                <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-navy-900 to-zappy-700 text-[19px] leading-none tracking-tight">Zappy Partner</h1>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Event Portal</p>
                </div>
              </div>
            </div>
          </div>

          {/* Partner mini profile */}
          {partner && (
            <div className="px-4 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3 bg-zappy-50 rounded-2xl px-3 py-3 border border-zappy-100">
                <div className="w-9 h-9 rounded-xl bg-zappy-gradient flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm shadow-zappy-200">
                  {partner.businessName?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-navy-900 text-xs truncate">{partner.businessName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{partner.email || partner.phone}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              const badge  = id === 'bookings' && pendingCount > 0;
              const locked = !kycApproved && KYC_GATED.includes(id);
              return (
                <motion.button key={id} whileTap={!locked ? { scale: 0.97 } : {}}
                  onClick={() => !locked && setActiveTab(id)}
                  title={locked ? 'Complete KYC to unlock' : ''}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative
                    ${locked ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : active ? 'bg-zappy-gradient text-white shadow-md shadow-zappy-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-zappy-600'}`}>
                  <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={active ? 'font-bold' : ''}>{label}</span>
                  {locked && <span className="ml-auto text-xs">🔒</span>}
                  {!locked && badge && (
                    <span className="ml-auto w-5 h-5 bg-red-500 rounded-full text-[9px] text-white font-black flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* Advertise CTA */}
          <div className="px-3 pb-2">
            <a href="/partner/advertise"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold bg-zappy-gradient text-white shadow-sm shadow-zappy-200 hover:opacity-90 transition-opacity">
              <Sparkles size={15} />Advertise on Zappy
            </a>
          </div>

          {/* Logout */}
          <div className="px-3 py-3 border-t border-slate-100">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {/* Desktop top bar */}
          <div className="sticky top-6 z-30 px-8 mb-8 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06),0_0_0_1px_rgba(255,255,255,1)_inset] rounded-3xl px-6 py-3.5 flex items-center justify-between pointer-events-auto transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,1)_inset]">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-slate-100/80 rounded-[14px] flex items-center justify-center border border-slate-200/60 shadow-sm">
                  {(() => {
                    const TabIcon = TABS.find(t => t.id === activeTab)?.Icon;
                    return TabIcon ? <TabIcon size={20} strokeWidth={2.5} className="text-zappy-600" /> : null;
                  })()}
                </div>
                <div>
                  <h1 className="font-black text-navy-900 text-xl capitalize tracking-tight leading-none">{activeTab}</h1>
                  <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Zappy Event Partner Dashboard</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {pendingCount > 0 && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('bookings')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 rounded-[14px] text-xs font-bold text-white shadow-lg shadow-red-500/25 ring-2 ring-white"
                  >
                    <Package size={14} className="animate-bounce" />{pendingCount} Pending Bookings
                  </motion.button>
                )}
                
                <div className="h-8 w-px bg-slate-200 mx-1" />
                
                <button onClick={() => setNotifOpen(true)} className="relative w-11 h-11 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-[14px] hover:bg-white hover:shadow-md transition-all group outline-none">
                  <Bell size={18} className="text-slate-600 group-hover:text-zappy-600 transition-colors" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zappy-gradient rounded-full text-[10px] text-white font-black flex items-center justify-center shadow-md ring-2 ring-white">
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </span>
                  )}
                  {unreadNotifs === 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-success-500 rounded-full border border-white shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="px-8 py-6 max-w-3xl">
            {content}
          </div>
        </main>
      </div>

      {/* ── MOBILE layout (< lg): top bar + content + bottom tabs ── */}
      <div className="lg:hidden">
        {/* Mobile top bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-sm shadow-violet-200">
              <PartyPopper size={15} className="text-white" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-sm">Zappy Partner</span>
              <span className="text-[10px] text-violet-500 font-semibold block leading-none -mt-0.5">Event Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setNotifOpen(true)} className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <Bell size={17} className="text-slate-600" />
              {unreadNotifs > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-violet-500 rounded-full text-[9px] text-white font-black flex items-center justify-center">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1.5 rounded-xl hover:bg-red-50">
              <LogOut size={13} />
              <span className="font-semibold">Out</span>
            </button>
          </div>
        </div>

        {/* Mobile content */}
        <div className="px-4 pt-5 pb-28 max-w-lg mx-auto">
          {content}
        </div>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 flex">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            const badge  = id === 'bookings' && pendingCount > 0;
            const locked = !kycApproved && KYC_GATED.includes(id);
            return (
              <motion.button key={id} onClick={() => !locked && setActiveTab(id)} whileTap={!locked ? { scale: 0.85 } : {}}
                className={`flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors
                  ${locked ? 'opacity-35 text-slate-400' : active ? 'text-violet-600' : 'text-slate-400'}`}>
                {active && !locked && (
                  <motion.div layoutId="mob-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-600 rounded-full" />
                )}
                <div className="relative">
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                  {locked && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}
                  {!locked && badge && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white font-black flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] ${active ? 'font-black' : 'font-semibold'}`}>{label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Notification Panel */}
      <AnimatePresence>
        {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
      </AnimatePresence>

    </div>
  );
}
