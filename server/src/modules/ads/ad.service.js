const Ad = require('./ad.model');

/** Return ads visible to the audience right now, within schedule + budget. */
async function getActiveAds({ audience, limit = 10 }) {
  const now = new Date();
  const audienceFilter = audience === 'users'
    ? { audience: { $in: ['users', 'both'] } }
    : audience === 'workers'
    ? { audience: { $in: ['workers', 'both'] } }
    : {};

  const ads = await Ad.find({
    ...audienceFilter,
    status: 'active',
    'schedule.startAt': { $lte: now },
    'schedule.endAt':   { $gte: now },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Filter out ads that have hit their impressions limit
  return ads.filter((ad) => {
    if (!ad.schedule.impressionsLimit) return true;
    return ad.stats.impressions < ad.schedule.impressionsLimit;
  });
}

async function recordImpression(adId) {
  await Ad.updateOne({ _id: adId }, { $inc: { 'stats.impressions': 1 } });
  await _maybeCompleteCPM(adId);
}

async function recordClick(adId) {
  const ad = await Ad.findByIdAndUpdate(
    adId,
    { $inc: { 'stats.clicks': 1 } },
    { new: true }
  );
  if (ad?.billing?.model === 'cpc' && ad.billing.rate > 0) {
    await Ad.updateOne({ _id: adId }, { $inc: { 'stats.spend': ad.billing.rate } });
  }
  await _checkBudget(adId);
  return ad;
}

async function _maybeCompleteCPM(adId) {
  const ad = await Ad.findById(adId).lean();
  if (!ad) return;
  if (ad.billing.model === 'cpm' && ad.billing.rate > 0) {
    const spend = Math.floor(ad.stats.impressions / 1000) * ad.billing.rate;
    await Ad.updateOne({ _id: adId }, { $set: { 'stats.spend': spend } });
  }
  await _checkBudget(adId);
}

async function _checkBudget(adId) {
  const ad = await Ad.findById(adId).lean();
  if (!ad) return;
  if (ad.billing.budget > 0 && ad.stats.spend >= ad.billing.budget) {
    await Ad.updateOne({ _id: adId }, { $set: { status: 'completed' } });
  }
}

// Admin CRUD

async function listAll({ status, audience, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;
  if (audience) filter.audience = audience;
  const [ads, total] = await Promise.all([
    Ad.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ad.countDocuments(filter),
  ]);
  return { ads, total, totalPages: Math.ceil(total / limit), page };
}

async function create(data) {
  return Ad.create(data);
}

async function update(id, patch) {
  return Ad.findByIdAndUpdate(id, { $set: patch }, { new: true });
}

async function remove(id) {
  return Ad.findByIdAndDelete(id);
}

// Auto-complete ads past their end date — call from a cron or on startup
async function sweepExpired() {
  const result = await Ad.updateMany(
    { status: 'active', 'schedule.endAt': { $lt: new Date() } },
    { $set: { status: 'completed' } }
  );
  return result.modifiedCount;
}

module.exports = { getActiveAds, recordImpression, recordClick, listAll, create, update, remove, sweepExpired };
