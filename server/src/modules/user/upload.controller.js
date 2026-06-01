const s3Service = require('../../utils/s3.service');

async function presign(req, res, next) {
  try {
    const result = await s3Service.getUploadUrl({
      folder: req.body.folder,
      contentType: req.body.contentType,
      userId: req.auth.sub,
    });
    res.json(result);
  } catch (err) { next(err); }
}

const ALLOWED_FOLDERS = new Set(['kyc', 'profile', 'order-proof', 'vehicle-health', 'completion-photos']);

async function download(req, res, next) {
  try {
    const key = req.params.key;
    const folder = key.split('/')[0];
    // Block path traversal and access to unlisted folders
    if (!ALLOWED_FOLDERS.has(folder) || key.includes('..') || key.startsWith('/')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const url = await s3Service.getDownloadUrl(key);
    res.json({ url });
  } catch (err) { next(err); }
}

module.exports = { presign, download };
