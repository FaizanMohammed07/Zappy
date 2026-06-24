import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, Radio, Search, MapPinOff, Rocket, Crown, Globe, TrendingUp,
  BarChart2, Users, ShoppingBag, IndianRupee, Wifi, ChevronDown, RefreshCw,
  Monitor, Smartphone, ArrowUpRight, ArrowDownRight, Briefcase, Flame,
} from 'lucide-react';
import {
  useAdminIntelLiveTrafficQuery, useAdminIntelDemandQuery,
  useAdminIntelUnmetDemandQuery, useAdminIntelExpansionQuery, useAdminIntelCeoQuery,
} from '../../services/api';
import { SectionHeader, Card, PageLoader, EmptyState, StatCard, BarChart, Th, Td } from './_shared';
import BusinessIntelligence from './BusinessIntelligence';
import Heatmap from './Heatmap';
import Analytics from './Analytics';

/* ── helpers ──────────────────────────────────────────────────────────────── */
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
function dwell(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
function Delta({ pct }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(pct)}%
    </span>
  );
}
function MiniBars({ rows, color = '#6366f1', max = 5 }) {
  const top = (rows || []).slice(0, max);
  const hi = Math.max(1, ...top.map((r) => r.n));
  return (
    <div className="space-y-1.5">
      {top.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-28 truncate capitalize">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.n / hi) * 100}%`, background: color }} />
          </div>
          <span className="text-[11px] font-bold text-slate-700 tabular-nums w-8 text-right">{num(r.n)}</span>
        </div>
      ))}
      {top.length === 0 && <p className="text-xs text-slate-400">No data yet</p>}
    </div>
  );
}
function DaysSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none">
      <option value={7}>7 days</option>
      <option value={30}>30 days</option>
      <option value={90}>90 days</option>
    </select>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * CEO PULSE
 * ══════════════════════════════════════════════════════════════════════════ */
