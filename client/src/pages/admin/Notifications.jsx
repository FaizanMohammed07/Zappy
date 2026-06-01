import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Send, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart2, MessageSquare, Users, Smartphone, AlertTriangle,
} from 'lucide-react';
import { SectionHeader, Card, PageLoader } from './_shared';
import toast from 'react-hot-toast';
import { adminApiPath } from '../../config/admin';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../modules/auth/authSlice';

const NOTIFICATION_TYPES = [
  'order_placed', 'worker_assigned', 'worker_on_the_way', 'worker_arriving_soon',
  'worker_arrived', 'order_completed', 'order_cancelled', 'rating_request',
  'wallet_credited', 'cashback_received', 'kyc_approved', 'kyc_rejected',
  'promotional', 'system_alert', 'worker_wellness', 'dispute_response', 'chat_message',
];

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
      <p className={`text-2xl font-black ${color}`}>{value ?? '—'}</p>
      <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── FCM Health Check ─────────────────────────────────────────────────── */
function FcmHealth({ token }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch(adminApiPath('/notifications/health'), { headers: { Authorization: `Bearer ${token}` } });
      setHealth(await res.json());
    } catch { setHealth({ ok: false, message: 'Network error' }); }
    setLoading(false);
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone size={15} strokeWidth={2} className="text-indigo-600" />
          <p className="text-sm font-bold text-slate-700">Firebase / FCM Status</p>
        </div>
        <button onClick={check} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Check
        </button>
      </div>

      {health && (
        <div className={`flex items-start gap-3 p-3 rounded-xl ring-1 ${health.ok ? 'bg-green-50 ring-green-100' : 'bg-red-50 ring-red-100'}`}>
          {health.ok
            ? <CheckCircle size={15} strokeWidth={2} className="text-green-600 mt-0.5 shrink-0" />
            : <XCircle size={15} strokeWidth={2} className="text-red-500 mt-0.5 shrink-0" />
          }
          <div>
            <p className={`text-xs font-bold ${health.ok ? 'text-green-800' : 'text-red-800'}`}>{health.message}</p>
            {health.projectId && <p className="text-[10px] text-slate-400 mt-0.5">Project: {health.projectId}</p>}
            {health.error && <p className="text-[10px] text-red-600 mt-0.5">{health.error}</p>}
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-400 space-y-0.5">
        <p className="font-bold text-slate-600 text-[11px]">Required env vars (server)</p>
        {['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].map((k) => (
          <p key={k} className="font-mono">{k}</p>
        ))}
        <p className="font-bold text-slate-600 text-[11px] pt-1">Required env vars (client)</p>
        {['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_VAPID_KEY'].map((k) => (
          <p key={k} className="font-mono">{k}</p>
        ))}
      </div>
    </Card>
  );
}

