import { useState } from 'react';
import { useAdminOrdersQuery, useAdminRefundOrderMutation } from '../../services/api';
import { Search, RotateCcw, Loader2 } from 'lucide-react';
import { SectionHeader, Pagination, StatusBadge, Card, Th, Td, PageLoader, EmptyState, fmtDate } from './_shared';
import { ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'failed'];

export default function Orders() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const { data, isFetching } = useAdminOrdersQuery({ status: status || undefined, page });
  const [refundOrder] = useAdminRefundOrderMutation();

  return (
    <div className="space-y-4">
      <SectionHeader title="Orders" subtitle={data?.total != null ? `${data.total} total` : ''} />

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              status === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isFetching && <div className="h-1 bg-blue-600 animate-pulse" />}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Order ID</Th><Th>Service</Th><Th>Customer</Th><Th>Worker</Th>
                <Th>Status</Th><Th right>Amount</Th><Th>Payment</Th><Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.orders?.map((o) => (
                <tr
                  key={o._id}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  onClick={() => setSelected(o)}
                >
                  <Td mono>#{o._id.slice(-8)}</Td>
                  <Td>{o.service?.replace(/_/g, ' ')}</Td>
                  <Td muted>{o.userId?.name || o.userId?.phone || '—'}</Td>
                  <Td muted>{o.workerId?.name || '—'}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td right><span className="font-bold text-slate-900">₹{o.pricing?.total || 0}</span></Td>
                  <Td muted>{o.payment?.method || '—'}</Td>
                  <Td muted>{fmtDate(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.orders?.length && !isFetching && (
            <EmptyState message="No orders found" icon={ClipboardList} />
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination page={page} total={data?.total} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </Card>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Order #{selected._id.slice(-10)}</h3>
              <StatusBadge status={selected.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Service', selected.service?.replace(/_/g, ' ')],
                ['Customer', selected.userId?.name || selected.userId?.phone || '—'],
                ['Worker', selected.workerId?.name || '—'],
                ['Amount', `₹${selected.pricing?.total || 0}`],
                ['Payment', selected.payment?.method || '—'],
                ['Pay Status', selected.payment?.status || '—'],
                ['Priority', selected.priority || 'normal'],
                ['Created', fmtDate(selected.createdAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase">{k}</p>
                  <p className="font-medium text-slate-800 capitalize">{v}</p>
                </div>
              ))}
            </div>
            {selected.pickupLocation?.address && (
              <div>
                <p className="text-[11px] text-slate-400 font-semibold uppercase mb-0.5">Pickup</p>
                <p className="text-sm text-slate-700">{selected.pickupLocation.address}</p>
              </div>
            )}
            {selected.description && (
              <div>
                <p className="text-[11px] text-slate-400 font-semibold uppercase mb-0.5">Description</p>
                <p className="text-sm text-slate-700">{selected.description}</p>
              </div>
            )}
            {/* Refund button — only for paid online orders */}
            {selected.payment?.status === 'paid' && selected.payment?.method !== 'cash' && (
              <button
                onClick={async () => {
                  if (!window.confirm(`Refund ₹${selected.pricing?.total} for order #${selected._id.slice(-8)}?`)) return;
                  setRefunding(true);
                  try {
                    await refundOrder({ id: selected._id }).unwrap();
                    toast.success('Refund initiated');
                    setSelected(null);
                  } catch (err) {
                    toast.error(err.data?.error || 'Refund failed');
                  } finally {
                    setRefunding(false);
                  }
                }}
                disabled={refunding}
                className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-100 transition"
              >
                {refunding ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {refunding ? 'Refunding…' : `Refund ₹${selected.pricing?.total}`}
              </button>
            )}
            <button onClick={() => setSelected(null)} className="w-full py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
