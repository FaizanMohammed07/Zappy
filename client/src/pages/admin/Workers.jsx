import { useState } from 'react';
import { useAdminWorkersQuery, useAdminBlockWorkerMutation, useAdminWorkerPenaltiesQuery } from '../../services/api';
import { Search, ShieldOff, ShieldCheck, Briefcase, X } from 'lucide-react';
import { SectionHeader, Pagination, StatusBadge, Card, Th, Td, EmptyState, PageLoader, fmtDate, fmt } from './_shared';
import toast from 'react-hot-toast';

const SKILLS = ['puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair', 'cleaning', 'painting'];

export default function Workers() {
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [online, setOnline] = useState('');
  const [page, setPage] = useState(1);
  const [penaltyId, setPenaltyId] = useState(null);

  const { data, isFetching, refetch } = useAdminWorkersQuery({ q: q || undefined, skill: skill || undefined, online: online || undefined, page });
  const [blockWorker] = useAdminBlockWorkerMutation();

  async function toggleBlock(w) {
    try {
      await blockWorker({ id: w._id, blocked: !w.isBlocked }).unwrap();
      toast.success(w.isBlocked ? 'Worker unblocked' : 'Worker blocked');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Action failed');
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Workers" subtitle={data?.total != null ? `${data.total} registered` : ''} />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Search name or phone…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
          value={skill} onChange={(e) => { setSkill(e.target.value); setPage(1); }}>
          <option value="">All skills</option>
          {SKILLS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
          value={online} onChange={(e) => { setOnline(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="true">Online only</option>
          <option value="false">Offline only</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        {isFetching && <div className="h-1 bg-blue-600 animate-pulse" />}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Name</Th><Th>Phone</Th><Th>Skills</Th><Th>Rating</Th><Th>Jobs</Th>
                <Th>KYC</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.workers?.map((w) => (
                <tr key={w._id} className="hover:bg-slate-50/60 transition-colors">
                  <Td>
                    <button
                      className="font-semibold text-blue-700 hover:underline text-left"
                      onClick={() => setPenaltyId(w._id)}
                    >
                      {w.name}
                    </button>
                  </Td>
                  <Td muted>{w.phone}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {w.skills?.slice(0, 2).map(s => (
                        <span key={s} className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {w.skills?.length > 2 && <span className="text-[10px] text-slate-400">+{w.skills.length - 2}</span>}
                    </div>
                  </Td>
                  <Td><span className="font-semibold">{w.rating?.toFixed(1)} ★</span></Td>
                  <Td muted>{w.completedJobs || 0} done</Td>
                  <Td><StatusBadge status={w.kyc?.status || 'not_submitted'} /></Td>
                  <Td>
                    {w.isBlocked ? <StatusBadge status="blocked" /> : w.isOnline ? <StatusBadge status="online" /> : <StatusBadge status="offline" />}
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggleBlock(w)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        w.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {w.isBlocked ? <><ShieldCheck size={12} /> Unblock</> : <><ShieldOff size={12} /> Block</>}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.workers?.length && !isFetching && <EmptyState message="No workers found" icon={Briefcase} />}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination page={page} total={data?.total} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </Card>

      {penaltyId && <PenaltyPanel workerId={penaltyId} onClose={() => setPenaltyId(null)} />}
    </div>
  );
}

function PenaltyPanel({ workerId, onClose }) {
  const { data, isLoading } = useAdminWorkerPenaltiesQuery(workerId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Worker Penalties</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        {isLoading ? <PageLoader /> : data ? (
          <>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-900">{data.worker?.name}</p>
              <p className="text-sm text-slate-500">{data.worker?.phone}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Total Offers', data.penalties?.totalOffers || 0],
                ['Total Rejects', data.penalties?.totalRejects || 0],
                ['Total Cancels', data.penalties?.totalCancels || 0],
                ['No Shows', data.penalties?.totalNoShows || 0],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{k}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-orange-700">{(data.lifetimeRates?.rejectRate * 100).toFixed(0)}%</p>
                <p className="text-xs text-orange-600 mt-0.5">Reject Rate</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-700">{(data.lifetimeRates?.cancelRate * 100).toFixed(0)}%</p>
                <p className="text-xs text-red-600 mt-0.5">Cancel Rate</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Recent window ({data.recentWindow?.size} offers)</p>
              <div className="flex flex-wrap gap-1">
                {data.recentWindow?.outcomes?.map((o, i) => (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    o === 'accept' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{o}</span>
                ))}
              </div>
            </div>
          </>
        ) : <p className="text-sm text-slate-400 text-center">No penalty data</p>}
      </div>
    </div>
  );
}
