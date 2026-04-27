import { useState } from 'react';
import { useAdminAnalyticsQuery } from '../../services/api';
import { SectionHeader, Card, PageLoader, BarChart, LineSparkline, fmt } from './_shared';

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminAnalyticsQuery(days);

  if (isLoading) return <PageLoader />;

  const dailyRevenue = data?.dailyRevenue?.map(d => ({ label: d.date?.slice(5), value: d.revenuePaise / 100 })) || [];
  const funnel = data?.orderFunnel || {};

  return (
    <div className="space-y-6">
      <SectionHeader title="Analytics">
        <div className="flex gap-1.5">
          {DAY_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${days === d ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </SectionHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-slate-900">{data?.totalRevenueRupees ? `₹${data.totalRevenueRupees.toLocaleString('en-IN')}` : '₹0'}</p>
          <p className="text-xs text-slate-400 font-semibold mt-1">Total Revenue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-slate-900">{(funnel.completed || 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 font-semibold mt-1">Completed Orders</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-slate-900">
            {funnel.completed && funnel.cancelled
              ? `${((funnel.cancelled / (funnel.completed + funnel.cancelled)) * 100).toFixed(1)}%`
              : '0%'}
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">Cancel Rate</p>
        </Card>
      </div>

      {/* Revenue trend */}
      {dailyRevenue.length > 1 && (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-1">Daily Revenue (₹)</p>
          <p className="text-xs text-slate-400 mb-4">Last {days} days</p>
          <div className="h-20">
            <LineSparkline data={dailyRevenue} color="#2563EB" />
          </div>
          <div className="flex justify-between mt-2">
            {dailyRevenue.filter((_, i) => i % Math.ceil(dailyRevenue.length / 6) === 0).map((d, i) => (
              <span key={i} className="text-[10px] text-slate-400">{d.label}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Service breakdown */}
      {data?.serviceBreakdown?.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-4">Revenue by Service</p>
          <div className="space-y-2.5">
            {data.serviceBreakdown.map((s) => {
              const max = data.serviceBreakdown[0]?.revenuePaise || 1;
              return (
                <div key={s.service} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-28 capitalize shrink-0">{s.service?.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(s.revenuePaise / max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-20 text-right">₹{s.avgFareRupees || 0} avg</span>
                  <span className="text-xs text-slate-400 w-14 text-right">{s.orders} orders</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Order funnel */}
      {Object.keys(funnel).length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-4">Order Funnel</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['created', 'searching', 'assigned', 'in_progress', 'completed', 'cancelled', 'failed'].map(s => (
              funnel[s] != null && (
                <div key={s} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{funnel[s]}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{s.replace(/_/g, ' ')}</p>
                </div>
              )
            ))}
          </div>
        </Card>
      )}

      {/* Top workers */}
      {data?.topWorkers?.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">Top Earners</p>
          </div>
          <div className="divide-y divide-slate-50">
            {data.topWorkers.slice(0, 10).map((w, i) => (
              <div key={w._id} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm font-bold text-slate-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{w.name || '—'}</p>
                  <p className="text-xs text-slate-400">{w.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">{fmt(w.earningPaise || 0)}</p>
                  <p className="text-xs text-slate-400">{w.jobs} jobs · {w.avgRating?.toFixed(1) || '—'} ★</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly signups */}
      {data?.weeklySignups && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[['User Signups', data.weeklySignups.users], ['Worker Signups', data.weeklySignups.workers]].map(([title, rows]) => (
            <Card key={title} className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-4">{title} — weekly</p>
              {rows?.length > 0 ? (
                <div className="relative pt-6">
                  <BarChart
                    data={rows.map(r => ({ label: r._id, value: r.count }))}
                    color="#6366f1" height={60}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No signup data</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
