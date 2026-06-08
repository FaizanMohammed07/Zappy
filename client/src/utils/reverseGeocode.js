/**
 * Smart reverse geocoding: Mapbox first (best Indian accuracy),
 * Nominatim at zoom=18 as fallback with Indian-optimised field priority.
 *
 * Returns { primary, secondary } where:
 *   primary   — neighbourhood / locality (what locals call the area)
 *   secondary — "City, State" string
 */
export async function reverseGeocode(lat, lng) {
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  // 1. Mapbox — excellent Indian neighbourhood data
  if (MAPBOX_TOKEN) {
    try {
      const r = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${MAPBOX_TOKEN}&language=en&types=neighborhood,locality,place&limit=1`,
      );
      if (r.ok) {
        const d = await r.json();
        const feat = d.features?.[0];
        if (feat) {
          const ctx = feat.context || [];
          const get = (prefix) => ctx.find((c) => c.id?.startsWith(prefix))?.text ?? null;
          const primary =
            feat.place_type?.[0] === 'neighborhood' ? feat.text
              : get('neighborhood') || get('locality') || get('district') || feat.text;
          const city  = get('place') || get('district');
          const state = get('region');
          const secondary = [city, state].filter(Boolean).join(', ') || null;
          if (primary) return { primary, secondary };
        }
      }
    } catch { /* fall through */ }
  }

  // 2. Nominatim — zoom=18 street-level, Indian address field priority
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
      `&format=json&zoom=18&addressdetails=1&accept-language=en`,
      { headers: { 'Accept-Language': 'en' } },
    );
    if (r.ok) {
      const d = await r.json();
      const a = d.address || {};
      // Indian priority: quarter > neighbourhood > city_district > suburb > locality
      // Avoid bare village name when city context exists
      const primary =
        a.quarter || a.neighbourhood || a.city_district || a.suburb || a.locality ||
        (a.village && (a.city || a.town) ? (a.suburb || a.city_district || a.city || a.town) : a.village) ||
        a.town || a.city || 'Your Area';
      const city  = a.city || a.town || a.county;
      const state = a.state;
      const secondary = [city, state].filter(Boolean).join(', ') || null;
      return { primary, secondary };
    }
  } catch { /* ignored */ }

  return { primary: 'Location found', secondary: null };
}
