const Worker = require('./worker.model');
const auditService = require('../admin/audit.service');

// Resubmission controls (#86)
const RESUBMIT_COOLDOWN_MS  = 24 * 60 * 60 * 1000; // 24h after rejection
const SUSPENSION_THRESHOLD  = 5;                     // 5 rejections → KYC suspended

async function submitKyc(req, res, next) {
  try {
    const w = await Worker.findById(req.auth.sub).select('kyc').lean();
    if (!w) return res.status(404).json({ error: 'Worker not found' });

    if (w.kyc?.status === 'approved') {
      return res.status(409).json({ error: 'KYC already approved', code: 'KYC_LOCKED' });
    }
    if (w.kyc?.status === 'pending_review') {
      return res.status(409).json({ error: 'KYC already submitted and under review', code: 'KYC_PENDING' });
    }
    if (w.kyc?.status === 'suspended') {
      return res.status(403).json({
        error: 'KYC submissions suspended after multiple rejections. Contact support.',
        code: 'KYC_SUSPENDED',
      });
    }

    // Resubmission cooldown: must wait 24h after rejection (#86)
    if (w.kyc?.status === 'rejected' && w.kyc?.lastRejectedAt) {
      const msSinceRejection = Date.now() - new Date(w.kyc.lastRejectedAt).getTime();
      if (msSinceRejection < RESUBMIT_COOLDOWN_MS) {
        const waitHours = Math.ceil((RESUBMIT_COOLDOWN_MS - msSinceRejection) / 3600000);
        return res.status(429).json({
          error: `Please wait ${waitHours} more hour(s) before resubmitting KYC.`,
          code: 'KYC_COOLDOWN',
          waitHours,
        });
      }
    }

    const now = new Date();
    const rejectionCount = w.kyc?.rejectionCount || 0;

    // Auto-suspend after threshold rejections (#86)
    if (rejectionCount >= SUSPENSION_THRESHOLD) {
      await Worker.updateOne({ _id: req.auth.sub }, { $set: { 'kyc.status': 'suspended' } });
      return res.status(403).json({
        error: 'KYC submissions suspended after repeated rejections. Contact support to proceed.',
        code: 'KYC_SUSPENDED',
      });
    }

    const updated = await Worker.findByIdAndUpdate(
      req.auth.sub,
      {
        $set: {
          'kyc.status':          'pending_review',
          'kyc.aadhaarUrl':      req.body.aadhaarUrl,
          'kyc.licenseUrl':      req.body.licenseUrl,
          'kyc.selfieUrl':       req.body.selfieUrl,
          'kyc.submittedAt':     now,
          'kyc.rejectionReason': null,
        },
        // Append immutable audit trail entry (#86)
        $push: {
          'kyc.submissionHistory': {
            aadhaarUrl:    req.body.aadhaarUrl,
            licenseUrl:    req.body.licenseUrl,
            selfieUrl:     req.body.selfieUrl,
            submittedAt:   now,
            outcome:       'pending',
          },
        },
      },
      { new: true }
    );
    await auditService.fromRequest(req, 'worker.kyc_submit', { kind: 'worker', id: req.auth.sub }, w.kyc, updated.kyc);
    res.json({ kyc: updated.kyc });
  } catch (err) { next(err); }
}

async function getKycStatus(req, res, next) {
  try {
    const w = await Worker.findById(req.auth.sub).select('kyc').lean();
    res.json({ kyc: w?.kyc || { status: 'not_submitted' } });
  } catch (err) { next(err); }
}

module.exports = { submitKyc, getKycStatus };
