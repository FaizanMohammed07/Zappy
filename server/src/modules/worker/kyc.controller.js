const Worker = require('./worker.model');
const auditService = require('../admin/audit.service');

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
    const updated = await Worker.findByIdAndUpdate(
      req.auth.sub,
      {
        $set: {
          'kyc.status': 'pending_review',
          'kyc.aadhaarUrl': req.body.aadhaarUrl,
          'kyc.licenseUrl': req.body.licenseUrl,
          'kyc.selfieUrl': req.body.selfieUrl,
          'kyc.submittedAt': new Date(),
          'kyc.rejectionReason': null,
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
