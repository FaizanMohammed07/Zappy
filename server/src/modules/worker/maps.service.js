const config = require('../../config');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const CACHE_TTL_SECONDS = 60 * 5; // 5 min — routes don't change fast.

function cacheKey(origin, dest) {
  const round = (n) => n.toFixed(4); // ~11m precision
  return `dm:${round(origin.lat)},${round(origin.lng)}:${round(dest.lat)},${round(dest.lng)}`;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Returns { distanceKm, etaMinutes, source }.
 * Strategy: Redis cache → Google Distance Matrix → Haversine fallback.
 */
async function getDistanceAndEta(origin, dest) {
  const key = cacheKey(origin, dest);
  const cached = await redis.get(key);
  if (cached) return { ...JSON.parse(cached), source: 'cache' };

  try {
    const url = new URL(DISTANCE_MATRIX_URL);
    url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destinations', `${dest.lat},${dest.lng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', config.googleMaps.key);

    const res = await fetch(url.toString());
    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    if (data.status === 'OK' && el?.status === 'OK') {
      const result = {
        distanceKm: el.distance.value / 1000,
        etaMinutes: Math.ceil(el.duration.value / 60),
      };
      await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(result));
      return { ...result, source: 'google' };
    }
    logger.warn({ status: data.status, el }, 'DistanceMatrix non-OK, using haversine');
  } catch (err) {
    logger.error({ err: err.message }, 'DistanceMatrix failed, using haversine');
  }

  // Graceful fallback — the order must not fail because of an API hiccup.
  const km = haversineKm(origin, dest);
  return { distanceKm: km, etaMinutes: Math.ceil((km / 25) * 60), source: 'haversine' };
}

async function reverseGeocode(lat, lng) {
  const key = `rg:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  try {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', config.googleMaps.key);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.status === 'OK' && data.results[0]) {
      const addr = data.results[0].formatted_address;
      await redis.setex(key, 60 * 60 * 24, addr);
      return addr;
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Reverse geocode failed');
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

module.exports = { getDistanceAndEta, reverseGeocode, haversineKm };
