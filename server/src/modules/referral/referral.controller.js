const referralService = require('./referral.service');
const { ReferralCode, ReferralUse } = require('./referral.model');

async function getMyCode(req, res, next) {
  try {
    if (!['user', 'worker'].includes(req.auth.role)) {
      return res.status(403).json({ error: 'Referrals only for users/workers' });
    }
    const code = await referralService.getOrCreateCode({ kind: req.auth.role, id: req.auth.sub });
    const uses = await ReferralUse.countDocuments({ code: code.code });
    const rewarded = await ReferralUse.countDocuments({ code: code.code, status: 'rewarded' });
    res.json({
      code: code.code,
      shareUrl: `https://zappy.example/signup?ref=${code.code}`,
      stats: { signups: uses, rewarded, totalEarnedPaise: code.totalRewardsPaise },
    });
  } catch (err) { next(err); }
}

async function applyCode(req, res, next) {
  try {
    const use = await referralService.applyAtSignup({
      code: req.body.code,
      referee: { kind: req.auth.role, id: req.auth.sub },
      refereeIp: req.ip,
      refereeDeviceId: req.get('x-device-id'),
    });
    res.status(201).json({ use });
  } catch (err) { next(err); }
}

module.exports = { getMyCode, applyCode };
