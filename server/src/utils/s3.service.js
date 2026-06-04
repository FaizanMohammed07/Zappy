const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuid } = require('uuid');
const config = require('../config');

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Generates a presigned PUT URL — client uploads directly to S3, never streams through our API.
 * This is how you scale file uploads; never proxy binary data through Node.
 */
async function getUploadUrl({ folder, contentType, userId }) {
  const key = `${folder}/${userId}/${uuid()}`;
  const cmd = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
    ContentType: contentType,
  });
  try {
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    return { uploadUrl: url, key };
  } catch (err) {
    // S3/network down — surface a clear message instead of a 500 (#93)
    throw Object.assign(
      new Error('File upload service is temporarily unavailable. Please try again in a moment.'),
      { status: 503, code: 'S3_UNAVAILABLE', cause: err.message }
    );
  }
}

async function getDownloadUrl(key, expiresIn = 300) {
  const filename = key.split('/').pop();
  const cmd = new GetObjectCommand({
    Bucket: config.aws.bucket,
    Key:    key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType:        'application/octet-stream',
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

/**
 * Streams an S3 object directly to an HTTP response.
 * Used for admin KYC document viewing — no presigned URL, no expiry.
 * The document stays accessible as long as it exists in S3 (forever).
 * Bucket stays fully private; our server is the authenticated gateway.
 */
async function streamToResponse(key, res) {
  const cmd = new GetObjectCommand({ Bucket: config.aws.bucket, Key: key });
  const obj = await s3.send(cmd);

  // Detect content type from key extension; default jpeg for photos
  const ext = key.split('.').pop()?.toLowerCase();
  const contentType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' }[ext] ?? 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=86400'); // browser caches for 24h — admin session
  if (obj.ContentLength) res.setHeader('Content-Length', obj.ContentLength);

  // AWS SDK v3 returns a ReadableStream — pipe it directly
  obj.Body.pipe(res);
}

async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: key }));
}

module.exports = { getUploadUrl, getDownloadUrl, streamToResponse, deleteObject };