/* ── Delivery Stats ──────────────────────────────────────────────────── */
function DeliveryStats({ token }) {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(adminApiPath(`/notifications/stats?days=${days}`), { headers: { Authorization: `Bearer ${token}` } });
      setStats(await res.json());
    } catch { toast.error('Failed to load stats'); }
    setLoading(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} strokeWidth={2} className="text-violet-600" />
          <p className="text-sm font-bold text-slate-700">Delivery Statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none">
            <option value={1}>24h</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-violet-600 bg-violet-50 rounded-xl disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Load
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total sent" value={stats.summary.total} />
            <StatCard label="Push delivered" value={stats.summary.pushSent} color="text-indigo-600"
              sub={`${stats.summary.pushDeliveryRate}% rate`} />
            <StatCard label="SMS sent" value={stats.summary.smsSent} color="text-green-600" />
            <StatCard label="Read" value={stats.summary.read} color="text-amber-600" />
          </div>

          {/* Per-type breakdown */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">By type</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                    {['Type', 'Total', 'Push', 'SMS', 'Read'].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byType.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-50">
                      <td className="py-1.5 pr-3 font-medium capitalize">{t._id?.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 pr-3">{t.total}</td>
                      <td className="py-1.5 pr-3 text-indigo-600">{t.pushSent}</td>
                      <td className="py-1.5 pr-3 text-green-600">{t.smsSent}</td>
                      <td className="py-1.5 pr-3 text-amber-600">{t.readCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {stats.recentFailures?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> Recent push failures
              </p>
              <div className="space-y-1">
                {stats.recentFailures.slice(0, 5).map((f, i) => (
                  <div key={i} className="text-[10px] bg-red-50 rounded-lg px-2.5 py-1.5 ring-1 ring-red-100">
                    <span className="font-bold text-red-700">{f.type}</span>
                    <span className="text-slate-400 ml-2">{f.title}</span>
                    <span className="text-red-400 ml-2">{f.channels?.push?.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ── Manual Send ─────────────────────────────────────────────────────── */
function ManualSend({ token }) {
  const [form, setForm] = useState({
    recipientKind: 'user',
    recipientId: '',
    type: 'system_alert',
    title: '',
    body: '',
    deepLink: '',
  });
  const [sending, setSending] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function send() {
    if (!form.recipientId.match(/^[a-f\d]{24}$/i)) {
      toast.error('Enter a valid 24-char MongoDB ID');
      return;
    }
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSending(true);
    try {
      const res = await fetch(adminApiPath('/notifications/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Notification sent');
        setForm((p) => ({ ...p, recipientId: '', title: '', body: '', deepLink: '' }));
      } else {
        toast.error(data.error || 'Send failed');
      }
    } catch { toast.error('Network error'); }
    setSending(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Send size={15} strokeWidth={2} className="text-blue-600" />
        <p className="text-sm font-bold text-slate-700">Send to Specific User / Worker</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Recipient</label>
          <select value={form.recipientKind} onChange={f('recipientKind')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400">
            <option value="user">User</option>
            <option value="worker">Worker</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">ID (MongoDB)</label>
          <input value={form.recipientId} onChange={f('recipientId')} placeholder="64a1b2c3..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Type</label>
          <select value={form.type} onChange={f('type')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400">
            {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Deep Link</label>
          <input value={form.deepLink} onChange={f('deepLink')} placeholder="/orders/..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Title *</label>
        <input value={form.title} onChange={f('title')} placeholder="Notification title"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Body</label>
        <textarea value={form.body} onChange={f('body')} rows={2} placeholder="Notification body text"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none" />
      </div>

      <motion.button onClick={send} disabled={sending}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        whileTap={{ scale: 0.97 }}>
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {sending ? 'Sending…' : 'Send Notification'}
      </motion.button>
    </Card>
  );
}

/* ── Broadcast ────────────────────────────────────────────────────────── */
function Broadcast({ token }) {
  const [form, setForm] = useState({ recipientKind: 'user', type: 'promotional', title: '', body: '', deepLink: '', limit: 1000 });
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function send() {
    setSending(true);
    try {
      const res = await fetch(adminApiPath('/notifications/broadcast'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Broadcast queued — ${data.recipientCount} recipients, ${data.tokenCount} tokens`);
        setConfirm(false);
      } else {
        toast.error(data.error || 'Broadcast failed');
      }
    } catch { toast.error('Network error'); }
    setSending(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={15} strokeWidth={2} className="text-orange-600" />
        <p className="text-sm font-bold text-slate-700">Broadcast to All</p>
        <span className="text-[10px] font-bold bg-orange-50 text-orange-600 ring-1 ring-orange-100 px-2 py-0.5 rounded-full">Admin only</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Audience</label>
          <select value={form.recipientKind} onChange={f('recipientKind')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none">
            <option value="user">All Users</option>
            <option value="worker">All Workers</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Type</label>
          <select value={form.type} onChange={f('type')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none">
            <option value="promotional">Promotional</option>
            <option value="system_alert">System Alert</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Max recipients</label>
          <input type="number" value={form.limit} onChange={f('limit')} min="1" max="10000"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Title *</label>
        <input value={form.title} onChange={f('title')} placeholder="Broadcast title"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Body</label>
        <textarea value={form.body} onChange={f('body')} rows={2}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none resize-none" />
      </div>

      {!confirm ? (
        <button onClick={() => { if (!form.title) { toast.error('Title required'); return; } setConfirm(true); }}
          className="w-full py-2.5 bg-orange-600 text-white text-sm font-bold rounded-xl">
          Broadcast to {form.recipientKind === 'user' ? 'Users' : 'Workers'} →
        </button>
      ) : (
        <div className="bg-orange-50 rounded-xl p-3 ring-1 ring-orange-200 space-y-3">
          <p className="text-xs font-bold text-orange-800">⚠️ This will send to up to {form.limit} {form.recipientKind}s. Confirm?</p>
          <div className="flex gap-2">
            <button onClick={send} disabled={sending}
              className="flex-1 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl disabled:opacity-50">
              {sending ? 'Sending…' : 'Yes, Send'}
            </button>
            <button onClick={() => setConfirm(false)} className="px-4 py-2 bg-slate-100 text-xs font-bold rounded-xl">Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function NotificationsAdmin() {
  const { accessToken: token } = useSelector(selectAuth);
  const [tab, setTab] = useState('stats');

  const tabs = [
    { id: 'stats',   label: 'Stats & Health', icon: BarChart2 },
    { id: 'send',    label: 'Send',            icon: Send },
    { id: 'broadcast', label: 'Broadcast',     icon: Users },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <SectionHeader
        title="Push Notifications"
        subtitle="Monitor delivery, send manual pushes, broadcast platform-wide announcements, and verify Firebase config."
      />

      {/* Tab bar */}
      <div className="flex gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              tab === id
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="space-y-4">
          <FcmHealth token={token} />
          <DeliveryStats token={token} />
        </div>
      )}
      {tab === 'send' && <ManualSend token={token} />}
      {tab === 'broadcast' && <Broadcast token={token} />}
    </div>
  );
}
