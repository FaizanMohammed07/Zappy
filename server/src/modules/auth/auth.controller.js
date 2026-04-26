const authService = require('./auth.service');
const config = require('../../config');

async function requestOtp(req, res, next) {
  try {
    const otp = await authService.requestOtp(req.body.phone);
    res.json({ ok: true, ...(config.env !== 'production' ? { otp } : {}) });
  } catch (err) { next(err); }
}

async function loginUser(req, res, next) {
  try {
    const result = await authService.loginUserWithOtp(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function loginWorker(req, res, next) {
  try {
    const result = await authService.loginWorkerWithOtp(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function loginAdmin(req, res, next) {
  try {
    const result = await authService.loginAdmin({ ...req.body, ip: req.ip });
    res.json(result);
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    await authService.revoke(req.body.refreshToken);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { requestOtp, loginUser, loginWorker, loginAdmin, refresh, logout };
