import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Home, Briefcase, Clock, Search,
  ChevronRight, Loader2, X, Map, Crosshair, Star, Sparkles,
} from 'lucide-react';
import {
  useGetAddressesQuery,
  useSaveRecentLocationMutation,
  useLazyGetNearbyWorkersQuery,
} from '../../services/api';
import { saveGeoLocation, loadGeoLocation } from '../../utils/geoCache';
import { useGeolocation } from '../../hooks/useGeolocation';

const TOKEN    = import.meta.env.VITE_MAPBOX_TOKEN;
const SHEET_H  = 200;
// Keep a legacy GEO_OPTS constant for the inline geolocation call in map view;
// the quick-view GPS button uses the hook's multi-sample getBestPosition instead.
const GEO_OPTS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

const ACCURACY_GOOD_M = 50;
const ACCURACY_WARN_M = 150;

const TAG_META = {
  home:  { icon: Home,      bg: 'from-blue-500 to-blue-600',    ring: 'ring-blue-200'   },
  work:  { icon: Briefcase, bg: 'from-violet-500 to-purple-600', ring: 'ring-purple-200' },
  other: { icon: MapPin,    bg: 'from-slate-400 to-slate-500',   ring: 'ring-slate-200'  },
};

function ensureLocPickStyles() {
  if (document.getElementById('zlp-styles')) return;
  const s = document.createElement('style');
  s.id = 'zlp-styles';
  s.textContent = `
    @keyframes zlp-worker-pulse {
      0%   { transform:scale(1);   opacity:.65; }
      100% { transform:scale(2.6); opacity:0;   }
    }
    @keyframes zlp-loc-ring-a {
      0%   { transform:scale(1);   opacity:.5; }
      100% { transform:scale(2.8); opacity:0;  }
    }
    @keyframes zlp-loc-ring-b {
      0%   { transform:scale(1);   opacity:.3; }
      100% { transform:scale(3.8); opacity:0;  }
    }
    @keyframes zlp-loc-glow {
      0%,100% { box-shadow:0 0 0 3px rgba(37,99,235,.25); }
      50%      { box-shadow:0 0 0 6px rgba(37,99,235,.45); }
    }
    @keyframes zlp-gps-ring {
      0%   { transform:scale(1);   opacity:.6; }
      100% { transform:scale(3.5); opacity:0;  }
    }
  `;
  document.head.appendChild(s);
}

function makeWorkerDot() {
  ensureLocPickStyles();
  const el = document.createElement('div');
  el.style.cssText = `
    position:relative; width:14px; height:14px; border-radius:50%;
    background:#22c55e; border:2.5px solid white;
    box-shadow:0 2px 8px rgba(34,197,94,0.55);
    z-index:2;
  `;
  const ring = document.createElement('div');
  ring.style.cssText = `
    position:absolute; inset:-6px; border-radius:50%;
    background:rgba(34,197,94,0.22);
    animation:zlp-worker-pulse 2s ease-out infinite;
  `;
  el.appendChild(ring);
  return el;
}

function makeUserLocationEl() {
  ensureLocPickStyles();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:20px;height:20px';
  wrap.innerHTML = `
    <div style="
      width:20px;height:20px;border-radius:50%;
      background:#2563EB;border:3px solid white;
      box-shadow:0 2px 10px rgba(37,99,235,.6);
      position:relative;z-index:3;
      animation:zlp-loc-glow 2.5s ease-in-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-7px;border-radius:50%;
      background:rgba(37,99,235,.22);z-index:2;
      animation:zlp-loc-ring-a 2.2s ease-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-11px;border-radius:50%;
      background:rgba(37,99,235,.1);z-index:1;
      animation:zlp-loc-ring-b 2.2s ease-out infinite .6s;
    "></div>`;
  return wrap;
}

function ensureWorkerDotStyles() { ensureLocPickStyles(); }

