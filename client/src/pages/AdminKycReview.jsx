import { useState } from 'react';
import { CheckCircle2, XCircle, FileText, Loader2, Clock } from 'lucide-react';
import {
  useAdminKycPendingQuery, useAdminKycApproveMutation, useAdminKycRejectMutation,
} from '../services/api';
import toast from 'react-hot-toast';

export default function AdminKycReview() {
  const { data, refetch, isLoading } = useAdminKycPendingQuery();
  const [approve, { isLoading: approving }] = useAdminKycApproveMutation();
  const [reject] = useAdminKycRejectMutation();
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');

  async function onApprove(w) {
    try {
      await approve(w._id).unwrap();
      toast.success(`${w.name} approved`);
      refetch();
      setSelected(null);
    } catch (err) {
      toast.error(err.data?.error || 'Failed');
    }
  }

  async function onReject() {
    if (!reason.trim() || reason.trim().length < 3) {
      toast.error('Provide a rejection reason (min 3 chars)');
      return;
    }
    try {
      await reject({ id: selected._id, reason }).unwrap();
      toast.success(`${selected.name} rejected`);
      setSelected(null);
      setReason('');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Failed');
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={24} className="text-zappy-600 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0F172A]">KYC — Pending Review</h2>
        <span className="chip-accent">{data?.total || 0} pending</span>
      </div>

      {(!data?.workers?.length) && (
        <div className="bg-white rounded-card shadow-card ring-1 ring-slate-100 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-success-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} strokeWidth={1.5} className="text-success-600" />
          </div>
          <p className="font-semibold text-[#0F172A]">All caught up!</p>
          <p className="text-sm text-slate-400 mt-1">No pending KYC submissions</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {data?.workers?.map((w) => (
          <div key={w._id} className="bg-white rounded-card shadow-card ring-1 ring-slate-100 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-[#0F172A]">{w.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{w.phone}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={11} strokeWidth={2} />
                {new Date(w.kyc?.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {w.skills?.map((s) => (
                <span key={s} className="chip-neutral text-[10px]">{s.replace(/_/g, ' ')}</span>
              ))}
            </div>

            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              {w.kyc?.aadhaarUrl && (
                <DocRow label="Aadhaar" value={w.kyc.aadhaarUrl.slice(-24)} />
              )}
              {w.kyc?.licenseUrl && (
                <DocRow label="License" value={w.kyc.licenseUrl.slice(-24)} />
              )}
              {w.kyc?.selfieUrl && (
                <DocRow label="Selfie" value={w.kyc.selfieUrl.slice(-24)} />
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onApprove(w)}
                disabled={approving}
                className="btn-success flex-1 py-2 text-sm"
              >
                {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} strokeWidth={2.5} />}
                Approve
              </button>
              <button onClick={() => setSelected(w)} className="btn-danger flex-1 py-2 text-sm">
                <XCircle size={13} strokeWidth={2.5} />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reject modal */}
      {selected && (
        <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft-lg max-w-md w-full p-5 space-y-4">
            <div>
              <p className="t-label mb-1">Rejecting KYC for</p>
              <p className="font-bold text-lg text-[#0F172A]">{selected.name}</p>
            </div>
            <div>
              <label className="input-label">Rejection Reason (visible to worker)</label>
              <textarea
                rows={3}
                className="input resize-none text-sm"
                placeholder="e.g. Aadhaar image is blurry. Please re-upload…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setSelected(null); setReason(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={onReject} className="btn-danger flex-1">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <FileText size={11} strokeWidth={2} className="text-slate-400 shrink-0" />
      <span className="text-[11px] text-slate-500 font-semibold w-14 shrink-0">{label}</span>
      <span className="text-[11px] font-mono text-slate-600 truncate">…{value}</span>
    </div>
  );
}
