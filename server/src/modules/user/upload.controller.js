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

async function download(req, res, next) {
  try {
    const url = await s3Service.getDownloadUrl(req.params.key);
    res.json({ url });
  } catch (err) { next(err); }
}

module.exports = { presign, download };
