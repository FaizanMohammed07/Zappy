const adService = require('./ad.service');
const AdWallet  = require('./ad-wallet.model');

// ─── Public / user-facing ─────────────────────────────────────────────────────

async function getActive(req, res, next) {
  try {
    const audience = req.auth?.role === 'worker' ? 'workers' : 'users';
    const ads = await adService.getActiveAds({ audience, limit: 8 });
    res.json({ ads });
  } catch (err) { next(err); }
}

/** GET /api/ads/placement/:placement?city=&category=&q= */
async function getByPlacement(req, res, next) {
  try {
    const { placement } = req.params;
    const { city, category, q, limit = 3 } = req.query;
    const ads = await adService.getAdsByPlacement({
      placement,
      city,
      categoryId: category,
      keywords:   q,
      userId:     req.auth?.sub,
      limit:      Math.min(Number(limit) || 3, 10),
    });
    res.json({ ads });
  } catch (err) { next(err); }
}

async function impression(req, res, next) {
  try {
    await adService.recordImpression(req.params.id, {
      userId:    req.auth?.sub,
      ip:        req.ip,
      ua:        req.headers['user-agent'],
      placement: req.body?.placement,
      meta:      req.body?.meta,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function click(req, res, next) {
  try {
    const result = await adService.recordClick(req.params.id, {
      userId:    req.auth?.sub,
      ip:        req.ip,
      ua:        req.headers['user-agent'],
      placement: req.body?.placement,
      meta:      req.body?.meta,
    });
    res.json(result);
  } catch (err) { next(err); }
}

// ─── Self-serve advertiser (event_partner) ────────────────────────────────────

async function myList(req, res, next) {
  try {
    const result = await adService.advertiserList(req.auth.sub, {
      page: Number(req.query.page) || 1,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function myCreate(req, res, next) {
  try {
    const advertiser = {
      id:   req.auth.sub,
      kind: req.auth.role === 'event_partner' ? 'event_partner' : 'external',
      name: req.body._advertiserName || '',
    };
    delete req.body._advertiserName;
    const ad = await adService.advertiserCreate(req.body, advertiser);
    res.status(201).json({ ad });
  } catch (err) { next(err); }
}

async function myUpdate(req, res, next) {
  try {
    const ad = await adService.advertiserUpdate(req.params.id, req.auth.sub, req.body);
    if (!ad) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ad });
  } catch (err) { next(err); }
}

async function myAnalytics(req, res, next) {
  try {
    const ad = await require('./ad.model').findOne({ _id: req.params.id, 'advertiser.id': req.auth.sub }).lean();
    if (!ad) return res.status(404).json({ error: 'Campaign not found' });
    const analytics = await adService.getCampaignAnalytics(req.params.id, Number(req.query.days) || 7);
    res.json({ ad, analytics });
  } catch (err) { next(err); }
}

// ─── Advertiser wallet ────────────────────────────────────────────────────────

async function myWallet(req, res, next) {
  try {
    const wallet = await adService.getWallet(req.auth.sub);
    res.json({ wallet });
  } catch (err) { next(err); }
}

async function createTopUpOrder(req, res, next) {
  res.status(503).json({ error: 'Payment gateway coming soon', code: 'GATEWAY_UNAVAILABLE' });
}

async function verifyTopUp(req, res, next) {
  res.status(503).json({ error: 'Payment gateway coming soon', code: 'GATEWAY_UNAVAILABLE' });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function adminList(req, res, next) {
  try {
    const { status, audience, page = 1 } = req.query;
    const result = await adService.listAll({ status, audience, page: Number(page) });
    res.json(result);
  } catch (err) { next(err); }
}

async function adminCreate(req, res, next) {
  try {
    const ad = await adService.create({ ...req.body, createdBy: req.auth.sub, status: req.body.status || 'active' });
    res.status(201).json({ ad });
  } catch (err) { next(err); }
}

async function adminUpdate(req, res, next) {
  try {
    const ad = await adService.update(req.params.id, req.body);
    if (!ad) return res.status(404).json({ error: 'Not found' });
    // Bust cache on status change
    if (req.body.status) {
      const { redis } = require('../../config/redis');
      await redis.keys('ads:p:*').then(ks => ks.length && redis.del(...ks)).catch(() => {});
    }
    res.json({ ad });
  } catch (err) { next(err); }
}

async function adminDelete(req, res, next) {
  try {
    await adService.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function adminApprove(req, res, next) {
  try {
    const ad = await adService.adminApprove(req.params.id, req.auth.sub);
    if (!ad) return res.status(404).json({ error: 'Not found' });
    res.json({ ad });
  } catch (err) { next(err); }
}

async function adminReject(req, res, next) {
  try {
    const ad = await adService.adminReject(req.params.id, req.body.note || 'Rejected by admin');
    res.json({ ad });
  } catch (err) { next(err); }
}

async function adminCampaignAnalytics(req, res, next) {
  try {
    const analytics = await adService.getCampaignAnalytics(req.params.id, Number(req.query.days) || 7);
    res.json(analytics);
  } catch (err) { next(err); }
}

async function adminAllWallets(req, res, next) {
  try {
    const page  = Number(req.query.page) || 1;
    const limit = 20;
    const [wallets, total] = await Promise.all([
      AdWallet.find().sort({ lifetimeSpentPaise: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AdWallet.countDocuments(),
    ]);
    res.json({ wallets, total, page });
  } catch (err) { next(err); }
}

async function adminAdjustWallet(req, res, next) {
  try {
    const { advertiserId, amountPaise, note } = req.body;
    const wallet = await adService.topUpWallet({ advertiserId, amountPaise, ref: 'admin_adjustment' });
    res.json({ wallet });
  } catch (err) { next(err); }
}

module.exports = {
  // Public
  getActive, getByPlacement, impression, click,
  // Self-serve
  myList, myCreate, myUpdate, myAnalytics,
  myWallet, createTopUpOrder, verifyTopUp,
  // Admin
  adminList, adminCreate, adminUpdate, adminDelete,
  adminApprove, adminReject, adminCampaignAnalytics,
  adminAllWallets, adminAdjustWallet,
};
