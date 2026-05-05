import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Home, Briefcase, Clock, Search,
  ChevronRight, Loader2, X, Map, Crosshair,
} from 'lucide-react';
import {
  useGetAddressesQuery,
  useSaveRecentLocationMutation,
  useLazyGetNearbyWorkersQuery,
} from '../../services/api';
import { saveGeoLocation, loadGeoLocation } from '../../utils/geoCache';

const TOKEN    = import.meta.env.VITE_MAPBOX_TOKEN;
const SHEET_H  = 200;
const GEO_OPTS = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

const TAG_META = {
  home:  { icon: Home,      bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-100'   },
  work:  { icon: Briefcase, bg: 'bg-purple-50',  text: 'text-purple-600', ring: 'ring-purple-100' },
  other: { icon: MapPin,    bg: 'bg-slate-50',   text: 'text-slate-500',  ring: 'ring-slate-100'  },
};

/* ─── Marker factories ─────────────────────────────────────────── */

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

/* kept for backward compat, no longer used directly */
function ensureWorkerDotStyles() { ensureLocPickStyles(); }

/* ─── Component ────────────────────────────────────────────────── */

export default function LocationPicker({ onConfirm }) {
  const [view,        setView]        = useState('quick');
  const [address,     setAddress]     = useState('');
  const [coords,      setCoords]      = useState(null);
  const [isDragging,  setDrag]        = useState(false);
  const [geoState,    setGeoState]    = useState('idle'); // idle | loading | done | error
  const [geoError,    setGeoError]    = useState(null);
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

  /* ── Auto-detect fresh GPS on mount (cached loc already shown instantly) ── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        saveGeoLocation(loc);
        setDetectedLoc(loc);
        setGeoState('done');
      },
      () => {
        setGeoState(detectedLoc ? 'done' : 'error');
        setGeoError('Could not detect location. Check GPS permissions.');
      },
      GEO_OPTS,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mapbox search ── */
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

  /* ── Map init ── */
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        saveGeoLocation(loc);
        setDetectedLoc(loc);
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
      },
      () => {
        setGeoState('error');
        setGeoError('Location access denied. Enable GPS and try again.');
      },
      GEO_OPTS,
    );
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
      <div className="flex flex-col h-full bg-[#F9FAFB]">
        {/* Search bar */}
        <div className="bg-white px-4 pt-4 pb-3 shadow-sm shrink-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Where do you need the service?
          </p>
          <button
            onClick={() => setView('search')}
            className="w-full flex items-center gap-2.5 bg-slate-50 ring-1 ring-slate-200 rounded-2xl px-4 py-3 text-left hover:ring-blue-300 transition-all"
          >
            <Search size={15} strokeWidth={2.5} className="text-blue-500 shrink-0" />
            <span className="text-sm text-slate-400 font-medium flex-1">Search for a location…</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
              Search
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* GPS button */}
          <button
            onClick={_goToMyLocation}
            className="w-full flex items-center gap-3 px-4 py-4 bg-white border-b border-slate-100 hover:bg-blue-50/40 transition active:bg-blue-50/60"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              {geoState === 'loading'
                ? <Loader2 size={17} strokeWidth={2.5} className="text-white animate-spin" />
                : <Navigation size={17} strokeWidth={2.5} className="text-white" />}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold text-[#0F172A]">
                {geoState === 'loading' ? 'Detecting your location…' : 'Use my current location'}
              </p>
              {geoState === 'loading' && (
                <p className="text-xs text-blue-500 font-medium mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                  GPS acquiring signal…
                </p>
              )}
              {geoState === 'done' && detectedLoc && (
                <p className="text-xs text-green-600 font-semibold mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Location detected
                  {detectedLoc.accuracy != null
                    ? ` · ±${Math.round(detectedLoc.accuracy)}m`
                    : ''}
                </p>
              )}
              {geoState === 'error' && (
                <p className="text-xs text-red-500 font-medium mt-0.5">{geoError}</p>
              )}
              {geoState === 'idle' && (
                <p className="text-xs text-slate-400 mt-0.5">GPS — most accurate</p>
              )}
            </div>
            <ChevronRight size={14} className="text-slate-300 shrink-0" />
          </button>

          {/* Saved places */}
          {savedAddresses.length > 0 && (
            <div className="mt-5 px-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Saved Places
              </p>
              <div className="space-y-2">
                {savedAddresses.map((sa) => {
                  const m    = TAG_META[sa.tag] || TAG_META.other;
                  const Icon = m.icon;
                  return (
                    <button
                      key={sa._id}
                      onClick={() => selectSaved(sa)}
                      className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 text-left hover:ring-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center shrink-0`}>
                        <Icon size={16} strokeWidth={2} className={m.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${m.text}`}>{sa.label}</p>
                        <p className="text-sm font-semibold text-[#0F172A] truncate mt-0.5">{sa.address}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent */}
          {recentLocations.length > 0 && (
            <div className="mt-5 px-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Recent</p>
              <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
                {recentLocations.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onConfirm({ address: r.address, lat: r.lat, lng: r.lng })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock size={13} strokeWidth={2} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] flex-1 truncate">{r.address}</p>
                    <ChevronRight size={13} className="text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pick on map */}
          <div className="px-4 mt-5">
            <button
              onClick={() => {
                if (detectedLoc) stateRef.current.pendingCenter = [detectedLoc.lng, detectedLoc.lat];
                setView('map');
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm hover:ring-blue-300 hover:shadow-md transition-all active:scale-[0.98] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <Map size={16} strokeWidth={2} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0F172A]">Pick on map</p>
                <p className="text-xs text-slate-400 mt-0.5">Drag to pin exact location</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
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
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setView('quick')}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 hover:bg-slate-200 transition"
          >
            <X size={16} strokeWidth={2.5} className="text-slate-600" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 rounded-2xl px-3.5 py-2.5 focus-within:ring-blue-400 focus-within:ring-2 transition-all">
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => selectSearchResult(f)}
                className="w-full flex items-start gap-3 px-4 py-4 border-b border-slate-50 text-left hover:bg-blue-50/40 transition"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={14} strokeWidth={2} className="text-blue-500" />
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
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <MapPin size={20} strokeWidth={1.5} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No results for "{searchQ}"</p>
              <button
                onClick={() => { setView('map'); setSearchQ(''); }}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full"
              >
                Pick on map instead
              </button>
            </div>
          )}

          {searchQ.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-8">
              <Search size={24} strokeWidth={1.5} className="text-slate-200" />
              <p className="text-sm text-slate-400">Type at least 3 characters to search</p>
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

      {/* Map container */}
      <div id="zappy-locpick-map" className="absolute inset-0" />

      {/* Center pin — spring-animated on drag */}
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
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.35" />
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
      <button
        onClick={() => setView('quick')}
        className="absolute top-4 left-4 z-20 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center ring-1 ring-slate-100 active:scale-95 transition"
        aria-label="Back"
      >
        <X size={16} strokeWidth={2.5} className="text-slate-600" />
      </button>

      {/* My location */}
      <button
        onClick={_goToMyLocation}
        className="absolute top-4 right-14 z-20 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center ring-1 ring-slate-100 active:scale-95 transition"
        aria-label="My location"
      >
        {geoState === 'loading'
          ? <Loader2 size={16} strokeWidth={2} className="text-blue-600 animate-spin" />
          : <Crosshair size={16} strokeWidth={2} className="text-blue-600" />}
      </button>

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
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={14} strokeWidth={2} className="text-blue-600" />
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
          <button
            onClick={confirmLocation}
            disabled={!coords || !address}
            className="btn-success w-full text-sm"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
