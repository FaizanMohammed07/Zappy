const authService = require('./auth.service');
const config = require('../../config');

// Refresh token cookie settings.
// httpOnly   — JS cannot read it (defeats XSS token theft). (#78)
// secure     — HTTPS only in production.
// sameSite   — Strict: never sent cross-origin (CSRF protection).
// path       — only sent to /api/auth/* endpoints, not every request.
const RT_COOKIE_NAME = 'zappy_rt';
const RT_COOKIE_OPTS = {
  httpOnly: true,
  secure:   config.env === 'production',
  sameSite: 'strict',
  path:     '/api/auth',
  maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days in ms — matches RT_EXPIRES_SEC
};

function setRtCookie(res, refreshToken) {
  res.cookie(RT_COOKIE_NAME, refreshToken, RT_COOKIE_OPTS);
}
function clearRtCookie(res) {
  res.clearCookie(RT_COOKIE_NAME, { ...RT_COOKIE_OPTS, maxAge: 0 });
}

async function requestOtp(req, res, next) {
  try {
    const { phone, role } = req.body;
    const { otp, isNewUser } = await authService.requestOtp(phone, role);
    res.json({ ok: true, isNewUser, ...(config.env !== 'production' && otp ? { otp } : {}) });
  } catch (err) { next(err); }
}

async function resendOtp(req, res, next) {
  try {
    const { phone } = req.body;
    const { otp } = await authService.resendOtp(phone);
    res.json({ ok: true, ...(config.env !== 'production' && otp ? { otp } : {}) });
  } catch (err) { next(err); }
}

async function loginUser(req, res, next) {
  try {
    const result = await authService.loginUserWithOtp(req.body);
    setRtCookie(res, result.refreshToken);
    // Return accessToken in body; refreshToken via httpOnly cookie only.
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) { next(err); }
}

async function loginWorker(req, res, next) {
  try {
    const result = await authService.loginWorkerWithOtp(req.body);
    setRtCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, worker: result.worker });
  } catch (err) { next(err); }
}

async function loginPartner(req, res, next) {
  try {
    const result = await authService.loginEventPartnerWithOtp(req.body);
    setRtCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, partner: result.partner });
  } catch (err) { next(err); }
}

async function googlePartnerLogin(req, res, next) {
  try {
    const result = await authService.loginPartnerWithGoogle(req.body);
    if (result.needsRegistration) {
      return res.json({ needsRegistration: true, googleId: result.googleId, email: result.email, suggestedName: result.suggestedName });
    }
    setRtCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, partner: result.partner, isNew: result.isNew });
  } catch (err) { next(err); }
}

async function loginAdmin(req, res, next) {
  const auditService = require('../admin/audit.service');
  try {
    const result = await authService.loginAdmin({ ...req.body, ip: req.ip });
    // Audit every successful admin login — required for compliance + intrusion detection. (#79)
    auditService.log('admin.login_success', {
      adminId: result.admin?._id,
      email:   req.body.email,
      ip:      req.ip,
      ua:      req.headers['user-agent'],
    }).catch(() => {});
    setRtCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, admin: result.admin });
  } catch (err) {
    // Audit failed attempts too — detects credential stuffing. (#79)
    auditService.log('admin.login_failure', {
      email: req.body?.email,
      ip:    req.ip,
      ua:    req.headers['user-agent'],
      code:  err.code,
    }).catch(() => {});
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    // Prefer cookie (new clients); fall back to body for backward-compat.
    const rt = req.cookies?.[RT_COOKIE_NAME] || req.body?.refreshToken;
    if (!rt) {
      return res.status(401).json({ error: 'No refresh token', code: 'RT_MISSING' });
    }
    const tokens = await authService.refresh(rt);
    setRtCookie(res, tokens.refreshToken);
    // Include role so clients can fully restore session without sessionStorage.
    res.json({ accessToken: tokens.accessToken, role: tokens.role });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const rt = req.cookies?.[RT_COOKIE_NAME] || req.body?.refreshToken;
    if (rt) await authService.revoke(rt).catch(() => {});
    clearRtCookie(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/**
 * Revoke ALL sessions for the authenticated user across every device.
 * Requires a valid access token — this is the "sign out everywhere" button.
 */
async function revokeAll(req, res, next) {
  try {
    const { sub } = req.auth;
    const count = await authService.revokeAll(sub);
    clearRtCookie(res);
    res.json({ ok: true, sessionsRevoked: count });
  } catch (err) { next(err); }
}

/**
 * Re-verify OTP for sensitive actions (payout, bank changes).
 * The OTP must have been requested via /otp/request for the authenticated user's phone.
 * On success sets a 10-minute Redis flag — subsequent sensitive requests are allowed.
 */
async function verifySensitiveOtp(req, res, next) {
  try {
    const { otp } = req.body;
    const { sub, role, phone } = req.auth;
    if (!phone) return res.status(400).json({ error: 'No phone on session', code: 'NO_PHONE' });

    const ok = await authService.verifyOtp(phone, otp);
    if (!ok) return res.status(401).json({ error: 'Invalid OTP', code: 'OTP_INVALID' });

    await authService.markOtpActionVerified(sub);
    res.json({ ok: true, expiresIn: 600 });
  } catch (err) { next(err); }
}

module.exports = {
  requestOtp, resendOtp, loginUser, loginWorker, loginPartner, googlePartnerLogin,
  loginAdmin, refresh, logout, revokeAll, verifySensitiveOtp,
};
