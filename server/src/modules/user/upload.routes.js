const express = require('express');
const Joi = require('joi');
const ctrl = require('./upload.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

// Content-type → allowed file extensions whitelist. (#80)
// An attacker can't presign a PHP shell as image/jpeg if the filename
// extension is also validated. Both must match.
const CONTENT_TYPE_EXTS = {
  'image/jpeg':       ['.jpg', '.jpeg'],
  'image/jpg':        ['.jpg', '.jpeg'],
  'image/png':        ['.png'],
  'image/webp':       ['.webp'],
  'image/heic':       ['.heic'],
  'application/pdf':  ['.pdf'],
  // Audio — voice tip notes recorded in-browser
  'audio/webm':       ['.webm'],
  'audio/mp4':        ['.mp4', '.m4a'],
  'audio/ogg':        ['.ogg', '.oga'],
};

// Audio content types skip the extension check (browser blobs have no extension)
const AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/ogg']);

router.post(
  '/presign',
  authenticate,
  validate(Joi.object({
    folder: Joi.string().valid(
      'kyc', 'kyc-docs', 'profile', 'order-proof', 'vehicle-health',
      'completion-photos', 'order-images', 'voice-tips', 'event-photos'
    ).required(),
    contentType: Joi.string().valid(...Object.keys(CONTENT_TYPE_EXTS)).required(),
    // Optional original filename — used for extension validation only; never stored.
    filename: Joi.string().max(260).optional().allow('', null),
  })),
  (req, res, next) => {
    const { filename, contentType } = req.body;
    // Audio blobs recorded in-browser have no filename — skip extension check.
    if (filename && !AUDIO_TYPES.has(contentType)) {
      const ext = ('.' + filename.split('.').pop()).toLowerCase();
      const allowed = CONTENT_TYPE_EXTS[contentType] || [];
      if (!allowed.includes(ext)) {
        return res.status(400).json({
          error: `File extension "${ext}" does not match content type "${contentType}"`,
          code: 'EXTENSION_MISMATCH',
        });
      }
    }
    next();
  },
  ctrl.presign
);

router.get('/download/:key(*)', authenticate, ctrl.download);

module.exports = router;
