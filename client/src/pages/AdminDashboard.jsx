import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, FileCheck,
  LogOut, TrendingUp, Activity, IndianRupee, UserCheck,
  ChevronLeft, ChevronRight, Search, ShieldOff, ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  useAdminMetricsQuery, useAdminOrdersQuery, useAdminWorkersQuery,
  useAdminBlockWorkerMutation,
} from '../services/api';
import { logout } from '../modules/auth/authSlice';
import { ZappyLogo } from '../components/common/ZappyLogo';
import AdminKycReview from './AdminKycReview';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'overview', label: 'Overview',  Icon: LayoutDashboard },
  { key: 'orders',   label: 'Orders',    Icon: ClipboardList },
  { key: 'workers',  label: 'Workers',   Icon: Users },
  { key: 'kyc',      label: 'KYC',       Icon: FileCheck },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const dispatch = useDispatch();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-[#0F172A] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ZappyLogo size={26} />
            <div>
              <span className="text-white font-bold text-sm">Zappy</span>
              <span className="text-slate-400 text-sm"> · Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  tab === key ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { dispatch(logout()); nav('/admin/login'); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition shrink-0"
          >
            <LogOut size={13} strokeWidth={2} />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {tab === 'overview' && <Overview />}
        {tab === 'orders'   && <OrdersTable />}
        {tab === 'workers'  && <WorkersTable />}
        {tab === 'kyc'      && <AdminKycReview />}
      </main>
    </div>
  );
}

function Overview() {
  const { data, isLoading } = useAdminMetricsQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={24} className="text-zappy-600 animate-spin" />
    </div>
  );
  if (!data) return null;

  const cards = [
    { label: 'Orders Today',    value: data.ordersToday,   Icon: ClipboardList, color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Active Now',      value: data.active,        Icon: Activity,      color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Completed Today', value: data.completedToday,Icon: UserCheck,     color: 'text-success-600',bg: 'bg-success-50' },
    { label: 'Revenue Today',   value: `₹${data.revenueToday}`, Icon: IndianRupee,color: 'text-zappy-600',bg: 'bg-zappy-50' },
    { label: 'Avg Fare',        value: `₹${data.avgFare}`, Icon: TrendingUp,    color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Online Workers',  value: `${data.onlineWorkers}/${data.totalWorkers}`, Icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Users',     value: data.totalUsers,    Icon: Users,         color: 'text-slate-600',  bg: 'bg-slate-100' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-[#0F172A] mb-4">Platform Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-card shadow-card ring-1 ring-slate-100 p-4">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} strokeWidth={2} className={color} />
            </div>
            <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-xs text-slate-400 font-semibold mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const ORDER_STATUSES = ['', 'searching', 'assigned', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'failed'];
const STATUS_CHIP_MAP = {
  searching: 'chip-blue', assigned: 'chip-blue', on_the_way: 'chip-blue',
  in_progress: 'chip-success', completed: 'chip-success',
  cancelled: 'chip-red', failed: 'chip-red',
};

function OrdersTable() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching } = useAdminOrdersQuery({ status: status || undefined, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0F172A]">Orders</h2>
        {data?.total != null && <span className="chip-neutral">{data.total} total</span>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`chip cursor-pointer transition-all ${
              status === s ? 'bg-[#0F172A] text-white' : 'chip-neutral hover:bg-slate-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-card shadow-card ring-1 ring-slate-100 overflow-hidden">
        {isFetching && (
          <div className="flex items-center justify-center h-16 gap-2 text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs font-medium">Loading…</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Order ID</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Service</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Worker</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.orders?.map((o) => (
                <tr key={o._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{o._id.slice(-8)}</td>
                  <td className="px-4 py-3 font-medium capitalize">{o.service?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-slate-600">{o.userId?.name || o.userId?.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.workerId?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`chip ${STATUS_CHIP_MAP[o.status] || 'chip-neutral'}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#0F172A]">
                    {o.pricing?.total ? `₹${o.pricing.total}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
              {!data?.orders?.length && !isFetching && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={data?.total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

function WorkersTable() {
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [page, setPage] = useState(1);
  const { data, refetch, isFetching } = useAdminWorkersQuery({ q: q || undefined, skill: skill || undefined, page });
  const [block] = useAdminBlockWorkerMutation();

  async function toggleBlock(w) {
    try {
      await block({ id: w._id, blocked: !w.isBlocked }).unwrap();
      toast.success(w.isBlocked ? 'Worker unblocked' : 'Worker blocked');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Action failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0F172A]">Workers</h2>
        {data?.total != null && <span className="chip-neutral">{data.total} total</span>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input w-44 text-sm"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
        >
          <option value="">All skills</option>
          {['puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-card shadow-card ring-1 ring-slate-100 overflow-hidden">
        {isFetching && (
          <div className="flex items-center justify-center h-12 gap-2 text-slate-400">
            <Loader2 size={14} className="animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Name', 'Phone', 'Skills', 'Rating', 'Jobs', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.workers?.map((w) => (
                <tr key={w._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{w.name}</td>
                  <td className="px-4 py-3 text-slate-500">{w.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.skills?.map((s) => (
                        <span key={s} className="chip-neutral text-[10px]">{s.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{w.rating}</td>
                  <td className="px-4 py-3 text-slate-600">{w.completedJobs}</td>
                  <td className="px-4 py-3">
                    {w.isBlocked ? (
                      <span className="chip-red">Blocked</span>
                    ) : w.isOnline ? (
                      <span className="chip-success">Online</span>
                    ) : (
                      <span className="chip-neutral">Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBlock(w)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        w.isBlocked
                          ? 'bg-zappy-50 text-zappy-700 hover:bg-zappy-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {w.isBlocked
                        ? <><ShieldCheck size={12} strokeWidth={2} /> Unblock</>
                        : <><ShieldOff size={12} strokeWidth={2} /> Block</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {!data?.workers?.length && !isFetching && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">
                    No workers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={data?.total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

function Pagination({ page, total, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between">
      <button disabled={page <= 1} onClick={onPrev} className="btn-secondary py-2 px-4 text-xs gap-1.5">
        <ChevronLeft size={13} strokeWidth={2.5} /> Prev
      </button>
      <span className="text-xs font-semibold text-slate-400">
        Page {page}{total != null ? ` · ${total} total` : ''}
      </span>
      <button onClick={onNext} className="btn-secondary py-2 px-4 text-xs gap-1.5">
        Next <ChevronRight size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
