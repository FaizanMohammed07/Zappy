import { useState } from 'react';
import { useAdminListUsersQuery, useAdminBlockUserMutation } from '../../services/api';
import { Search, ShieldOff, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { SectionHeader, Pagination, StatusBadge, Card, Th, Td, PageLoader, EmptyState, fmtDate } from './_shared';
import toast from 'react-hot-toast';

export default function Users() {
  const [q, setQ] = useState('');
  const [blocked, setBlocked] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching, refetch } = useAdminListUsersQuery({ q: q || undefined, blocked: blocked || undefined, page });
  const [blockUser] = useAdminBlockUserMutation();

  async function toggleBlock(u) {
    try {
      await blockUser({ id: u._id, blocked: !u.isBlocked }).unwrap();
      toast.success(u.isBlocked ? 'User unblocked' : 'User blocked');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Action failed');
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Users" subtitle={data?.total != null ? `${data.total} registered` : ''} />

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
        <select
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
          value={blocked}
          onChange={(e) => { setBlocked(e.target.value); setPage(1); }}
        >
          <option value="">All users</option>
          <option value="false">Active only</option>
          <option value="true">Blocked only</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        {isFetching && <div className="h-1 bg-blue-600 animate-pulse" />}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Rating</Th><Th>Status</Th><Th>Joined</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.users?.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                  <Td><span className="font-semibold text-slate-900">{u.name || '—'}</span></Td>
                  <Td muted>{u.phone}</Td>
                  <Td muted>{u.email || '—'}</Td>
                  <Td><span className="font-semibold">{u.rating?.toFixed(1) || '5.0'} ★</span></Td>
                  <Td>
                    <StatusBadge status={u.isBlocked ? 'blocked' : 'online'} />
                  </Td>
                  <Td muted>{fmtDate(u.createdAt)}</Td>
                  <Td>
                    <button
                      onClick={() => toggleBlock(u)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        u.isBlocked
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {u.isBlocked ? <><ShieldCheck size={12} /> Unblock</> : <><ShieldOff size={12} /> Block</>}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.users?.length && !isFetching && <EmptyState message="No users found" icon={UsersIcon} />}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination page={page} total={data?.total} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </Card>
    </div>
  );
}
