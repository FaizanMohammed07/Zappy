const bcrypt = require('bcryptjs');
const { redis } = require('../../config/redis');
const User = require('../user/user.model');
const Worker = require('../worker/worker.model');
const Admin = require('../admin/admin.model');
const tokenService = require('./token.service');
const logger = require('../../utils/logger');

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

module.exports = {
  hashPassword,
  comparePassword,
  requestOtp,
  verifyOtp,
  loginUserWithOtp,
  loginWorkerWithOtp,
  loginEventPartnerWithOtp,
  loginAdmin,
  refresh: tokenService.rotateTokenPair,
  revoke: tokenService.revokeRefreshToken,
  revokeAll: tokenService.revokeAllForUser,
  verifyToken: tokenService.verifyAccessToken,
  signToken: tokenService.signAccessToken,
};
