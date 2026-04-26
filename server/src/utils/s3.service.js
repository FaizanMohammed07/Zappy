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
  const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
  return { uploadUrl: url, key };
}

async function getDownloadUrl(key) {
  const cmd = new GetObjectCommand({ Bucket: config.aws.bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: key }));
}

module.exports = { getUploadUrl, getDownloadUrl, deleteObject };
