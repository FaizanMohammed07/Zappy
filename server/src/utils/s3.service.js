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

async function getDownloadUrl(key) {
  // Force Content-Disposition: attachment so browsers download rather than render. (#80)
  // This prevents a renamed-script-as-image from executing if somehow it gets uploaded.
  // ContentType override to application/octet-stream is the belt-and-suspenders guarantee.
  const filename = key.split('/').pop();
  const cmd = new GetObjectCommand({
    Bucket: config.aws.bucket,
    Key:    key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType:        'application/octet-stream',
  });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: key }));
}

module.exports = { getUploadUrl, getDownloadUrl, deleteObject };
