import { useState, useMemo } from 'react';
import { useAdminAnalyticsQuery, useAdminMetricsQuery, useAdminDemandPatternsQuery } from '../../services/api';
import { SectionHeader, Card, PageLoader } from './_shared';
import {
  IndianRupee, ShoppingBag, CheckCircle2, XCircle, Zap, Users,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, AlertTriangle,
  TrendingUp, Clock, Star, Briefcase, AlertCircle,
} from 'lucide-react';

const DAY_OPTIONS = [7, 14, 30, 60, 90];
const SERVICE_COLORS = {
  puncture: '#ef4444', plumbing: '#3b82f6', electrical: '#eab308',
  helper: '#6b7280', carpenter: '#f59e0b', ac_repair: '#06b6d4',
  cleaning: '#22c55e', painting: '#a855f7',
};

function fmtR(rupees) {
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000)   return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

// ── Health Score ────────────────────────────────────────────────────────────
function computeHealth(d, ops) {
  if (!d.totalOrders) return null;
  const completion = (d.completionRate || 0) * 0.35;
  const cancel     = Math.max(0, 100 - (d.cancelRate || 0) * 3) * 0.25;
  const growth     = d.changes?.revenue > 0 ? Math.min(d.changes.revenue, 50) * 0.2 : (d.changes?.revenue == null ? 10 : 0);
  const dispatch   = ops?.avgDispatchMin != null ? Math.max(0, 100 - ops.avgDispatchMin * 4) * 0.2 : 8;
  return Math.min(100, Math.round(completion + cancel + growth + dispatch));
}
function gradeOf(score) {
  if (score == null) return { grade: '—', label: 'No data', ring: 'text-slate-300', bg: 'bg-slate-50', border: 'border-slate-200' };
  if (score >= 80) return { grade: 'A', label: 'Excellent', ring: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 65) return { grade: 'B', label: 'Good',      ring: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200'    };
  if (score >= 50) return { grade: 'C', label: 'Average',   ring: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200'   };
  if (score >= 35) return { grade: 'D', label: 'Needs work',ring: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200'  };
  return                  { grade: 'F', label: 'Critical',  ring: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     };
}

function HealthCard({ score, d, ops }) {
  const g = gradeOf(score);
  const factors = [
    { label: 'Completion',  val: d.completionRate || 0, unit: '%',  good: v => v >= 75 },
    { label: 'Cancel Rate', val: d.cancelRate || 0,     unit: '%',  good: v => v <= 15, invert: true },
    { label: 'Dispatch',    val: ops?.avgDispatchMin,   unit: 'min',good: v => v < 10  },
    { label: 'Rev Growth',  val: d.changes?.revenue,    unit: '%',  good: v => v > 0   },
  ];
  return (
    <Card className={`p-5 border-2 ${g.border} ${g.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Health</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Composite score this period</p>
        </div>
        <div className="text-right">
          <p className={`text-4xl font-black tabular-nums ${g.ring}`}>{g.grade}</p>
          <p className={`text-[11px] font-bold ${g.ring}`}>{g.label}</p>
        </div>
      </div>
      {score != null && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Score</span><span className="font-bold text-slate-600">{score}/100</span>
          </div>
          <div className="bg-white/60 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all ${score >= 65 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {factors.map(({ label, val, unit, good, invert }) => {
          const isNull = val == null;
          const isGood = isNull ? null : good(val);
          return (
            <div key={label} className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">{label}</span>
              <span className={`font-bold tabular-nums ${isNull ? 'text-slate-400' : isGood ? 'text-emerald-600' : 'text-red-500'}`}>
                {isNull ? '—' : `${val > 0 ? '' : ''}${val}${unit}`}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Trend Badge ─────────────────────────────────────────────────────────────
function TrendBadge({ pct }) {
  if (pct == null) return <span className="text-[10px] text-slate-400">—</span>;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${pct === 0 ? 'bg-slate-100 text-slate-500' : up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
      {pct === 0 ? <Minus size={9} /> : up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({ label, value, sub, Icon, color, bg, pct }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={15} className={color} />
        </div>
        <TrendBadge pct={pct} />
      </div>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </Card>
  );
}

// ── Revenue trend chart ──────────────────────────────────────────────────────
function RevenueTrend({ data = [] }) {
  const [metric, setMetric] = useState('revenue');
  const noData = !data.length || data.every(d => !d.revenueRupees && !d.orders);
  if (noData) return (
    <div className="h-32 flex flex-col items-center justify-center gap-1 text-slate-400">
      <TrendingUp size={28} strokeWidth={1} />
      <p className="text-xs font-semibold">No order data yet for this period</p>
    </div>
  );
  const vals = data.map(d => metric === 'revenue' ? d.revenueRupees : metric === 'orders' ? d.orders : d.completed);
  const max  = Math.max(...vals, 1);
  const W = 600; const H = 90;
  const pts  = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * W},${H - ((v / max) * (H - 10)) - 4}`).join(' ');
  const col  = { revenue: '#2563eb', orders: '#f97316', completed: '#10b981' }[metric];
  const total = vals.reduce((s, v) => s + v, 0);
  const avg   = Math.round(total / vals.length);
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {[['revenue','Revenue','#2563eb'],['orders','Orders','#f97316'],['completed','Done','#10b981']].map(([id, lbl, c]) => (
          <button key={id} onClick={() => setMetric(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${metric===id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            style={metric===id ? { backgroundColor: c } : {}}>
            {lbl}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-400 self-center">
          Avg/day: {metric === 'revenue' ? fmtR(avg) : avg}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 96 }}>
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.2" />
            <stop offset="100%" stopColor={col} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#grad-${metric})`} />
        <polyline fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-slate-400">
        {data.filter((_, i) => i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1).map(d => (
          <span key={d.date}>{d.date?.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

// ── Revenue leakage ──────────────────────────────────────────────────────────
function LeakagePanel({ d }) {
  const lost   = (d.cancelledOrders || 0) * (d.avgFareRupees || 0);
  const earned = d.totalRevRupees || 0;
  const lossRate = earned + lost > 0 ? Math.round((lost / (earned + lost)) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
        <p className="text-xs font-bold text-red-700">Revenue Lost to Cancels</p>
        <p className="text-2xl font-extrabold text-red-600 mt-0.5">{fmtR(lost)}</p>
        <p className="text-[10px] text-red-500 mt-0.5">{d.cancelledOrders || 0} orders × {fmtR(d.avgFareRupees || 0)} avg</p>
        <div className="bg-white/60 rounded-full h-1.5 mt-2 overflow-hidden">
          <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${lossRate}%` }} />
        </div>
        <p className="text-[10px] text-red-500 mt-0.5">{lossRate}% of potential revenue lost</p>
      </div>
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
        <p className="text-xs font-bold text-emerald-700">Captured Revenue</p>
        <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{fmtR(earned)}</p>
        <p className="text-[10px] text-emerald-500 mt-0.5">{d.completedOrders || 0} completed orders</p>
      </div>
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-xs font-bold text-slate-600">Revenue/User</p>
        <p className="text-xl font-extrabold text-slate-700 mt-0.5">
          {d.uniqueActiveUsers ? fmtR(Math.round(earned / d.uniqueActiveUsers)) : '—'}
        </p>
        <p className="text-[10px] text-slate-400">{(d.uniqueActiveUsers || 0)} active users</p>
      </div>
    </div>
  );
}

// ── Service Health Matrix (2×2 quadrant) ─────────────────────────────────────
function ServiceMatrix({ services = [] }) {
  if (!services.length) return (
    <div className="h-32 flex flex-col items-center justify-center gap-1 text-slate-400">
      <BarChart2 size={28} strokeWidth={1} />
      <p className="text-xs font-semibold">No service data yet</p>
    </div>
  );
  const avgDemand  = services.reduce((s, sv) => s + sv.total, 0) / services.length;
  const avgQuality = services.reduce((s, sv) => s + sv.completionRate, 0) / services.length;

  const categories = {
    star:    { label: '⭐ Stars',        desc: 'High demand + high quality — protect & scale', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    problem: { label: '🔴 Problems',     desc: 'High demand + low quality — fix urgently',      bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500'     },
    gem:     { label: '💎 Hidden Gems',  desc: 'Low demand + high quality — promote more',       bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
    review:  { label: '⚠️ Review',       desc: 'Low demand + low quality — improve or cut',      bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  };

  const categorized = services.map(sv => ({
    ...sv,
    quad: sv.total > avgDemand
      ? sv.completionRate >= avgQuality ? 'star' : 'problem'
      : sv.completionRate >= avgQuality ? 'gem'  : 'review',
  }));

  const grouped = { star: [], problem: [], gem: [], review: [] };
  categorized.forEach(sv => grouped[sv.quad].push(sv));

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(categories).map(([quad, cat]) => (
        <div key={quad} className={`p-3.5 rounded-xl border ${cat.bg} ${cat.border}`}>
          <p className="text-sm font-bold text-slate-800">{cat.label}</p>
          <p className="text-[10px] text-slate-500 mb-2.5">{cat.desc}</p>
          {grouped[quad].length === 0
            ? <p className="text-xs text-slate-400 italic">None</p>
            : <div className="space-y-1.5">
                {grouped[quad].map(sv => (
                  <div key={sv.service} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cat.dot}`} />
                      <span className="text-xs font-semibold text-slate-700 capitalize truncate">{sv.service?.replace(/_/g,' ')}</span>
                    </div>
                    <div className="flex gap-2 shrink-0 text-[10px]">
                      <span className="text-slate-500">{sv.total} orders</span>
                      <span className={`font-bold ${sv.completionRate >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>{sv.completionRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      ))}
    </div>
  );
}

function BarChart2({ size, strokeWidth }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

// ── Supply vs Demand gap (24h bars) ──────────────────────────────────────────
function SupplyDemand({ hourly = [], onlineWorkers = 2 }) {
  const all24 = Array.from({ length: 24 }, (_, h) => {
    const f = hourly.find(d => d.hour === h);
    return { hour: h, orders: f?.orders || 0 };
  });
  const maxOrders = Math.max(...all24.map(d => d.orders), 1);
  // Rough supply estimate: workers * 2 orders/hr capacity
  const capacity  = onlineWorkers * 2;
  return (
    <div>
      <div className="flex items-end gap-0.5" style={{ height: 80 }}>
        {all24.map(d => {
          const pct     = (d.orders / maxOrders) * 100;
          const gapped  = capacity > 0 && d.orders > capacity;
          return (
            <div key={d.hour} className="flex-1 group relative flex flex-col justify-end" style={{ height: '100%' }}>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-slate-900 text-white text-[9px] px-1.5 py-1 rounded shadow-lg whitespace-nowrap">
                  {d.hour}:00 — {d.orders} orders
                  {gapped ? '\n⚠ supply gap' : ''}
                </div>
              </div>
              <div
                style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: gapped ? '#ef4444' : '#6366f1', opacity: 0.8 }}
                className="w-full rounded-sm transition-all"
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-slate-400">
        {['12am','6am','12pm','6pm','11pm'].map(l => <span key={l}>{l}</span>)}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />Normal</span>
        <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Supply gap</span>
      </div>
    </div>
  );
}

// ── Operational efficiency ───────────────────────────────────────────────────
function OpsPanel({ ops }) {
  const items = [
    { label: 'Dispatch time',  desc: 'Order → Worker assigned', value: ops?.avgDispatchMin, bench: 10, icon: Zap },
    { label: 'Wait at site',   desc: 'Arrive → Service starts',  value: ops?.avgWaitMin,     bench: 5,  icon: Clock },
    { label: 'Service time',   desc: 'Start → Completed',        value: ops?.avgServiceMin,  bench: 60, icon: Briefcase },
  ];
  return (
    <div className="space-y-3">
      {items.map(({ label, desc, value, bench, icon: Icon }) => {
        const pct  = value != null ? Math.min((value / (bench * 2)) * 100, 100) : 0;
        const good = value != null ? value <= bench : null;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${good == null ? 'bg-slate-50' : good ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <Icon size={14} className={good == null ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-amber-600'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700">{label}</p>
              <p className="text-[10px] text-slate-400">{desc}</p>
              <div className="bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                <div className={`h-1 rounded-full ${good ? 'bg-emerald-500' : good === false ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              {value != null
                ? <><p className="text-sm font-extrabold text-slate-800">{value}m</p><p className={`text-[10px] font-bold ${good ? 'text-emerald-500' : 'text-amber-500'}`}>{good ? '✓ fast' : `>${bench}m`}</p></>
                : <p className="text-xs text-slate-400">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Worker leaderboard ───────────────────────────────────────────────────────
function WorkerLeaderboard({ workers = [] }) {
  if (!workers.length) return <p className="text-xs text-slate-400 text-center py-6">No completed orders yet</p>;
  const maxJobs = workers[0]?.jobs || 1;
  return (
    <div className="space-y-2">
      {workers.slice(0, 8).map((w, i) => {
        const medal = ['🥇','🥈','🥉'][i] || `${i+1}`;
        return (
          <div key={w._id || i} className="flex items-center gap-2.5 py-1">
            <span className="text-sm w-6 text-center shrink-0 font-bold text-slate-400">{medal}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-slate-800 truncate">{w.name || '—'}</p>
                <span className="text-xs font-bold text-slate-700 ml-2 shrink-0">{w.jobs} jobs</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(w.jobs / maxJobs) * 100}%` }} />
                </div>
                {w.avgRating != null && <span className="text-[10px] text-amber-500 font-bold shrink-0 flex items-center gap-0.5"><Star size={9} fill="currentColor" />{w.avgRating?.toFixed(1)}</span>}
                {w.earningPaise > 0 && <span className="text-[10px] text-emerald-600 font-semibold shrink-0">₹{Math.round(w.earningPaise / 100).toLocaleString('en-IN')}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Decision Alerts ──────────────────────────────────────────────────────────
function DecisionAlerts({ d, ops }) {
  const alerts = [];

  if (d.totalOrders > 0) {
    if ((d.cancelRate || 0) > 25)
      alerts.push({ sev: 'red',    msg: `Cancel rate is ${d.cancelRate}% — investigate top cancelled services` });
    if ((d.completionRate || 0) < 60)
      alerts.push({ sev: 'red',    msg: `Only ${d.completionRate}% orders completed — worker supply may be low` });
    if (d.changes?.revenue != null && d.changes.revenue < -20)
      alerts.push({ sev: 'red',    msg: `Revenue down ${Math.abs(d.changes.revenue)}% vs previous period` });
    if (ops?.avgDispatchMin != null && ops.avgDispatchMin > 15)
      alerts.push({ sev: 'amber',  msg: `Avg dispatch time ${ops.avgDispatchMin}min — workers taking too long to accept` });
    if (d.changes?.orders != null && d.changes.orders > 20)
      alerts.push({ sev: 'green',  msg: `Orders up ${d.changes.orders}% — consider adding workers to handle demand` });
    if ((d.cancelRate || 0) <= 10 && (d.completionRate || 0) >= 80)
      alerts.push({ sev: 'green',  msg: `Platform performing well — completion ${d.completionRate}%, cancel ${d.cancelRate}%` });
  }

  if (!alerts.length) return null;

  const sev = { red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500' }, amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500' }, green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500' } };

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const s = sev[a.sev];
        return (
          <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${s.bg} ${s.border}`}>
            {a.sev === 'green'
              ? <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${s.icon}`} />
              : <AlertCircle size={14} className={`mt-0.5 shrink-0 ${s.icon}`} />}
            <p className="text-xs font-semibold text-slate-700 leading-relaxed">{a.msg}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly signups sparkline ─────────────────────────────────────────────────
function WeeklySignups({ weeklySignups }) {
  const users   = weeklySignups?.users   || [];
  const workers = weeklySignups?.workers || [];
  if (!users.length && !workers.length) return <p className="text-xs text-slate-400 text-center py-4">No signup data</p>;
  const allWeeks = [...new Set([...users.map(u => u._id), ...workers.map(w => w._id)])].sort();
  const maxVal   = Math.max(...allWeeks.map(wk => (users.find(u => u._id === wk)?.count || 0) + (workers.find(w => w._id === wk)?.count || 0)), 1);
  return (
    <div className="space-y-2">
      {allWeeks.slice(-8).map(wk => {
        const uc = users.find(u => u._id === wk)?.count || 0;
        const wc = workers.find(w => w._id === wk)?.count || 0;
        const total = uc + wc;
        return (
          <div key={wk} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-12 shrink-0">{wk?.replace(/\d{4}-/, '')}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden flex">
              <div className="h-4 bg-blue-400" style={{ width: `${(uc / maxVal) * 100}%` }} />
              <div className="h-4 bg-emerald-400" style={{ width: `${(wc / maxVal) * 100}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 w-6 text-right">{total}</span>
          </div>
        );
      })}
      <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Users</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Workers</span>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching, isError, error, refetch } = useAdminAnalyticsQuery(days);
  const { data: live }     = useAdminMetricsQuery(undefined, { pollingInterval: 30000 });
  const { data: patterns } = useAdminDemandPatternsQuery({ days });

  if (isLoading) return <PageLoader />;

  const d      = data || {};
  const ops    = d.ops || {};
  const score  = computeHealth(d, ops);

  return (
    <div className="space-y-5">

      {/* Header */}
      <SectionHeader title="Analytics" subtitle={`Last ${days} days vs previous ${days} days`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {DAY_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setDays(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${days===opt ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {opt}d
              </button>
            ))}
          </div>
          <button onClick={refetch} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </SectionHeader>

      {/* Error banner */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Analytics API error</p>
            <p className="text-xs text-red-500">{error?.data?.message || error?.status || 'Could not load data'}</p>
          </div>
        </div>
      )}

      {/* Live Now strip */}
      {live && (
        <Card className="px-5 py-3 flex flex-wrap gap-6 items-center bg-slate-900 border-slate-800">
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Live Now
          </span>
          {[
            { label: 'Active',      value: live.active },
            { label: 'Online Workers', value: `${live.onlineWorkers}/${live.totalWorkers}` },
            { label: 'Today Orders',  value: live.ordersToday },
            { label: 'Done Today',    value: live.completedToday },
            { label: 'Rev Today',     value: `₹${(live.revenueToday || 0).toLocaleString('en-IN')}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-sm font-extrabold text-white tabular-nums">{value}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Row 1: Health Score + KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 xl:col-span-1 xl:row-span-1">
          <HealthCard score={score} d={d} ops={ops} />
        </div>
        <KpiCard label="Revenue"         value={fmtR(d.totalRevRupees || 0)}               Icon={IndianRupee}  color="text-blue-600"    bg="bg-blue-50"    pct={d.changes?.revenue} />
        <KpiCard label="Total Orders"    value={(d.totalOrders || 0).toLocaleString()}      Icon={ShoppingBag}  color="text-orange-600"  bg="bg-orange-50"  pct={d.changes?.orders} />
        <KpiCard label="Completed"       value={(d.completedOrders || 0).toLocaleString()}  Icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" pct={d.changes?.completed} />
        <KpiCard label="Cancel Rate"     value={`${d.cancelRate || 0}%`}                    Icon={XCircle}      color="text-red-500"     bg="bg-red-50" />
        <KpiCard label="Avg Order Value" value={fmtR(d.avgFareRupees || 0)}                 Icon={Zap}          color="text-amber-600"   bg="bg-amber-50"   pct={d.changes?.avgFare} />
      </div>

      {/* Decision Alerts */}
      <DecisionAlerts d={d} ops={ops} />

      {/* Row 2: Revenue trend + Leakage */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Revenue & Order Trend</p>
          <p className="text-xs text-slate-400 mb-3">Daily totals for the period</p>
          <RevenueTrend data={d.dailyTrend || []} />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Revenue Intelligence</p>
          <p className="text-xs text-slate-400 mb-3">Captured vs lost revenue</p>
          <LeakagePanel d={d} />
        </Card>
      </div>

      {/* Row 3: Service Health Matrix */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-slate-800">Service Health Matrix</p>
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Demand × Quality quadrant</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Where each service sits — use this to decide where to invest or cut</p>
        <ServiceMatrix services={d.serviceBreakdown || []} />
      </Card>

      {/* Row 4: Supply-demand + Ops efficiency */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Supply-Demand Gap</p>
          <p className="text-xs text-slate-400 mb-3">Red bars = peak hours where supply likely insufficient</p>
          <SupplyDemand hourly={patterns?.hourly || []} onlineWorkers={live?.onlineWorkers || 0} />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Operational Efficiency</p>
          <p className="text-xs text-slate-400 mb-4">Avg time per stage across completed orders</p>
          <OpsPanel ops={ops} />
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-extrabold text-slate-900">{(d.uniqueActiveUsers || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] font-semibold text-slate-400">Active Users</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-slate-900">{(d.newUsers || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] font-semibold text-slate-400">New Signups</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 5: Worker leaderboard + Weekly growth */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Worker Leaderboard</p>
          <p className="text-xs text-slate-400 mb-4">Top performers by jobs completed</p>
          <WorkerLeaderboard workers={d.topWorkers || []} />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Weekly Growth</p>
          <p className="text-xs text-slate-400 mb-4">New users & workers per week</p>
          <WeeklySignups weeklySignups={d.weeklySignups} />
        </Card>
      </div>

    </div>
  );
}
