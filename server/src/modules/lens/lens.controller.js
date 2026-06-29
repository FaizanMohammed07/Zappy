const lensService = require('./lens.service');

async function getUploadUrl(req, res, next) {
  try {
    const { contentType } = req.body;
    const target = await lensService.getUploadTarget({ userId: req.auth.sub, contentType });
    res.json(target); // { uploadUrl, key }
  } catch (err) { next(err); }
}

async function analyze(req, res, next) {
  try {
    const { imageKeys, lat, lng } = req.body;
    // Defence-in-depth: only let a user analyze keys under their own lens/ prefix.
    const ownPrefix = `lens/${req.auth.sub}/`;
    if (!imageKeys.every((k) => typeof k === 'string' && k.startsWith(ownPrefix))) {
      return res.status(403).json({ error: 'Invalid image reference' });
    }
    const location = (lat != null && lng != null) ? { lat: Number(lat), lng: Number(lng) } : null;
    const result = await lensService.analyze({ userId: req.auth.sub, imageKeys, location });
    res.json(result);
  } catch (err) { next(err); }
}

async function getScan(req, res, next) {
  try {
    const scan = await lensService.getScan({ scanId: req.params.id, userId: req.auth.sub });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    res.json({ scan });
  } catch (err) { next(err); }
}

module.exports = { getUploadUrl, analyze, getScan };