export default function LocationPicker({ onConfirm, serviceLabel }) {
  const { getCurrent } = useGeolocation();

  const [view,        setView]        = useState('quick');
  const [address,     setAddress]     = useState('');
  const [coords,      setCoords]      = useState(null);
  const [isDragging,  setDrag]        = useState(false);
  const [geoState,    setGeoState]    = useState('idle');
  const [geoError,    setGeoError]    = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [detectedLoc, setDetectedLoc] = useState(() => loadGeoLocation());
  const [searchQ,     setSearchQ]     = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [nearbyCount, setNearbyCount] = useState(null);

  const mapRef        = useRef(null);
  const stateRef      = useRef({ pendingCenter: null, ready: false, userLocMarker: null });
  const workerMarkers = useRef([]);
  const revTimer      = useRef(null);

  const { data: addrData }  = useGetAddressesQuery();
  const [saveRecent]         = useSaveRecentLocationMutation();
  const [fetchNearby]        = useLazyGetNearbyWorkersQuery();

  const savedAddresses  = addrData?.addresses      || [];
  const recentLocations = addrData?.recentLocations || [];

  // On mount: acquire GPS using multi-sample accuracy improvement.
  // The hook collects up to 4 readings over 8 seconds and returns the most
  // accurate one, dramatically reducing the ~500-1500m WiFi-triangulation error
  // that makes the same physical location appear 1-2km apart across browsers.
  useEffect(() => {
    setGeoState('loading');
    getCurrent()
      .then((loc) => {
        setDetectedLoc(loc);
        setGpsAccuracy(loc.accuracy);
        setGeoState('done');
      })
      .catch(() => {
        setGeoState(detectedLoc ? 'done' : 'error');
        setGeoError('Could not detect location. Enable GPS and try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      if (!TOKEN) return;
      setSearching(true);
      try {
        const r = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQ)}.json` +
          `?access_token=${TOKEN}&country=IN&language=en&limit=6&types=address,place,neighborhood,locality`,
        );
        const d = await r.json();
        setResults(d.features || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (view !== 'map') return;
    if (!TOKEN || mapRef.current) return;
    const container = document.getElementById('zappy-locpick-map');
    if (!container) return;

    ensureWorkerDotStyles();
    mapboxgl.accessToken = TOKEN;

    const initCenter = stateRef.current.pendingCenter
      ?? (detectedLoc ? [detectedLoc.lng, detectedLoc.lat] : [77.5946, 12.9716]);
    const initZoom   = (stateRef.current.pendingCenter || detectedLoc) ? 15 : 11;

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/navigation-day-v1',
      center: initCenter,
      zoom:   initZoom,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      stateRef.current.ready = true;
      if (stateRef.current.pendingCenter) {
        map.flyTo({ center: stateRef.current.pendingCenter, zoom: 16, duration: 900 });
        stateRef.current.pendingCenter = null;
      }
      const loc = detectedLoc;
      if (loc) {
        stateRef.current.userLocMarker = new mapboxgl.Marker({ element: makeUserLocationEl(), anchor: 'center' })
          .setLngLat([loc.lng, loc.lat]).addTo(map);
        _loadNearbyWorkers(map, loc);
      }
    });

    map.on('movestart', () => setDrag(true));
    map.on('moveend', () => {
      setDrag(false);
      clearTimeout(revTimer.current);
      revTimer.current = setTimeout(async () => {
        const canvas = map.getCanvas();
        const cx = canvas.width  / window.devicePixelRatio / 2;
        const cy = (canvas.height / window.devicePixelRatio - SHEET_H) / 2;
        const { lat, lng } = map.unproject([cx, cy]);
        try {
          const r = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
            `?access_token=${TOKEN}&language=en&types=address,place,neighborhood&limit=1`,
          );
          const d = await r.json();
          const addr = d.features?.[0]?.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(addr);
          setCoords({ lat, lng });
        } catch {
          setCoords({ lat, lng });
        }
      }, 380);
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      clearTimeout(revTimer.current);
      workerMarkers.current.forEach((m) => m.remove());
      workerMarkers.current = [];
      stateRef.current.userLocMarker?.remove();
      stateRef.current.userLocMarker = null;
      map.remove();
      mapRef.current = null;
      stateRef.current.ready = false;
    };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function _loadNearbyWorkers(map, loc) {
    try {
      const res = await fetchNearby({ lat: loc.lat, lng: loc.lng }).unwrap();
      const workers = res?.workers || [];
      setNearbyCount(workers.length);
      workerMarkers.current.forEach((m) => m.remove());
      workerMarkers.current = [];
      workers.forEach((w) => {
        const marker = new mapboxgl.Marker({ element: makeWorkerDot(), anchor: 'center' })
          .setLngLat([w.lng, w.lat])
          .addTo(map);
        workerMarkers.current.push(marker);
      });
    } catch { /* non-critical */ }
  }

  function _goToMyLocation() {
    setGeoState('loading');
    getCurrent()
      .then((loc) => {
        saveGeoLocation(loc);
        setDetectedLoc(loc);
        setGpsAccuracy(loc.accuracy);
        setGeoState('done');
        if (view === 'map' && mapRef.current) {
          mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 800 });
          if (stateRef.current.ready) {
            if (stateRef.current.userLocMarker) {
              stateRef.current.userLocMarker.setLngLat([loc.lng, loc.lat]);
            } else {
              stateRef.current.userLocMarker = new mapboxgl.Marker({ element: makeUserLocationEl(), anchor: 'center' })
                .setLngLat([loc.lng, loc.lat]).addTo(mapRef.current);
            }
            _loadNearbyWorkers(mapRef.current, loc);
          }
        } else {
          stateRef.current.pendingCenter = [loc.lng, loc.lat];
          setView('map');
        }
      })
      .catch(() => {
        setGeoState('error');
        setGeoError('Location access denied. Enable GPS and try again.');
      });
  }

  function confirmLocation() {
    if (!coords || !address) return;
    saveRecent({ address, lat: coords.lat, lng: coords.lng }).catch(() => {});
    onConfirm({ address, lat: coords.lat, lng: coords.lng });
  }

  function selectSaved(sa) {
    const [lng, lat] = sa.location.coordinates;
    onConfirm({ address: sa.address, lat, lng });
  }

  function selectSearchResult(f) {
    const [lng, lat] = f.center;
    saveRecent({ address: f.place_name, lat, lng }).catch(() => {});
    onConfirm({ address: f.place_name, lat, lng });
  }

  /* ════════════════════════════════════════════════════════════════
     QUICK VIEW
  ════════════════════════════════════════════════════════════════ */
  if (view === 'quick') {
    return (
      <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f9fafb 180px)' }}>

        {/* Hero search bar */}
        <div className="px-4 pt-5 pb-4 shrink-0">
          <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Sparkles size={10} />
            Step 1 of 2 — Choose location
          </p>
          <motion.button
            onClick={() => setView('search')}
            className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 text-left shadow-lg ring-1 ring-blue-100"
            whileHover={{ scale: 1.01, boxShadow: '0 8px 30px rgba(37,99,235,0.15)' }}
            whileTap={{ scale: 0.99 }}
            style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.1)' }}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Search size={15} strokeWidth={2.5} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Search for a location…</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Area, landmark, or full address</p>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full shrink-0 ring-1 ring-blue-100">
              Search
            </span>
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8 space-y-2 px-4">

          {/* GPS button — premium card */}
          <motion.button
            onClick={_goToMyLocation}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl ring-1 ring-slate-100 text-left relative overflow-hidden"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(37,99,235,0.12)' }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Subtle gradient shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/60 to-blue-50/0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* GPS icon with animated rings */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
                {geoState === 'loading'
                  ? <Loader2 size={18} strokeWidth={2.5} className="text-white animate-spin" />
                  : <Navigation size={18} strokeWidth={2.5} className="text-white" />}
              </div>
              {geoState === 'done' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                </span>
              )}
              {geoState === 'loading' && (
                <>
                  <div className="absolute inset-0 rounded-2xl bg-blue-400 opacity-30"
                    style={{ animation: 'zlp-gps-ring 1.6s ease-out infinite' }} />
                  <div className="absolute inset-0 rounded-2xl bg-blue-400 opacity-20"
                    style={{ animation: 'zlp-gps-ring 1.6s ease-out infinite 0.5s' }} />
                </>
              )}
            </div>

            <div className="flex-1 text-left min-w-0 relative">
              <p className="text-sm font-bold text-[#0F172A]">
                {geoState === 'loading' ? 'Detecting your location…' : 'Use my current location'}
              </p>
              {geoState === 'loading' && (
                <p className="text-xs text-blue-500 font-medium mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                  GPS acquiring signal…
                </p>
              )}
              {geoState === 'done' && detectedLoc && (() => {
                const acc = gpsAccuracy ?? detectedLoc.accuracy;
                const isGood = acc == null || acc <= ACCURACY_GOOD_M;
                const isWarn = acc != null && acc > ACCURACY_GOOD_M && acc <= ACCURACY_WARN_M;
                const isBad  = acc != null && acc > ACCURACY_WARN_M;
                return (
                  <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1.5 ${isBad ? 'text-amber-600' : isWarn ? 'text-yellow-600' : 'text-green-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${isBad ? 'bg-amber-500' : isWarn ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    {isGood && `GPS locked · ±${acc != null ? Math.round(acc) : '<50'}m`}
                    {isWarn && `Location detected · ±${Math.round(acc)}m accuracy — tap map to fine-tune`}
                    {isBad  && `Low GPS accuracy (±${Math.round(acc)}m) — please pin your location on map`}
                  </p>
                );
              })()}
              {geoState === 'error' && (
                <p className="text-xs text-red-500 font-medium mt-0.5">{geoError}</p>
              )}
              {geoState === 'idle' && (
                <p className="text-xs text-slate-400 mt-0.5">GPS — most accurate</p>
              )}
            </div>
            <div className="shrink-0 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
              <ChevronRight size={13} className="text-slate-400" />
            </div>
          </motion.button>

          {/* Saved places */}
          {savedAddresses.length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1">
                Saved Places
              </p>
              <div className="space-y-2">
                {savedAddresses.map((sa, i) => {
                  const m    = TAG_META[sa.tag] || TAG_META.other;
                  const Icon = m.icon;
                  return (
                    <motion.button
                      key={sa._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => selectSaved(sa)}
                      className="w-full flex items-center gap-3.5 p-3.5 bg-white rounded-2xl ring-1 ring-slate-100 text-left"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                      whileHover={{ scale: 1.01, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${m.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Icon size={16} strokeWidth={2} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{sa.label || sa.tag}</p>
                        <p className="text-sm font-semibold text-[#0F172A] truncate mt-0.5">{sa.address}</p>
                      </div>
                      <div className="shrink-0 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
                        <ChevronRight size={13} className="text-slate-400" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent locations */}
          {recentLocations.length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1">Recent</p>
              <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {recentLocations.map((r, i) => (
                  <motion.button
                    key={i}
                    onClick={() => onConfirm({ address: r.address, lat: r.lat, lng: r.lng })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-blue-50/40 transition border-b border-slate-50 last:border-0"
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock size={13} strokeWidth={2} className="text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] flex-1 truncate">{r.address}</p>
                    <ChevronRight size={13} className="text-slate-300 shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Pick on map — featured card */}
          <motion.button
            onClick={() => {
              if (detectedLoc) stateRef.current.pendingCenter = [detectedLoc.lng, detectedLoc.lat];
              setView('map');
            }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1e3a5f 100%)',
              boxShadow: '0 8px 24px rgba(15,23,42,0.25)',
            }}
            whileHover={{ scale: 1.01, boxShadow: '0 12px 32px rgba(15,23,42,0.35)' }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Decorative dots */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
              <div className="w-16 h-16 rounded-full border-4 border-white" />
              <div className="absolute inset-2 rounded-full border-4 border-white" />
            </div>

            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Map size={20} strokeWidth={2} className="text-white" />
            </div>
            <div className="flex-1 relative">
              <p className="text-sm font-bold text-white">Pick on Map</p>
              <p className="text-xs text-white/60 mt-0.5">Drag to pin your exact location</p>
            </div>
            <div className="shrink-0 w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
              <ChevronRight size={13} className="text-white" />
            </div>
          </motion.button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 pt-2 pb-1">
            {[
              { icon: Star,  label: '4.9★ Rated' },
              { icon: Navigation, label: 'Live Tracking' },
              { icon: Sparkles, label: '60s Matching' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center">
                  <Icon size={13} className="text-blue-500" />
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     SEARCH VIEW
  ════════════════════════════════════════════════════════════════ */
  if (view === 'search') {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0"
          style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, white 100%)' }}>
          <motion.button
            onClick={() => setView('quick')}
            className="w-9 h-9 rounded-xl bg-white ring-1 ring-slate-200 flex items-center justify-center shrink-0 shadow-sm"
            whileTap={{ scale: 0.92 }}
          >
            <X size={16} strokeWidth={2.5} className="text-slate-600" />
          </motion.button>
          <div className="flex-1 flex items-center gap-2 bg-white ring-2 ring-blue-200 rounded-2xl px-3.5 py-2.5 shadow-sm focus-within:ring-blue-400 transition-all">
            <Search size={14} strokeWidth={2.5} className="text-blue-500 shrink-0" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search address, area, landmark…"
              className="flex-1 bg-transparent text-sm font-medium text-[#0F172A] placeholder:text-slate-400 outline-none"
            />
            {searching
              ? <Loader2 size={13} className="animate-spin text-blue-400 shrink-0" />
              : searchQ && (
                <button onClick={() => setSearchQ('')} className="shrink-0">
                  <X size={13} className="text-slate-400" />
                </button>
              )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {results.map((f, i) => (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => selectSearchResult(f)}
                className="w-full flex items-start gap-3 px-4 py-4 border-b border-slate-50 text-left hover:bg-blue-50/40 transition"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <MapPin size={14} strokeWidth={2} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate">
                    {f.text || f.place_name.split(',')[0]}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{f.place_name}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" />
              </motion.button>
            ))}
          </AnimatePresence>

          {searchQ.length >= 3 && !searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 px-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <MapPin size={22} strokeWidth={1.5} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No results for "{searchQ}"</p>
              <motion.button
                onClick={() => { setView('map'); setSearchQ(''); }}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-5 py-2 rounded-full ring-1 ring-blue-100"
                whileTap={{ scale: 0.95 }}
              >
                Pick on map instead
              </motion.button>
            </div>
          )}

          {searchQ.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-8">
              <Search size={28} strokeWidth={1.5} className="text-slate-200" />
              <p className="text-sm text-slate-400">Type to search for your location</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     MAP VIEW
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative h-full w-full overflow-hidden">
      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-20">
          <p className="text-sm text-red-500 font-medium px-6 text-center">
            VITE_MAPBOX_TOKEN not set
          </p>
        </div>
      )}

      <div id="zappy-locpick-map" className="absolute inset-0" />

      {/* Center pin */}
      <div
        className="absolute z-10 pointer-events-none flex flex-col items-center"
        style={{
          left:      '50%',
          top:       `calc(50% - ${SHEET_H / 2}px)`,
          transform: 'translateX(-50%) translateY(-100%)',
        }}
      >
        <motion.div
          animate={{ y: isDragging ? -14 : 0, scale: isDragging ? 1.12 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
            <filter id="pin-shadow" x="-40%" y="-20%" width="180%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.4" />
            </filter>
            <path
              d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.06 27.94 0 18 0Z"
              fill="#2563EB"
              filter="url(#pin-shadow)"
            />
            <circle cx="18" cy="18" r="7" fill="white" />
            <circle cx="18" cy="18" r="3.5" fill="#2563EB" />
          </svg>
        </motion.div>
        {isDragging && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-4 h-1.5 rounded-full bg-black/20 blur-[1.5px] -mt-0.5"
          />
        )}
      </div>

      {/* Back */}
      <motion.button
        onClick={() => setView('quick')}
        className="absolute top-4 left-4 z-20 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center ring-1 ring-slate-100"
        whileTap={{ scale: 0.92 }}
        aria-label="Back"
      >
        <X size={16} strokeWidth={2.5} className="text-slate-600" />
      </motion.button>

      {/* My location */}
      <motion.button
        onClick={_goToMyLocation}
        className="absolute top-4 right-14 z-20 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center ring-1 ring-slate-100"
        whileTap={{ scale: 0.92 }}
        aria-label="My location"
      >
        {geoState === 'loading'
          ? <Loader2 size={16} strokeWidth={2} className="text-blue-600 animate-spin" />
          : <Crosshair size={16} strokeWidth={2} className="text-blue-600" />}
      </motion.button>

      {/* Nearby workers badge */}
      <AnimatePresence>
        {nearbyCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0,   scale: 1     }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white rounded-full px-3.5 py-1.5 shadow-lg ring-1 ring-slate-100"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
            <span className="text-xs font-bold text-[#0F172A] whitespace-nowrap">
              {nearbyCount === 0
                ? 'No workers online nearby'
                : `${nearbyCount} worker${nearbyCount === 1 ? '' : 's'} nearby`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 bg-white rounded-t-3xl shadow-2xl"
        style={{ height: SHEET_H }}
      >
        <div className="flex justify-center pt-3 pb-1.5">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-1">
          <div className="flex items-start gap-3 mb-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <MapPin size={14} strokeWidth={2} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Service location
              </p>
              <p className="text-sm font-medium text-[#0F172A] leading-snug line-clamp-2 min-h-[2.5rem]">
                {isDragging
                  ? 'Move map to select…'
                  : address || 'Drag the map to pin your exact location'}
              </p>
            </div>
          </div>
          <motion.button
            onClick={confirmLocation}
            disabled={!coords || !address}
            className="btn-success w-full text-sm"
            whileTap={coords && address ? { scale: 0.97 } : {}}
          >
            Confirm Location
          </motion.button>
        </div>
      </div>
    </div>
  );
}
