import { motion } from 'framer-motion';
import { Zap, MapPin, Clock, Wallet, FileText } from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';
import { money } from './_shared';

/**
 * Booking summary card — service, address, schedule, payment,
 * itemised fees, total, and receipt/GST-invoice download.
 * Reads directly from `order.pricing.*` — no fabricated values.
 */
export default function BookingSummary({ order, deviceLabel, onReceipt }) {
  const p = order.pricing || {};
  const when = order.scheduledAt || order.createdAt;
  const whenLabel = when
    ? new Date(when).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';
  const payMethod = { upi: 'UPI', cash: 'Cash', card: 'Card' }[order.payment?.method] || 'UPI';

  // Grounded fee breakdown: only include lines the backend actually recorded.
  const lines = [
    p.baseFee     > 0 && ['Service fee',       p.baseFee],
    p.distanceFee > 0 && ['Distance',          p.distanceFee],
    p.platformFee > 0 && ['Platform & taxes',  p.platformFee],
  ].filter(Boolean);

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-[24px] bg-white p-[18px]"
      style={{
        boxShadow: '0 12px 34px -12px rgba(15,23,42,.18)',
        border: '1px solid rgba(255,255,255,.9)',
      }}
    >
      <h3 className="text-[16px] font-extrabold tracking-[-.02em] text-[#0B1220] mb-2">
        Booking summary
      </h3>

      <SummaryRow
        icon={<Zap size={17} fill="currentColor" strokeWidth={0} />}
        k="Service"
        v={<span className="capitalize">{order.service.replace(/_/g, ' ')}</span>}
        right={deviceLabel ? { k: 'Device', v: deviceLabel } : null}
      />
      <SummaryRow
        icon={<MapPin size={17} strokeWidth={2} />}
        k="Service address"
        v={order.pickupLocation?.address || '—'}
      />
      <SummaryRow
        icon={<Clock size={17} strokeWidth={2} />}
        k={order.scheduledAt ? 'Scheduled' : 'Booked'}
        v={whenLabel}
        right={{
          node: (
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0B1220] px-2.5 py-1.5 rounded-[10px]"
              style={{ background: '#F1F5FB' }}
            >
              <Wallet size={14} className="text-[#2563FF]" /> {payMethod}
            </span>
          ),
        }}
      />

      {(lines.length > 0 || p.total != null) && (
        <div className="mt-1.5 pt-3.5" style={{ borderTop: '1.5px dashed #EAEEF6' }}>
          {lines.map(([label, val]) => (
            <div
              key={label}
              className="flex justify-between items-baseline text-[12.5px] text-[#647084] py-[3px]"
            >
              <span>{label}</span>
              <span className="font-bold text-[#334155] tabular-nums">{money(val)}</span>
            </div>
          ))}
          {p.total != null && (
            <div className="flex justify-between items-center mt-2 pt-3" style={{ borderTop: '1px solid #EAEEF6' }}>
              <span className="text-[13px] font-bold text-[#0B1220]">
                Total {order.status === 'completed' ? 'paid' : 'payable'}
              </span>
              <span className="text-[22px] font-extrabold tracking-[-.03em] text-[#0B1220] tabular-nums">
                {money(p.total)}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onReceipt}
        className="mt-3.5 w-full h-[46px] rounded-[15px] flex items-center justify-center gap-2 text-[13.5px] font-bold text-[#334155] transition active:scale-[.98]"
        style={{ border: '1.5px solid #EAEEF6', background: '#fff' }}
      >
        <FileText size={16} className="text-[#2563FF]" /> Download receipt · GST invoice
      </button>
    </motion.div>
  );
}

function SummaryRow({ icon, k, v, right }) {
  return (
    <div className="flex items-center gap-3.5 py-3" style={{ borderBottom: '1px solid #EAEEF6' }}>
      <span
        className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 text-[#647084]"
        style={{ background: '#F1F5FB' }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[#647084] tracking-[.02em]">{k}</div>
        <div className="text-[14px] font-bold text-[#0B1220] mt-0.5 tracking-[-.01em] truncate">{v}</div>
      </div>
      {right && (
        <div className="ml-auto text-right shrink-0">
          {right.node ? right.node : (
            <>
              <div className="text-[11px] font-semibold text-[#647084]">{right.k}</div>
              <div className="text-[14px] font-bold text-[#0B1220] mt-0.5">{right.v}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
