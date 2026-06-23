const config = require('../../config');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Resolve { district, city, state, country } from coordinates.
 * Cached 48h in Redis keyed by 2-decimal bucket (matches geo-analytics precision,
 * keeps Google geocode calls cheap — one per ~1km cell per 48h).
 */
async function resolveGeo(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return {};
  const key = `geo-admin:${lat.toFixed(2)},${lng.toFixed(2)}`;
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* ignore cache read errors */ }

  let out = {};
  try {
    if (config.googleMaps?.key) {
      const url = new URL(GEOCODE_URL);
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', config.googleMaps.key);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length) {
        const comps = data.results[0].address_components || [];
        const pick = (type) => comps.find((c) => c.types.includes(type))?.long_name;
        out = {
          district: pick('administrative_area_level_3') || pick('administrative_area_level_2') || null,
          city:     pick('locality') || pick('administrative_area_level_2') || null,
          state:    pick('administrative_area_level_1') || null,
          country:  pick('country') || 'India',
        };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'telemetry resolveGeo failed');
  }

  try { await redis.setex(key, 60 * 60 * 48, JSON.stringify(out)); } catch (_) { /* ignore */ }
  return out;
}

/**
 * Minimal, dependency-free User-Agent parser — enough for analytics buckets.
 * Returns { device, browser, os }.
 */
function parseUA(ua = '') {
  const s = String(ua);
  if (!s) return { device: 'unknown', browser: 'unknown', os: 'unknown' };

  const isBot = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram/i.test(s);
  const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(s);
  const isMobile = /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(s);
  const device = isBot ? 'bot' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let os = 'unknown';
  if (/windows nt/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod|ios/i.test(s)) os = 'iOS';
  else if (/mac os x/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';

  let browser = 'unknown';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/safari/i.test(s)) browser = 'Safari';

  return { device, browser, os };
}

/**
 * Normalise a referrer URL to a host (or 'direct'). Treats our own origins as 'direct'.
 */
function normaliseReferrer(ref) {
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return host || 'direct';
  } catch (_) {
    return 'direct';
  }
}

module.exports = { resolveGeo, parseUA, normaliseReferrer };
