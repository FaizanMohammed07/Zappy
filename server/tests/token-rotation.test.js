require('./env');
const { startMongo, stopMongo } = require('./helpers');
const { redis } = require('../src/config/redis');
const tokenService = require('../src/modules/auth/token.service');

beforeAll(async () => { await startMongo(); });
afterAll(async () => { await stopMongo(); });
beforeEach(async () => { await redis.flushall(); });

describe('refresh-token rotation + reuse detection', () => {
  const payload = { sub: 'user123', role: 'user', phone: '9999999999' };

  test('fresh login issues an access+refresh pair', async () => {
    const { accessToken, refreshToken } = await tokenService.issueTokenPair(payload);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    // Verify the family is stored
    const keys = await redis.keys('rt:user123:*');
    expect(keys).toHaveLength(1);
  });

  test('rotate issues a new pair and invalidates the old gen', async () => {
    const first = await tokenService.issueTokenPair(payload);
    const second = await tokenService.rotateTokenPair(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Presenting gen-0 again must now fail with RT_REUSE
    await expect(tokenService.rotateTokenPair(first.refreshToken)).rejects.toMatchObject({
      code: 'RT_REUSE',
    });
  });

  test('after reuse detection the whole family is revoked', async () => {
    const first = await tokenService.issueTokenPair(payload);
    await tokenService.rotateTokenPair(first.refreshToken); // rotate once
    try {
      await tokenService.rotateTokenPair(first.refreshToken); // reuse → triggers purge
    } catch { /* expected */ }

    // Even the new (legitimate) refresh token should now be useless
    const legitimate = await tokenService.issueTokenPair(payload); // fresh family
    expect(legitimate.refreshToken).toBeTruthy();
    const keys = await redis.keys('rt:user123:*');
    // Only the newly-issued family is present; the previous (now-revoked) family is gone
    expect(keys).toHaveLength(1);
  });

  test('revokeRefreshToken hard-kills the family', async () => {
    const { refreshToken } = await tokenService.issueTokenPair(payload);
    await tokenService.revokeRefreshToken(refreshToken);
    await expect(tokenService.rotateTokenPair(refreshToken)).rejects.toMatchObject({
      code: 'RT_REVOKED',
    });
  });
});
