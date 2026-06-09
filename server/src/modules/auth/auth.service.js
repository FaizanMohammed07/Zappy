const bcrypt = require('bcryptjs');
const https = require('https');
const { redis } = require('../../config/redis');
const User = require('../user/user.model');
const Worker = require('../worker/worker.model');
const Admin = require('../admin/admin.model');
const EventPartner = require('../events/event-partner.model');
const tokenService = require('./token.service');
const logger = require('../../utils/logger');

// Reuse the existing Firebase Admin app (zappio-c80e2) for token verification
function getClientAuth() {
  const admin = require('firebase-admin');
  // Use default app if already initialized (by notifications.worker.js), else init minimal
  const app = admin.apps.find(a => a.name === '[DEFAULT]') ||
    admin.initializeApp({ projectId: 'zappio-c80e2' });
  return app;
}

// ---- SMS delivery ----
async function sendSms(phone, otp) {
  const fast2smsKey = process.env.FAST2SMS_KEY;
  const factor2Key  = process.env.SMS_2FACTOR_KEY;
  const msg91Key    = process.env.MSG91_AUTH_KEY;
  const mobile      = phone.startsWith('91') ? phone.slice(2) : phone; // Fast2SMS wants 10-digit
  const mobile91    = `91${mobile}`;                                    // 2Factor / MSG91 want 91XXXXXXXXXX

  // ── 1. Fast2SMS (primary for dev/testing — no DLT required) ──
  if (fast2smsKey) {
    try {
      await new Promise((resolve, reject) => {
        const params = new URLSearchParams({
          authorization: fast2smsKey,
          route: 'q',
          message: `Your Zappy OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
          flash: '0',
          numbers: mobile,
        });
        const url = `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`;
        https.get(url, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.return === true) resolve();
              else reject(new Error(`Fast2SMS: ${parsed.message}`));
            } catch { reject(new Error(`Fast2SMS bad response: ${data}`)); }
          });
        }).on('error', reject);
      });
      logger.info(`OTP sent via Fast2SMS to ${mobile}`);
      return;
    } catch (err) {
      logger.warn(`Fast2SMS failed: ${err.message} — trying next provider`);
    }
  }

  // ── 2. 2Factor.in (Indian DLT-compliant, production primary) ──
  if (factor2Key) {
    try {
      await new Promise((resolve, reject) => {
        const url = `https://2factor.in/API/V1/${factor2Key}/SMS/${mobile91}/${otp}/OTP1`;
        https.get(url, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.Status === 'Success') resolve();
              else reject(new Error(`2Factor: ${parsed.Details}`));
            } catch { reject(new Error(`2Factor bad response: ${data}`)); }
          });
        }).on('error', reject);
      });
      logger.info(`OTP sent via 2Factor to ${mobile91}`);
      return;
    } catch (err) {
      logger.warn(`2Factor failed: ${err.message} — trying MSG91`);
    }
  }

  // ── 3. MSG91 (backup — requires DLT registration in production) ──
  if (msg91Key) {
    try {
      await new Promise((resolve, reject) => {
        const params = new URLSearchParams({
          authkey: msg91Key,
          mobiles: mobile91,
          message: `Your Zappy OTP is ${otp}. Valid for 5 minutes. Do not share.`,
          sender: process.env.MSG91_SENDER_ID || 'ZAPPYO',
          route: '4',
          country: '91',
        });
        const url = `https://api.msg91.com/api/sendhttp.php?${params.toString()}`;
        https.get(url, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            logger.info(`MSG91 response: ${data}`);
            // MSG91 always returns 200; success body starts with a numeric request ID
            if (/^\d+/.test(data.trim())) resolve();
            else reject(new Error(`MSG91: ${data}`));
          });
        }).on('error', reject);
      });
      logger.info(`OTP sent via MSG91 to ${mobile91}`);
      return;
    } catch (err) {
      logger.warn(`MSG91 failed: ${err.message} — falling back to console`);
    }
  }

  // ── 4. Dev fallback ──
  logger.warn(`[DEV] OTP for ${mobile}: ${otp}`);
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, 12);
}
async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

