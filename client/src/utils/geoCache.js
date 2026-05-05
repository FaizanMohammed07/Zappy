const KEY = 'zappy:loc';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function saveGeoLocation({ lat, lng, accuracy }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lat, lng, accuracy, t: Date.now() }));
  } catch {}
}

export function loadGeoLocation() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || Date.now() - d.t > MAX_AGE_MS) return null;
    return { lat: d.lat, lng: d.lng, accuracy: d.accuracy ?? null };
  } catch { return null; }
}