function CeoPulse() {
  const { data, isLoading, isFetching, refetch } = useAdminIntelCeoQuery(undefined, { pollingInterval: 15000 });
  if (isLoading) return <PageLoader />;
  const d = data || {};
  return (
    <div className="space-y-6">
      <SectionHeader title="CEO Pulse" subtitle="One screen — live business, growth and where to expand next.">
        <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </SectionHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Live Users" value={num(d.liveUsers)} Icon={Wifi} color="text-emerald-600" bg="bg-emerald-50" sub="active right now" />
        <StatCard label="Live Orders" value={num(d.liveOrders)} Icon={ShoppingBag} color="text-blue-600" bg="bg-blue-50" sub="in progress" />
        <StatCard label="Online Workers" value={num(d.onlineWorkers)} Icon={Briefcase} color="text-violet-600" bg="bg-violet-50" />
        <StatCard label="Revenue Today" value={inr(d.revenueToday)} Icon={IndianRupee} color="text-amber-600" bg="bg-amber-50"
          sub={<Delta pct={d.revenueGrowthPct ?? 0} />} />
        <StatCard label="Unmet Today" value={num(d.unmetToday)} Icon={MapPinOff} color="text-red-600" bg="bg-red-50" sub="no-service requests" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Search size={15} className="text-indigo-500" /> Top Demand Categories (30d)</p>
          <MiniBars rows={(d.topCategories || []).map((c) => ({ label: c.category?.replace(/_/g, ' '), n: c.searches }))} />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Globe size={15} className="text-blue-500" /> Top Cities by Demand (30d)</p>
          <MiniBars rows={(d.topCities || []).map((c) => ({ label: c.city, n: c.searches }))} color="#2563eb" />
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Rocket size={15} className="text-violet-500" /> Where to Launch Next</p>
        {(d.expansionTop || []).length === 0 ? (
          <p className="text-xs text-slate-400">Not enough demand signal yet — data accrues as visitors search.</p>
        ) : (
          <div className="space-y-2">
            {d.expansionTop.map((c, i) => (
              <div key={`${c.city}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 font-black flex items-center justify-center text-sm">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{c.city}{c.state ? `, ${c.state}` : ''}</p>
                  <p className="text-[11px] text-slate-500 truncate">{c.recommendation}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-violet-600 tabular-nums">{c.score}</p>
                  <p className="text-[10px] text-slate-400">score</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * LIVE TRAFFIC
 * ══════════════════════════════════════════════════════════════════════════ */
function LiveTraffic() {
  const [poll, setPoll] = useState(5000);
  const { data, isLoading } = useAdminIntelLiveTrafficQuery(undefined, { pollingInterval: poll });
  if (isLoading) return <PageLoader />;
  const d = data || {};
  const b = d.breakdown || {};
  return (
    <div className="space-y-6">
      <SectionHeader title="Live Traffic" subtitle={d.at ? `Updated ${new Date(d.at).toLocaleTimeString('en-IN')}` : undefined}>
        <select value={poll} onChange={(e) => setPoll(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none">
          <option value={3000}>3s</option><option value={5000}>5s</option><option value={10000}>10s</option><option value={0}>Manual</option>
        </select>
      </SectionHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Right Now" value={num(d.activeNow)} Icon={Wifi} color="text-emerald-600" bg="bg-emerald-50" sub="last 60s" />
        <StatCard label="Visitors Today" value={num(d.today)} Icon={Activity} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="This Week" value={num(d.week)} Icon={TrendingUp} color="text-violet-600" bg="bg-violet-50" />
        <StatCard label="This Month" value={num(d.month)} Icon={BarChart2} color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Smartphone size={13} /> Device (30m)</p><MiniBars rows={b.device} color="#10b981" /></Card>
        <Card className="p-5"><p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Monitor size={13} /> Browser (today)</p><MiniBars rows={b.browser} color="#6366f1" /></Card>
        <Card className="p-5"><p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Globe size={13} /> Top Cities (today)</p><MiniBars rows={b.city} color="#2563eb" /></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Radio size={15} className="text-emerald-500" />
          <p className="text-sm font-bold text-slate-700">Live Visitors ({d.live?.length || 0})</p>
          <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        {(d.live || []).length === 0 ? (
          <EmptyState message="No visitors active in the last 5 minutes" icon={Radio} />
        ) : (
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0"><tr>
                <Th>Page</Th><Th>On page</Th><Th>Type</Th><Th>Device</Th><Th>Browser / OS</Th><Th>Referrer</Th><Th>Location</Th><Th right>Pages</Th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {d.live.map((v, i) => (
                  <tr key={`${v.sessionId}-${i}`} className="hover:bg-slate-50">
                    <Td mono>{v.path}</Td>
                    <Td muted>{dwell(v.dwellSec)}</Td>
                    <Td><span className="text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{v.userType}</span></Td>
                    <Td muted>{v.device}</Td>
                    <Td muted>{v.browser} · {v.os}</Td>
                    <Td muted>{v.referrer}</Td>
                    <Td muted>{[v.city, v.state].filter(Boolean).join(', ') || '—'}</Td>
                    <Td right>{v.pageCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * DEMAND INTELLIGENCE
 * ══════════════════════════════════════════════════════════════════════════ */
function DemandIntel() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminIntelDemandQuery(days);
  if (isLoading) return <PageLoader />;
  const d = data || {};
  const split = d.split || { served: 0, noService: 0 };
  const total = split.served + split.noService;
  const fulfil = total ? Math.round((split.served / total) * 100) : 0;
  return (
    <div className="space-y-6">
      <SectionHeader title="Demand Intelligence" subtitle="Every service search — what people want, where, and what's trending.">
        <DaysSelect value={days} onChange={setDays} />
      </SectionHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Searches" value={num(total)} Icon={Search} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Served" value={num(split.served)} Icon={Activity} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="No Service" value={num(split.noService)} Icon={MapPinOff} color="text-red-600" bg="bg-red-50" />
        <StatCard label="Fulfilment" value={`${fulfil}%`} Icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-3">Most Searched Services</p>
          {(d.mostSearched || []).length === 0 ? <p className="text-xs text-slate-400">No searches in this window yet.</p> : (
            <div className="space-y-2">
              {d.mostSearched.slice(0, 12).map((c) => (
                <div key={c.category} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-32 truncate capitalize">{c.category?.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.searches / (d.mostSearched[0]?.searches || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-10 text-right tabular-nums">{num(c.searches)}</span>
                  <span className={`text-[10px] font-bold w-10 text-right ${c.fulfilmentPct >= 80 ? 'text-emerald-600' : c.fulfilmentPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{c.fulfilmentPct}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Flame size={15} className="text-orange-500" /> Trending (vs prior period)</p>
          {(d.trending || []).length === 0 ? <p className="text-xs text-slate-400">Not enough data to compute trends yet.</p> : (
            <div className="space-y-2">
              {d.trending.map((t) => (
                <div key={t.category} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-xs font-semibold text-slate-700 capitalize">{t.category?.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{t.prior}→{t.recent}</span>
                    <Delta pct={t.growthPct} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-bold text-slate-700 mb-3">Demand by City</p>
        <MiniBars rows={(d.byCity || []).map((c) => ({ label: c.city, n: c.searches }))} color="#2563eb" max={12} />
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * UNMET DEMAND (No Service Available)
 * ══════════════════════════════════════════════════════════════════════════ */
function UnmetDemand() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminIntelUnmetDemandQuery(days);
  if (isLoading) return <PageLoader />;
  const d = data || {};
  return (
    <div className="space-y-6">
      <SectionHeader title="Unmet Demand — No Service Available" subtitle="Where customers wanted us but found no coverage. This is your expansion map.">
        <DaysSelect value={days} onChange={setDays} />
      </SectionHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Lost Bookings" value={num(d.lostBookings)} Icon={MapPinOff} color="text-red-600" bg="bg-red-50" sub="no-service searches" />
        <StatCard label="Potential Revenue Lost" value={inr(d.potentialRevenueLost)} Icon={IndianRupee} color="text-amber-600" bg="bg-amber-50" sub="if served" />
        <StatCard label="Hotspot Areas" value={num((d.topAreas || []).length)} Icon={Globe} color="text-violet-600" bg="bg-violet-50" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-700">Top Unmet-Demand Areas</p></div>
        {(d.topAreas || []).length === 0 ? (
          <EmptyState message="No 'No Service Available' events captured yet" icon={MapPinOff} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Area</Th><Th>Requests</Th><Th>Categories wanted</Th><Th right>Est. revenue lost</Th><Th>Action</Th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {d.topAreas.map((a, i) => (
                  <tr key={`${a.city}-${i}`} className="hover:bg-slate-50">
                    <Td><span className="font-semibold text-slate-800">{a.city}</span>{a.state ? <span className="text-slate-400">, {a.state}</span> : null}</Td>
                    <Td><span className="font-bold text-red-600">{num(a.requests)}</span></Td>
                    <Td muted>{a.categories.map((c) => c.replace(/_/g, ' ')).join(', ')}</Td>
                    <Td right>{inr(a.estLostRevenue)}</Td>
                    <Td><span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">Launch {a.categories[0]?.replace(/_/g, ' ') || 'service'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-bold text-slate-700 mb-3">Categories with No Coverage</p>
        {(d.topCategories || []).length === 0 ? <p className="text-xs text-slate-400">No data yet.</p> : (
          <div className="space-y-2">
            {d.topCategories.map((c) => (
              <div key={c.category} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-xs font-semibold text-slate-700 capitalize">{c.category?.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-red-500 font-bold">{num(c.requests)} req</span>
                  <span className="text-[11px] text-amber-600 font-bold">{inr(c.lostRevenue)} lost</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * EXPANSION ENGINE
 * ══════════════════════════════════════════════════════════════════════════ */
function ScoreBar({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-16 capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-violet-400" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
function ExpansionEngine() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminIntelExpansionQuery(days);
  if (isLoading) return <PageLoader />;
  const cities = data?.cities || [];
  return (
    <div className="space-y-6">
      <SectionHeader title="City Expansion Engine" subtitle="AI Expansion Score = demand + unmet + revenue + growth + supply gap. Where to launch next.">
        <DaysSelect value={days} onChange={setDays} />
      </SectionHeader>

      {cities.length === 0 ? (
        <EmptyState message="No expansion candidates yet — demand data accrues as visitors search by location." icon={Rocket} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {cities.map((c, i) => (
            <Card key={`${c.city}-${i}`} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-sm">{i + 1}</div>
                  <div>
                    <p className="font-bold text-slate-900">{c.city}{c.state ? <span className="text-slate-400 font-normal">, {c.state}</span> : null}</p>
                    <p className="text-[11px] text-slate-500">{num(c.demand)} searches · {num(c.unmetRequests)} unmet · {c.approvedWorkers} workers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-violet-600 tabular-nums leading-none">{c.score}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Expansion Score</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                <ScoreBar label="demand" value={c.breakdown.demand} />
                <ScoreBar label="unmet" value={c.breakdown.unmet} />
                <ScoreBar label="revenue" value={c.breakdown.revenue} />
                <ScoreBar label="growth" value={c.breakdown.growth} />
                <ScoreBar label="supply gap" value={c.breakdown.supplyGap} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-[11px] text-slate-600 flex-1 pr-3">{c.recommendation}</p>
                <span className="text-[11px] font-bold text-emerald-600 shrink-0">{inr(c.estMonthlyRevenue)}/mo</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * HUB SHELL — title + dropdown
 * ══════════════════════════════════════════════════════════════════════════ */
const VIEWS = [
  { id: 'ceo',       label: 'CEO Pulse',          icon: Crown,     Comp: CeoPulse },
  { id: 'traffic',   label: 'Live Traffic',       icon: Radio,     Comp: LiveTraffic },
  { id: 'demand',    label: 'Demand Intel',       icon: Search,    Comp: DemandIntel },
  { id: 'unmet',     label: 'Unmet Demand',       icon: MapPinOff, Comp: UnmetDemand },
  { id: 'expansion', label: 'Expansion Engine',   icon: Rocket,    Comp: ExpansionEngine },
  { id: 'geo',       label: 'Geo / Heatmap',      icon: Globe,     Comp: Heatmap },
  { id: 'business',  label: 'Business Intel',     icon: TrendingUp, Comp: BusinessIntelligence },
  { id: 'analytics', label: 'Deep Analytics',     icon: BarChart2, Comp: Analytics },
];

export default function Intelligence() {
  const [params, setParams] = useSearchParams();
  const sub = params.get('sub') || 'ceo';
  const active = VIEWS.find((v) => v.id === sub) || VIEWS[0];
  const [open, setOpen] = useState(false);
  const ActiveComp = active.Comp;
  const ActiveIcon = active.icon;

  function pick(id) {
    const next = new URLSearchParams(params);
    next.set('tab', 'intelligence');
    next.set('sub', id);
    setParams(next, { replace: true });
    setOpen(false);
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Title + dropdown */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}>
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">Intelligence &amp; Expansion</h1>
            <p className="text-xs text-slate-400 mt-1">Live demand → data-driven hiring, marketing &amp; city launches</p>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-800 hover:border-slate-300">
            <ActiveIcon size={15} className="text-indigo-500" />
            {active.label}
            <ChevronDown size={15} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 p-1.5">
                {VIEWS.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button key={v.id} onClick={() => pick(v.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition ${
                        v.id === active.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <Icon size={15} className={v.id === active.id ? 'text-indigo-500' : 'text-slate-400'} />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <ActiveComp />
    </div>
  );
}
