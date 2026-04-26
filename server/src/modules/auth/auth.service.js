const bcrypt = require('bcryptjs');
const { redis } = require('../../config/redis');
const User = require('../user/user.model');
const Worker = require('../worker/worker.model');
const Admin = require('../admin/admin.model');
const tokenService = require('./token.service');

async function hashPassword(pw) {
  return bcrypt.hash(pw, 12);
}
async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

// ---- OTP (phone-based) ----
async function requestOtp(phone) {
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
  await redis.setex(`otp:${phone}`, 300, otp);
  return otp;
}

async function verifyOtp(phone, otp) {
  const stored = await redis.get(`otp:${phone}`);
  if (!stored || stored !== otp) return false;
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

async function loginWorkerWithOtp({ phone, otp, name, skills }) {
  const ok = await verifyOtp(phone, otp);
  if (!ok) throw Object.assign(new Error('Invalid OTP'), { status: 401, code: 'OTP_INVALID' });

  let worker = await Worker.findOne({ phone });
  if (!worker) {
    if (!name || !skills?.length) {
      throw Object.assign(new Error('First-time login requires name and skills'), {
        status: 400, code: 'WORKER_ONBOARDING_REQUIRED',
      });
    }
    worker = await Worker.create({ phone, name, skills });
  }
  if (worker.isBlocked) {
    throw Object.assign(new Error('Account is blocked'), { status: 403, code: 'ACCOUNT_BLOCKED' });
  }

  const tokens = await tokenService.issueTokenPair({
    sub: worker._id.toString(), role: 'worker', phone: worker.phone,
  });
  return { worker, ...tokens };
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
  loginAdmin,
  refresh: tokenService.rotateTokenPair,
  revoke: tokenService.revokeRefreshToken,
  revokeAll: tokenService.revokeAllForUser,
  verifyToken: tokenService.verifyAccessToken,
  signToken: tokenService.signAccessToken,
};