// ---- OTP (phone-based) ----
async function requestOtp(phone, role) {
  // Prevent OTP flooding — at most 3 OTPs per phone per 10 min
  const floodKey = `otp:flood:${phone}`;
  const count = await redis.incr(floodKey);
  if (count === 1) await redis.expire(floodKey, 600);
  if (count > 3) {
    throw Object.assign(new Error('Too many OTP requests, try again in a few minutes'), {
      status: 429, code: 'OTP_FLOOD',
    });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Store OTP + failed attempt counter in a hash so we can lock out brute-force
  // without two separate Redis keys. TTL = 5 min.
  await redis.hset(`otp:${phone}`, 'code', otp, 'attempts', '0');
  await redis.expire(`otp:${phone}`, 300);

  await sendSms(phone, otp);

  // Tell the client whether this is a new account so it can skip registration fields
  let isNewUser = true;
  if (role === 'worker') {
    const existing = await Worker.findOne({ phone }).select('_id').lean();
    isNewUser = !existing;
  } else if (role === 'user') {
    const existing = await User.findOne({ phone }).select('_id').lean();
    isNewUser = !existing;
  }

  return { otp, isNewUser };
}

async function verifyOtp(phone, otp) {
  const data = await redis.hgetall(`otp:${phone}`);
  if (!data || !data.code) return false;

  // Brute-force lockout: max 5 wrong attempts before the OTP is invalidated.
  const attempts = parseInt(data.attempts || '0', 10);
  if (attempts >= 5) {
    await redis.del(`otp:${phone}`);
    return false;
  }

  if (data.code !== otp) {
    await redis.hincrby(`otp:${phone}`, 'attempts', 1);
    return false;
  }

  await redis.del(`otp:${phone}`);
  return true;
}

/**
 * Mark a user as having recently verified their OTP for sensitive actions.
 * Expires after 10 minutes — caller must call this after a successful OTP verify.
 */
async function markOtpActionVerified(userId) {
  await redis.setex(`otp_action:${userId}`, 600, '1');
}

async function loginUserWithOtp({ phone, otp, name }) {
  const ok = await verifyOtp(phone, otp);
  if (!ok) throw Object.assign(new Error('Invalid OTP'), { status: 401, code: 'OTP_INVALID' });

  let user = await User.findOne({ phone });
  if (!user) user = await User.create({ phone, name });
  if (user.isBlocked) {
    throw Object.assign(new Error('Account is blocked'), { status: 403, code: 'ACCOUNT_BLOCKED' });
  }

  const tokens = await tokenService.issueTokenPair({
    sub: user._id.toString(), role: 'user', phone: user.phone,
  });
  return { user, ...tokens };
}

// Max distinct worker accounts allowed per device fingerprint in a 30-day window.
const MAX_WORKERS_PER_DEVICE = 2; // Allow 2 (lost phone re-registration edge case)

async function loginWorkerWithOtp({ phone, otp, name, skills, deviceId }) {
  const ok = await verifyOtp(phone, otp);
  if (!ok) throw Object.assign(new Error('Invalid OTP'), { status: 401, code: 'OTP_INVALID' });

  let worker = await Worker.findOne({ phone });
  const isNewWorker = !worker;

  if (isNewWorker) {
    if (!name || !skills?.length) {
      throw Object.assign(new Error('First-time login requires name and skills'), {
        status: 400, code: 'WORKER_ONBOARDING_REQUIRED',
      });
    }

    // Device fingerprint check — detect one phone creating many worker accounts.
    // Uses a Redis set: key = device fingerprint, members = worker phone numbers
    // that registered from this device in the last 30 days.
    if (deviceId) {
      const deviceKey = `worker:device:${deviceId}`;
      const registeredPhones = await redis.smembers(deviceKey);
      if (registeredPhones.length >= MAX_WORKERS_PER_DEVICE && !registeredPhones.includes(phone)) {
        logger.warn({ deviceId, existingPhones: registeredPhones, newPhone: phone },
          '[FRAUD] Device fingerprint: too many worker registrations from same device');
        throw Object.assign(
          new Error('This device has already been used to register multiple worker accounts. Contact support.'),
          { status: 429, code: 'DEVICE_MULTI_ACCOUNT' }
        );
      }
      // Record this phone against the device fingerprint (30-day window)
      await redis.multi()
        .sadd(deviceKey, phone)
        .expire(deviceKey, 30 * 86400)
        .exec();
    }

    worker = await Worker.create({ phone, name, skills });
  }

  if (worker.isBlocked) {
    throw Object.assign(new Error('Account is blocked'), { status: 403, code: 'ACCOUNT_BLOCKED' });
  }

  // Store device fingerprint on the worker record for KYC cross-reference
  if (deviceId && isNewWorker) {
    Worker.updateOne({ _id: worker._id }, { $addToSet: { deviceIds: deviceId } }).catch(() => {});
  }

  const tokens = await tokenService.issueTokenPair({
    sub: worker._id.toString(), role: 'worker', phone: worker.phone,
  });
  return { worker, ...tokens };
}

// ---- Event Partner (phone OTP) — self-registration allowed, admin approves KYC ----
async function loginEventPartnerWithOtp({ phone, otp, businessName, ownerName, cities }) {
  const ok = await verifyOtp(phone, otp);
  if (!ok) throw Object.assign(new Error('Invalid OTP'), { status: 401, code: 'OTP_INVALID' });

  const EventPartner = require('../events/event-partner.model');
  let partner = await EventPartner.findOne({ phone });
  const isNew = !partner;

  if (isNew) {
    if (!businessName || !ownerName) {
      throw Object.assign(
        new Error('First-time registration requires businessName and ownerName'),
        { status: 400, code: 'PARTNER_ONBOARDING_REQUIRED' }
      );
    }
    partner = await EventPartner.create({
      phone, businessName, ownerName,
      cities: Array.isArray(cities) ? cities : (cities || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      isActive: true,
      kyc: { status: 'not_submitted' },
    });
    logger.info({ partnerId: partner._id, phone }, '[AUTH] New event partner self-registered');
  }

  if (partner.isBlocked) {
    throw Object.assign(new Error('Partner account is blocked. Contact support.'), { status: 403, code: 'ACCOUNT_BLOCKED' });
  }

  const tokens = await tokenService.issueTokenPair({
    sub: partner._id.toString(), role: 'event_partner', phone: partner.phone,
  });
  return { partner, isNew, ...tokens };
}

// ---- Admin (email + password) with lockout ----
async function loginAdmin({ email, password, ip }) {
  const failKey = `admin:fail:${email}`;
  const fails = Number(await redis.get(failKey)) || 0;
  if (fails >= 10) {
    throw Object.assign(new Error('Account temporarily locked'), {
      status: 429, code: 'ADMIN_LOCKED',
    });
  }

  const admin = await Admin.findOne({ email }).select('+passwordHash');
  if (!admin || !admin.isActive) {
    await redis.incr(failKey);
    await redis.expire(failKey, 900);
    throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'ADMIN_INVALID' });
  }

  const ok = await comparePassword(password, admin.passwordHash);
  if (!ok) {
    await redis.incr(failKey);
    await redis.expire(failKey, 900);
    throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'ADMIN_INVALID' });
  }

  await redis.del(failKey);
  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ip;
  await admin.save();

  const tokens = await tokenService.issueTokenPair({
    sub: admin._id.toString(), role: 'admin', email: admin.email,
  });
  return {
    admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    ...tokens,
  };
}

