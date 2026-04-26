/**
 * Token Service
 * ----------------------------------------------------------------------------
 * Two-token authentication:
 *   - Access token: short-lived (15 min), stateless JWT
 *   - Refresh token: long-lived (30 d), stateful (Redis), rotates on use
 *
 * Rotation + reuse detection:
 *   Refresh tokens have a "family" ID and a monotonically-incrementing generation.
 *   On /auth/refresh:
 *     - Load stored family by (userId, familyId)
 *     - If presented gen !== stored currentGen → TOKEN REUSE, revoke entire family
 *     - Else rotate: currentGen++, issue new RT with new gen, return new AT+RT pair
 *
 * This detects stolen-but-not-yet-used refresh tokens. The attacker and the real
 * user cannot both have the current gen; whichever refreshes second gets killed.
 * ----------------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const AT_EXPIRES = '15m';
const RT_EXPIRES_SEC = 60 * 60 * 24 * 30; // 30 days

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: AT_EXPIRES });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

function familyKey(userId, family) {
  return `rt:${userId}:${family}`;
}

/**
 * Issue a NEW token pair (fresh login).
 */
async function issueTokenPair({ sub, role, phone, email }) {
  const family = crypto.randomBytes(8).toString('hex');
  const gen = 0;
  const tokenId = crypto.randomBytes(16).toString('hex');

  const accessToken = signAccessToken({ sub, role, phone, email });
  const refreshToken = jwt.sign(
    { sub, role, family, gen, jti: tokenId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: RT_EXPIRES_SEC }
  );

  await redis.setex(
    familyKey(sub, family),
    RT_EXPIRES_SEC,
    JSON.stringify({ currentGen: gen, sub, role })
  );

  return { accessToken, refreshToken };
}

/**
 * Rotate: verify the presented RT, ensure it's the current gen of its family,
 * issue a new pair with gen+1, invalidate the old one.
 */
async function rotateTokenPair(presentedRefreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(presentedRefreshToken, config.jwt.secret);
  } catch (err) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401, code: 'RT_INVALID' });
  }
  if (decoded.type !== 'refresh') {
    throw Object.assign(new Error('Not a refresh token'), { status: 401, code: 'RT_WRONG_TYPE' });
  }

  const { sub, family, gen, role } = decoded;
  const raw = await redis.get(familyKey(sub, family));
  if (!raw) {
    throw Object.assign(new Error('Refresh family revoked'), { status: 401, code: 'RT_REVOKED' });
  }
  const stored = JSON.parse(raw);

  if (stored.currentGen !== gen) {
    // REUSE DETECTED — either this RT was already rotated (attacker) or a
    // legitimate client retried. Safest action: burn the family down.
    logger.warn({ sub, family, presentedGen: gen, currentGen: stored.currentGen }, 'RT reuse detected — revoking family');
    await redis.del(familyKey(sub, family));
    throw Object.assign(new Error('Token reuse detected — please log in again'), {
      status: 401,
      code: 'RT_REUSE',
    });
  }

  const newGen = gen + 1;
  const newTokenId = crypto.randomBytes(16).toString('hex');
  const accessToken = signAccessToken({ sub, role, phone: decoded.phone, email: decoded.email });
  const refreshToken = jwt.sign(
    { sub, role, family, gen: newGen, jti: newTokenId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: RT_EXPIRES_SEC }
  );

  await redis.setex(
    familyKey(sub, family),
    RT_EXPIRES_SEC,
    JSON.stringify({ currentGen: newGen, sub, role })
  );

  return { accessToken, refreshToken };
}

/**
 * Explicit logout — revoke the family.
 */
async function revokeRefreshToken(presentedRefreshToken) {
  try {
    const decoded = jwt.verify(presentedRefreshToken, config.jwt.secret);
    await redis.del(familyKey(decoded.sub, decoded.family));
  } catch {
    /* swallow — logout must succeed even with bad tokens */
  }
}

/**
 * "Log out everywhere" — finds & deletes all families for this user.
 */
async function revokeAllForUser(userId) {
  const stream = redis.scanStream({ match: `rt:${userId}:*`, count: 100 });
  const keys = [];
  for await (const batch of stream) keys.push(...batch);
  if (keys.length) await redis.del(...keys);
  return keys.length;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  rotateTokenPair,
  revokeRefreshToken,
  revokeAllForUser,
};
