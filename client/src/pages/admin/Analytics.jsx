import { useState } from 'react';
import { useAdminAnalyticsQuery, useAdminMetricsQuery, useAdminDemandPatternsQuery } from '../../services/api';
import { SectionHeader, Card, PageLoader } from './_shared';
import {
  IndianRupee, ShoppingBag, CheckCircle2, XCircle, Zap,
  ArrowUpRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import HealthCard, { computeHealth }  from './components/analytics/HealthCard';
import KpiCard                         from './components/analytics/KpiCard';
import RevenueTrend                    from './components/analytics/RevenueTrend';
import LeakagePanel                    from './components/analytics/LeakagePanel';
import ServiceMatrix                   from './components/analytics/ServiceMatrix';
import SupplyDemand                    from './components/analytics/SupplyDemand';
import OpsPanel                        from './components/analytics/OpsPanel';
import WorkerLeaderboard               from './components/analytics/WorkerLeaderboard';
import WeeklySignups                   from './components/analytics/WeeklySignups';
import DecisionAlerts                  from './components/analytics/DecisionAlerts';

function fmtR(rupees) {
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000)   return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching, isError, error, refetch } = useAdminAnalyticsQuery(days);
  const { data: live }     = useAdminMetricsQuery(undefined, { pollingInterval: 30000 });
  const { data: patterns } = useAdminDemandPatternsQuery({ days });

  if (isLoading) return <PageLoader />;

  const d   = data || {};
  const ops = d.ops || {};
  const score = computeHealth(d, ops);

  return (
    <div className="space-y-5">
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

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Analytics API error</p>
            <p className="text-xs text-red-500">{error?.data?.message || error?.status || 'Could not load data'}</p>
          </div>
        </div>
      )}

      {live && (
        <Card className="px-5 py-3 flex flex-wrap gap-6 items-center bg-slate-900 border-slate-800">
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Live Now
          </span>
          {[
            { label: 'Active',          value: live.active },
            { label: 'Online Workers',  value: `${live.onlineWorkers}/${live.totalWorkers}` },
            { label: 'Today Orders',    value: live.ordersToday },
            { label: 'Done Today',      value: live.completedToday },
            { label: 'Rev Today',       value: `₹${(live.revenueToday || 0).toLocaleString('en-IN')}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-sm font-extrabold text-white tabular-nums">{value}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 xl:col-span-1">
          <HealthCard score={score} d={d} ops={ops} />
        </div>
        <KpiCard label="Revenue"         value={fmtR(d.totalRevRupees || 0)}              Icon={IndianRupee}  color="text-blue-600"    bg="bg-blue-50"    pct={d.changes?.revenue} />
        <KpiCard label="Total Orders"    value={(d.totalOrders || 0).toLocaleString()}     Icon={ShoppingBag}  color="text-orange-600"  bg="bg-orange-50"  pct={d.changes?.orders} />
        <KpiCard label="Completed"       value={(d.completedOrders || 0).toLocaleString()} Icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" pct={d.changes?.completed} />
        <KpiCard label="Cancel Rate"     value={`${d.cancelRate || 0}%`}                   Icon={XCircle}      color="text-red-500"     bg="bg-red-50" />
        <KpiCard label="Avg Order Value" value={fmtR(d.avgFareRupees || 0)}                Icon={Zap}          color="text-amber-600"   bg="bg-amber-50"   pct={d.changes?.avgFare} />
      </div>

      <DecisionAlerts d={d} ops={ops} />

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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-slate-800">Service Health Matrix</p>
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Demand × Quality quadrant</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Where each service sits — use this to decide where to invest or cut</p>
        <ServiceMatrix services={d.serviceBreakdown || []} />
      </Card>

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
