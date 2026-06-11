/**
 * Smart reverse geocoding: Mapbox first (good Indian coverage),
 * Nominatim zoom=18 as fallback (better Indian locality granularity).
 *
 * Returns { primary, secondary } where:
 *   primary   — most specific local area name (colony / ward / suburb)
 *   secondary — "City, State" string
 */
export async function reverseGeocode(lat, lng) {
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  // ── Mapbox: request address + neighborhood + locality + place
  //    then pick the most granular neighbourhood from context
  if (MAPBOX_TOKEN) {
    try {
      const r = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${MAPBOX_TOKEN}&language=en` +
        `&types=address,neighborhood,locality,place&limit=1`,
      );
      if (r.ok) {
        const d = await r.json();
        const feat = d.features?.[0];
        if (feat) {
          const ctx = feat.context || [];
          const get = (prefix) => ctx.find((c) => c.id?.startsWith(prefix))?.text ?? null;

          // Indian priority: neighborhood > locality (if not a bare district name) > place
          const neighborhood = get('neighborhood');
          const locality     = get('locality');
          const place        = get('place') || get('district');
          const region       = get('region');

          // Prefer neighborhood, then locality — but skip locality if it equals the
          // district (e.g. "Ranga Reddy District") and a place-level name is available
          const isDistrict = (s) => s && /district|mandal|taluk/i.test(s);
          const primary =
            neighborhood ||
            (locality && !isDistrict(locality) ? locality : null) ||
            place ||
            feat.text;

          const city      = place || get('district');
          const secondary = [city, region].filter(Boolean).join(', ') || null;

          if (primary) return { primary, secondary };
        }
      }
    } catch { /* fall through */ }
  }

  // ── Nominatim: zoom=18 gives street-level detail, better for Indian localities
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
      `&format=json&zoom=18&addressdetails=1&accept-language=en`,
      { headers: { 'Accept-Language': 'en' } },
    );
    if (r.ok) {
      const d = await r.json();
      const a = d.address || {};

      // Indian priority — most specific first:
      // quarter > neighbourhood > suburb > city_district > village > town > city
      const primary =
        a.quarter        ||
        a.neighbourhood  ||
        a.suburb         ||
        a.city_district  ||
        a.village        ||
        a.town           ||
        a.city           ||
        'Your Area';

      const city  = a.city || a.town || a.county;
      const state = a.state;
      const secondary = [city, state].filter(Boolean).join(', ') || null;
      return { primary, secondary };
    }
  } catch { /* ignored */ }

  return { primary: 'Location found', secondary: null };
}