// ---- Event Partner — Google OAuth login/register ----
async function loginPartnerWithGoogle({ idToken, businessName, ownerName, cities }) {
  const adminApp = getClientAuth();
  let decoded;
  try {
    decoded = await adminApp.auth().verifyIdToken(idToken);
  } catch (err) {
    throw Object.assign(new Error('Invalid Google token'), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });
  }

  const { uid: googleId, email, name: googleName, picture } = decoded;
  if (!email) throw Object.assign(new Error('Google account has no email'), { status: 400, code: 'NO_EMAIL' });

  // Find by googleId first, then fall back to email
  let partner = await EventPartner.findOne({ $or: [{ googleId }, { email }] });
  const isNew = !partner;

  if (isNew) {
    if (!businessName || !ownerName) {
      // Return signal to frontend to collect registration details
      return { needsRegistration: true, googleId, email, suggestedName: googleName };
    }
    const cityList = typeof cities === 'string'
      ? cities.split(',').map(c => c.trim()).filter(Boolean)
      : (cities || []);
    partner = await EventPartner.create({ googleId, email, businessName, ownerName, cities: cityList });
  } else if (!partner.googleId) {
    partner.googleId = googleId;
    if (!partner.email) partner.email = email;
    await partner.save();
  }

  if (partner.isBlocked) throw Object.assign(new Error('Account suspended'), { status: 403, code: 'ACCOUNT_BLOCKED' });

  const tokens = await tokenService.issueTokenPair({ sub: partner._id, role: 'event_partner', email: partner.email });
  return { partner, isNew, ...tokens };
}

module.exports = {
  hashPassword,
  comparePassword,
  requestOtp,
  verifyOtp,
  markOtpActionVerified,
  loginUserWithOtp,
  loginWorkerWithOtp,
  loginEventPartnerWithOtp,
  loginPartnerWithGoogle,
  loginAdmin,
  refresh: tokenService.rotateTokenPair,
  revoke: tokenService.revokeRefreshToken,
  revokeAll: tokenService.revokeAllForUser,
  verifyToken: tokenService.verifyAccessToken,
  signToken: tokenService.signAccessToken,
};
