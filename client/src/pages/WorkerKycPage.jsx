import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, CheckCircle2, Clock, XCircle,
  ShieldCheck, FileText, Camera, Loader2, AlertTriangle,
} from 'lucide-react';
import { useGetKycStatusQuery, useSubmitKycMutation, usePresignUploadMutation } from '../services/api';
import toast from 'react-hot-toast';

const DOCS = [
  { key: 'aadhaarUrl', label: 'Aadhaar Card (Front)', sublabel: 'Government-issued ID', Icon: FileText, required: true },
  { key: 'licenseUrl', label: 'Driving License', sublabel: 'Optional but recommended', Icon: FileText, required: false },
  { key: 'selfieUrl',  label: 'Clear Selfie', sublabel: 'Must be recent, face clearly visible', Icon: Camera, required: true },
];

export default function WorkerKycPage() {
  const nav = useNavigate();
  const { data, refetch, isLoading } = useGetKycStatusQuery();
  const [presign] = usePresignUploadMutation();
  const [submitKyc, { isLoading: submitting }] = useSubmitKycMutation();
  const [urls, setUrls] = useState({});
  const [uploading, setUploading] = useState(null);

  const status = data?.kyc?.status || 'not_submitted';

  async function handleUpload(docKey, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5MB'); return; }
    try {
      setUploading(docKey);
      const { data: signed } = await presign({ folder: 'kyc', contentType: file.type || 'image/jpeg' });
      const putRes = await fetch(signed.uploadUrl, {
        method: 'PUT', body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      });
      if (!putRes.ok) throw new Error('Upload failed');
      setUrls((prev) => ({ ...prev, [docKey]: signed.key }));
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    if (!urls.aadhaarUrl || !urls.selfieUrl) {
      toast.error('Aadhaar and selfie are required');
      return;
    }
    try {
      await submitKyc(urls).unwrap();
      toast.success('Documents submitted for review');
      refetch();
    } catch (err) {
      toast.error(err.data?.error || 'Submission failed');
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 size={28} className="text-zappy-600 animate-spin" />
      </div>
    );
  }

  if (status === 'pending_review') return <StatusScreen type="pending" onBack={() => nav('/worker')} />;
  if (status === 'approved') return <StatusScreen type="approved" onBack={() => nav('/worker')} />;

  const rejectionReason = data?.kyc?.rejectionReason;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-40">
      <header className="page-header">
        <div className="page-header-inner">
          <button onClick={() => nav('/worker')} className="back-btn">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div>
            <p className="t-label">Verification</p>
            <p className="font-semibold text-[#0F172A]">KYC Documents</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">

        {/* Rejection notice */}
        {status === 'rejected' && rejectionReason && (
          <div className="card bg-red-50 ring-1 ring-red-200">
            <div className="flex items-start gap-3">
              <XCircle size={16} strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Previous Submission Rejected</p>
                <p className="text-sm text-red-600 mt-1 leading-relaxed">{rejectionReason}</p>
                <p className="text-xs text-red-500 mt-1.5">Please re-upload and resubmit your documents.</p>
              </div>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="card bg-zappy-50 ring-zappy-100">
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} strokeWidth={2} className="text-zappy-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-zappy-700 leading-relaxed">
              Your documents are encrypted and used only for identity verification.
              Submissions are reviewed within 24 hours.
            </p>
          </div>
        </div>

        {/* Document upload cards */}
        {DOCS.map(({ key, label, sublabel, Icon, required }) => {
          const uploaded = !!urls[key];
          const isUploading = uploading === key;
          return (
            <div key={key} className={`card ${uploaded ? 'ring-success-200 bg-success-50/30' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  uploaded ? 'bg-success-100' : 'bg-slate-100'
                }`}>
                  <Icon size={18} strokeWidth={1.75} className={uploaded ? 'text-success-600' : 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-[#0F172A]">{label}</p>
                    {required && <span className="text-red-500 text-xs font-bold">*</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
                  {uploaded && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CheckCircle2 size={12} strokeWidth={2.5} className="text-success-600" />
                      <span className="text-xs font-semibold text-success-700">Uploaded</span>
                    </div>
                  )}
                </div>
                <label className={`btn-secondary cursor-pointer text-xs py-2 px-3 ${isUploading ? 'opacity-50' : ''}`}>
                  {isUploading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> Uploading
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Upload size={11} strokeWidth={2.5} />
                      {uploaded ? 'Replace' : 'Upload'}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => handleUpload(key, e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 safe-pb">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          <button
            onClick={submit}
            disabled={submitting || !urls.aadhaarUrl || !urls.selfieUrl}
            className="btn-primary w-full"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} strokeWidth={2.5} />}
            {submitting ? 'Submitting…' : 'Submit for Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusScreen({ type, onBack }) {
  const isPending = type === 'pending';
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="page-header">
        <div className="page-header-inner">
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <h1 className="h-card">Verification</h1>
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
          isPending ? 'bg-amber-50' : 'bg-success-50'
        }`}>
          {isPending
            ? <Clock size={40} strokeWidth={1.5} className="text-amber-500" />
            : <ShieldCheck size={40} strokeWidth={1.5} className="text-success-600" />
          }
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">
            {isPending ? 'Under Review' : 'KYC Approved'}
          </h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs">
            {isPending
              ? 'Your documents are being verified. We will notify you within 24 hours.'
              : 'Your identity is verified. Go online to start receiving job requests.'
            }
          </p>
        </div>
        <button onClick={onBack} className="btn-primary px-8">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
