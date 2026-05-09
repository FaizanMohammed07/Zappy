const adService = require('./ad.service');

async function getActive(req, res, next) {
  try {
    const audience = req.auth?.role === 'worker' ? 'workers' : 'users';
    const ads = await adService.getActiveAds({ audience, limit: 8 });
    res.json({ ads });
  } catch (err) { next(err); }
}

async function impression(req, res, next) {
  try {
    await adService.recordImpression(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function click(req, res, next) {
  try {
    await adService.recordClick(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// Admin
async function adminList(req, res, next) {
  try {
    const { status, audience, page = 1 } = req.query;
    const result = await adService.listAll({ status, audience, page: Number(page) });
    res.json(result);
  } catch (err) { next(err); }
}

async function adminCreate(req, res, next) {
  try {
    const ad = await adService.create({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json({ ad });
  } catch (err) { next(err); }
}

async function adminUpdate(req, res, next) {
  try {
    const ad = await adService.update(req.params.id, req.body);
    if (!ad) return res.status(404).json({ error: 'Not found' });
    res.json({ ad });
  } catch (err) { next(err); }
}

async function adminDelete(req, res, next) {
  try {
    await adService.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { getActive, impression, click, adminList, adminCreate, adminUpdate, adminDelete };
