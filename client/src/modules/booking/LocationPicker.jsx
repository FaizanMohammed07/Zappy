import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Home, Briefcase, Clock, Search,
  ChevronRight, Loader2, X, Map, Crosshair, Star, Sparkles, CheckCircle,
} from 'lucide-react';
import {
  useGetAddressesQuery,
  useSaveRecentLocationMutation,
  useLazyGetNearbyWorkersQuery,
} from '../../services/api';
import { saveGeoLocation, loadGeoLocation } from '../../utils/geoCache';
import { useGeolocation } from '../../hooks/useGeolocation';
import { SERVICE_WORKER_EMOJI, SERVICE_COLORS } from '../../constants/services';

const TOKEN    = import.meta.env.VITE_MAPBOX_TOKEN;
const SHEET_H  = 140;

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
    @keyframes zlp-wheel-spin {
      from { transform:rotate(0deg); }
      to   { transform:rotate(360deg); }
    }
    @keyframes zlp-bike-bounce {
      0%,100% { transform:translateY(0px)   rotate(-1.5deg); }
      30%      { transform:translateY(-5px)  rotate(1.5deg);  }
      60%      { transform:translateY(-2px)  rotate(2deg);    }
      80%      { transform:translateY(-6px)  rotate(-1deg);   }
    }
    @keyframes zlp-speed-line {
      0%   { transform:scaleX(1)   translateX(0);   opacity:.85; }
      60%  { transform:scaleX(0.4) translateX(6px); opacity:.3;  }
      100% { transform:scaleX(0)   translateX(10px);opacity:0;   }
    }
    @keyframes zlp-worker-shadow {
      0%,100% { transform:scaleX(1);   opacity:0.4; }
      50%      { transform:scaleX(0.6); opacity:0.2; }
    }
    @keyframes zlp-neon-pulse {
      0%,100% { opacity:.7; }
      50%      { opacity:1;  }
    }
  `;
  document.head.appendChild(s);
}

const VEHICLE_SERVICES = new Set([
  'puncture','bike_wash','car_wash','battery_jump_start','fuel_delivery','minor_roadside_repair',
]);

function makeWorkerDot(emoji = '👷', accentColor = '#22c55e', serviceSlug = '', animDelay = '0s') {
  ensureLocPickStyles();
  const isVehicle = VEHICLE_SERVICES.has(serviceSlug);
  const c = accentColor;
  const dur = isVehicle ? '1.1s' : '1.8s';

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:relative;display:flex;flex-direction:column;align-items:center;
    cursor:default;user-select:none;transition:transform 0.35s ease;
  `;

  const bikeEl = document.createElement('div');
  bikeEl.style.cssText = `
    display:flex;flex-direction:column;align-items:center;
    animation:zlp-bike-bounce ${dur} ease-in-out infinite;
    animation-delay:${animDelay};transform-origin:center bottom;
  `;
  wrap._bikeEl = bikeEl;
  wrap.appendChild(bikeEl);

  if (isVehicle) {
    // ── SVG Bike with spinning wheels ─────────────────────────────
    const r = 10; // wheel radius
    const bikeW = 56, bikeH = 34;
    const wheelSpeedDur = isVehicle ? '0.55s' : '1.2s';
    const svgNs = 'http://www.w3.org/2000/svg';

    // Speed lines container (left of bike)
    const lines = document.createElement('div');
    lines.style.cssText = `
      position:absolute;left:-18px;top:50%;transform:translateY(-50%);
      display:flex;flex-direction:column;gap:3px;
    `;
    [1, 0.7, 0.45].forEach((op, i) => {
      const ln = document.createElement('div');
      ln.style.cssText = `
        width:${12 - i * 3}px;height:2px;border-radius:2px;
        background:${c};opacity:${op};
        animation:zlp-speed-line ${0.5 + i * 0.12}s ease-out infinite;
        animation-delay:${(i * 0.15 + parseFloat(animDelay))}s;
      `;
      lines.appendChild(ln);
    });
    bikeEl.appendChild(lines);

    // SVG bike
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', bikeW);
    svg.setAttribute('height', bikeH);
    svg.setAttribute('viewBox', `0 0 ${bikeW} ${bikeH}`);
    svg.style.cssText = `display:block;filter:drop-shadow(0 0 6px ${c}cc) drop-shadow(0 2px 8px rgba(0,0,0,0.8));`;

    const mk = (tag, attrs) => {
      const el = document.createElementNS(svgNs, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // Wheel centres
    const lx = 11, rx = bikeW - 11, wy = bikeH - r - 1;

    // Defs for spinning wheel groups
    const defs = mk('defs', {});

    // Left wheel group (spinning)
    const gL = mk('g', { style: `transform-origin:${lx}px ${wy}px;animation:zlp-wheel-spin ${wheelSpeedDur} linear infinite;animation-delay:${animDelay};` });
    gL.appendChild(mk('circle', { cx: lx, cy: wy, r, stroke: c, 'stroke-width': '2.2', fill: 'none' }));
    // spokes
    [0,60,120].forEach(a => {
      const rad = a * Math.PI / 180;
      gL.appendChild(mk('line', {
        x1: lx, y1: wy,
        x2: lx + r * 0.85 * Math.cos(rad), y2: wy + r * 0.85 * Math.sin(rad),
        stroke: c, 'stroke-width': '1', opacity: '0.6',
      }));
    });
    gL.appendChild(mk('circle', { cx: lx, cy: wy, r: '2', fill: c }));

    // Right wheel group (spinning)
    const gR = mk('g', { style: `transform-origin:${rx}px ${wy}px;animation:zlp-wheel-spin ${wheelSpeedDur} linear infinite;animation-delay:${animDelay};` });
    gR.appendChild(mk('circle', { cx: rx, cy: wy, r, stroke: c, 'stroke-width': '2.2', fill: 'none' }));
    [0,60,120].forEach(a => {
      const rad = a * Math.PI / 180;
      gR.appendChild(mk('line', {
        x1: rx, y1: wy,
        x2: rx + r * 0.85 * Math.cos(rad), y2: wy + r * 0.85 * Math.sin(rad),
        stroke: c, 'stroke-width': '1', opacity: '0.6',
      }));
    });
    gR.appendChild(mk('circle', { cx: rx, cy: wy, r: '2', fill: c }));

    // Frame: seat-stay (seat→rear axle), chain-stay (BB→rear), down-tube, top-tube, fork
    const BB = { x: lx + 16, y: wy - 2 };  // bottom bracket
    const HT = { x: rx - 6,  y: 5 };        // head tube top
    const ST = { x: lx + 12, y: 6 };        // seat top

    const frameLines = [
      [BB.x, BB.y, lx, wy],          // chain-stay L
      [BB.x, BB.y, rx, wy],          // chain-stay R (drive side)
      [BB.x, BB.y, ST.x, ST.y],      // seat tube
      [ST.x, ST.y, HT.x, HT.y],     // top tube
      [BB.x, BB.y, HT.x + 2, HT.y + 8], // down tube
      [rx, wy, HT.x + 2, HT.y + 8], // fork
      [ST.x, ST.y, ST.x - 6, ST.y - 3], // saddle
    ];
    frameLines.forEach(([x1,y1,x2,y2]) => {
      svg.appendChild(mk('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': '2', 'stroke-linecap': 'round' }));
    });

    // Rider silhouette (simple: torso + helmet)
    svg.appendChild(mk('line', { x1: ST.x, y1: ST.y - 1, x2: HT.x - 2, y2: HT.y + 4, stroke: '#fff', 'stroke-width': '2.2', 'stroke-linecap': 'round', opacity: '0.85' }));
    svg.appendChild(mk('circle', { cx: HT.x - 3, cy: HT.y + 1, r: '4.5', fill: '#fff', opacity: '0.85' }));

    svg.appendChild(defs);
    svg.appendChild(gL);
    svg.appendChild(gR);
    bikeEl.appendChild(svg);

    // Neon glow ring under wheels
    const glow = document.createElement('div');
    glow.style.cssText = `
      width:${bikeW}px;height:6px;border-radius:50%;margin-top:-2px;
      background:radial-gradient(ellipse at center, ${c}88 0%, transparent 70%);
      animation:zlp-neon-pulse 1.1s ease-in-out infinite;
      animation-delay:${animDelay};
    `;
    bikeEl.appendChild(glow);

  } else {
    // Non-vehicle services: large emoji with glow
    const emojiSpan = document.createElement('span');
    emojiSpan.style.cssText = `
      font-size:28px;line-height:1;display:block;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.8)) drop-shadow(0 0 10px ${c}99);
    `;
    emojiSpan.textContent = emoji;
    bikeEl.appendChild(emojiSpan);
  }

  // Ground shadow
  const shadow = document.createElement('div');
  shadow.style.cssText = `
    width:28px;height:5px;border-radius:50%;
    background:rgba(0,0,0,0.5);filter:blur(3px);
    margin-top:1px;
    animation:zlp-worker-shadow ${dur} ease-in-out infinite;
    animation-delay:${animDelay};
  `;
  wrap.appendChild(shadow);
  return wrap;
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

export default function LocationPicker({ onConfirm, serviceLabel, service }) {
  const { getCurrent } = useGeolocation();

  const [view,        setView]        = useState('quick');
  const [address,      setAddress]      = useState('');
  const [shortAddress, setShortAddress] = useState('');
  const [geocoding,    setGeocoding]    = useState(false);
  const [coords,       setCoords]       = useState(null);
  const [isDragging,  setDrag]        = useState(false);
  const [geoState,    setGeoState]    = useState('idle');
  const [geoError,    setGeoError]    = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [detectedLoc, setDetectedLoc] = useState(() => loadGeoLocation());
  const [searchQ,     setSearchQ]     = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [nearbyCount, setNearbyCount] = useState(null);
  const [mapReady,    setMapReady]    = useState(false);

  const mapRef        = useRef(null);
  const stateRef      = useRef({ pendingCenter: null, ready: false, userLocMarker: null });
  const workerMarkers = useRef([]);   // { marker, baseLng, baseLat }[]
  const revTimer      = useRef(null);
  const moveTimer     = useRef(null);

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

    setMapReady(false);

    // Defer init by one frame so the container has real dimensions in the DOM
    const raf = requestAnimationFrame(() => {
      const container = document.getElementById('zappy-locpick-map');
      if (!container || mapRef.current) return;

      ensureWorkerDotStyles();
      mapboxgl.accessToken = TOKEN;

      const initCenter = stateRef.current.pendingCenter
        ?? (detectedLoc ? [detectedLoc.lng, detectedLoc.lat] : [77.5946, 12.9716]);
      const initZoom = (stateRef.current.pendingCenter || detectedLoc) ? 15 : 11;

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: initCenter,
        zoom: initZoom,
        attributionControl: false,
        fadeDuration: 150,
      });
      mapRef.current = map;

      // Resize immediately + after a short delay — fixes blank tiles in modals/sheets
      map.resize();
      const resizeTimer = setTimeout(() => map.resize(), 150);

      map.on('load', () => {
        map.resize();
        setMapReady(true);
        stateRef.current.ready = true;

        // Vivid accent colours over dark base
        const tryPaint = (layer, prop, val) => {
          try { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, val); } catch {}
        };
        // Road highlights — indigo/violet glow
        ['road-primary', 'road-secondary-tertiary', 'road-street'].forEach(l => {
          tryPaint(l, 'line-color', '#6366f1');
          tryPaint(l, 'line-opacity', 0.9);
        });
        tryPaint('road-motorway-trunk', 'line-color', '#8b5cf6');
        tryPaint('road-local', 'line-color', '#4f46e5');
        tryPaint('road-local', 'line-opacity', 0.6);
        // Water — deep teal
        tryPaint('water', 'fill-color', '#0c4a6e');
        // Parks — deep green
        tryPaint('landuse', 'fill-color', '#14532d');
        tryPaint('landuse', 'fill-opacity', 0.6);
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

      // Fallback: if style errors, try light-v11
      map.on('error', (e) => {
        if (e.sourceId === undefined && !stateRef.current.ready) {
          map.setStyle('mapbox://styles/mapbox/light-v11');
        }
      });

    map.on('movestart', () => { setDrag(true); setGeocoding(false); });
    map.on('moveend', () => {
      setDrag(false);
      clearTimeout(revTimer.current);
      setGeocoding(true);
      revTimer.current = setTimeout(async () => {
        const canvas = map.getCanvas();
        const cx = canvas.width  / window.devicePixelRatio / 2;
        const cy = (canvas.height / window.devicePixelRatio - SHEET_H) / 2;
        const { lat, lng } = map.unproject([cx, cy]);
        setCoords({ lat, lng });
        try {
          const r = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
            `?access_token=${TOKEN}&language=en&types=address,neighborhood,locality,place&limit=1`,
          );
          const d = await r.json();
          const feat = d.features?.[0];
          if (feat) {
            const ctx = feat.context || [];
            const get = (p) => ctx.find(c => c.id?.startsWith(p))?.text ?? null;
            // Short: street name or neighbourhood
            const short = feat.place_type?.[0] === 'address'
              ? feat.text
              : get('neighborhood') || get('locality') || feat.text;
            // Full: "Short, Area, City PIN"
            setShortAddress(short || feat.place_name.split(',')[0]);
            setAddress(feat.place_name);
          } else {
            setShortAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        } catch {
          setShortAddress('Location selected');
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
        setGeocoding(false);
      }, 420);
    });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      clearTimeout(resizeTimer); // closed in cleanup
    }); // end requestAnimationFrame

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(revTimer.current);
      cancelAnimationFrame(moveTimer.current);
      workerMarkers.current.forEach((w) => w.marker?.remove?.() || w.remove?.());
      workerMarkers.current = [];
      stateRef.current.userLocMarker?.remove();
      stateRef.current.userLocMarker = null;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      stateRef.current.ready = false;
      setMapReady(false);
    };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function _loadNearbyWorkers(map, loc) {
    const workerEmoji = SERVICE_WORKER_EMOJI[service] ?? '👷';
    const workerColor = SERVICE_COLORS[service]       ?? '#22c55e';
    const serviceSlug = service ?? '';

    // Clear previous markers
    cancelAnimationFrame(moveTimer.current);
    moveTimer.current = null;
    workerMarkers.current.forEach((w) => w.marker.remove());
    workerMarkers.current = [];

    try {
      const res = await fetchNearby({ lat: loc.lat, lng: loc.lng }).unwrap();
      const workers = res?.workers || [];
      setNearbyCount(workers.length);

      workers.forEach((w, i) => {
        const delay = `${(i * 0.22).toFixed(2)}s`;
        const el = makeWorkerDot(workerEmoji, workerColor, serviceSlug, delay);
        // Pin at worker's real last-known GPS position — no simulated drift
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([w.lng, w.lat])
          .addTo(map);
        workerMarkers.current.push({ marker });
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
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-20">
          <p className="text-sm text-red-500 font-medium px-6 text-center">
            VITE_MAPBOX_TOKEN not set — add it to .env
          </p>
        </div>
      )}

      {/* Map container — explicit fill so Mapbox gets real dimensions */}
      <div id="zappy-locpick-map" className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay — fades out once tiles are rendered */}
      <AnimatePresence>
        {!mapReady && (
          <motion.div
            key="map-loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}
          >
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 32px rgba(249,115,22,0.5)' }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <MapPin size={24} strokeWidth={2} className="text-white" />
            </motion.div>
            <p className="text-sm font-bold text-white/80">Loading map…</p>
            <div className="flex gap-1.5">
              {[0, 0.15, 0.3].map((d) => (
                <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-orange-400"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium Center Pin ─────────────────────────────────────── */}
      <div
        className="absolute z-10 pointer-events-none flex flex-col items-center"
        style={{
          left:      '50%',
          top:       `calc(50% - ${SHEET_H / 2}px)`,
          transform: 'translateX(-50%) translateY(-100%)',
        }}
      >
        {/* Pulse ring — vivid orange glow when stationary */}
        {!isDragging && coords && (
          <>
            <motion.div
              className="absolute rounded-full"
              style={{ width: 60, height: 60, top: -12, left: '50%', marginLeft: -30, background: 'rgba(249,115,22,0.25)', zIndex: 0 }}
              animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 60, height: 60, top: -12, left: '50%', marginLeft: -30, background: 'rgba(249,115,22,0.12)', zIndex: 0 }}
              animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
          </>
        )}

        {/* Pin body — vibrant orange, highly visible on dark map */}
        <motion.div
          animate={{ y: isDragging ? -18 : 0, scale: isDragging ? 1.15 : 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <svg width="44" height="56" viewBox="0 0 44 56" fill="none">
            <defs>
              <filter id="ps" x="-50%" y="-20%" width="200%" height="180%">
                <feDropShadow dx="0" dy={isDragging ? 10 : 5} stdDeviation={isDragging ? 8 : 4}
                  floodColor="#c2410c" floodOpacity={isDragging ? 0.7 : 0.45} />
              </filter>
              <linearGradient id="pg" x1="0" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <path
              d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 56 22 56C22 56 44 38.5 44 22C44 9.85 34.15 0 22 0Z"
              fill="url(#pg)" filter="url(#ps)"
            />
            {/* White ring */}
            <circle cx="22" cy="22" r="11" fill="white" />
            {/* Inner dot */}
            <circle cx="22" cy="22" r="5.5" fill="#ea580c" />
            {/* Gloss highlight */}
            <ellipse cx="17.5" cy="16.5" rx="5" ry="3" fill="white" opacity="0.45" transform="rotate(-20 17.5 16.5)" />
          </svg>
        </motion.div>

        {/* Shadow beneath pin */}
        <motion.div
          animate={{ scaleX: isDragging ? 0.45 : 1, opacity: isDragging ? 0.3 : 0.22 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          className="rounded-full"
          style={{ width: 20, height: 6, marginTop: -4, background: 'rgba(234,88,12,0.8)', filter: 'blur(4px)' }}
        />
      </div>

      {/* ── Top-left: Back button ──────────────────────────────────── */}
      <motion.button
        onClick={() => setView('quick')}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
        whileTap={{ scale: 0.93 }}
        aria-label="Back"
        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <X size={14} strokeWidth={2.5} className="text-white/90" />
        <span className="text-xs font-bold text-white/90">Back</span>
      </motion.button>

      {/* ── Top-right: GPS recenter ────────────────────────────────── */}
      <motion.button
        onClick={_goToMyLocation}
        className="absolute top-4 right-4 z-20 w-11 h-11 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
        whileTap={{ scale: 0.90 }}
        aria-label="My location"
      >
        {geoState === 'loading'
          ? <Loader2 size={17} strokeWidth={2} className="text-orange-400 animate-spin" />
          : <Crosshair size={17} strokeWidth={2} className="text-orange-400" />}
      </motion.button>

      {/* ── Nearby workers badge ───────────────────────────────────── */}
      <AnimatePresence>
        {nearbyCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute z-20"
            style={{ top: 16, left: '50%', transform: 'translateX(-50%)' }}
          >
            {nearbyCount === 0 ? (
              <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg ring-1 ring-black/[0.06]">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">No workers nearby — try another area</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', boxShadow: '0 4px 20px rgba(15,23,42,0.35)' }}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                </span>
                <span className="text-[11px] font-extrabold text-white whitespace-nowrap">
                  {nearbyCount} worker{nearbyCount !== 1 ? 's' : ''} nearby · ~5 min ETA
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium Dark Glass Bottom Sheet ───────────────────────── */}
      <div
        className="absolute bottom-0 md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg z-20 rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{
          height: SHEET_H,
          background: 'rgba(10,13,28,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        }}
      >
        {/* Vivid accent bar */}
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #f97316, #f59e0b, #f97316)' }} />

        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div className="px-5 pt-1 pb-3">
          {/* Address row */}
          <div className="flex items-center gap-3 mb-3">
            {/* Animated pin icon */}
            <motion.div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: isDragging || geocoding ? 'rgba(100,116,139,0.5)' : 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: isDragging || geocoding ? 'none' : '0 0 16px rgba(249,115,22,0.45)' }}
              animate={!isDragging && !geocoding && coords ? { boxShadow: ['0 0 12px rgba(249,115,22,0.4)', '0 0 28px rgba(249,115,22,0.7)', '0 0 12px rgba(249,115,22,0.4)'] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {geocoding
                ? <Loader2 size={16} strokeWidth={2.5} className="text-white animate-spin" />
                : <MapPin size={16} strokeWidth={2.5} className="text-white" />}
            </motion.div>

            {/* Address text */}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: '#f97316' }}>
                Service Location
              </p>
              <AnimatePresence mode="wait">
                {isDragging ? (
                  <motion.p key="drag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-sm font-semibold italic" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Move map to pin location…
                  </motion.p>
                ) : geocoding ? (
                  <motion.p key="geo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
                    Looking up address…
                  </motion.p>
                ) : address ? (
                  <motion.div key="addr" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-[15px] font-black leading-tight truncate text-white">{shortAddress || address.split(',')[0]}</p>
                    <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{address}</p>
                  </motion.div>
                ) : (
                  <motion.p key="empty" className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Drag map to pin your location
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Confirm button */}
          <motion.button
            onClick={confirmLocation}
            disabled={!coords || !address || geocoding}
            className="w-full h-10 rounded-xl font-black text-[13px] flex items-center justify-center gap-2 transition-all"
            style={{
              background: coords && address && !geocoding
                ? 'linear-gradient(135deg, #f97316, #ea580c)'
                : 'rgba(255,255,255,0.07)',
              color: coords && address && !geocoding ? 'white' : 'rgba(255,255,255,0.25)',
              boxShadow: coords && address && !geocoding ? '0 4px 24px rgba(249,115,22,0.5)' : 'none',
              border: coords && address && !geocoding ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}
            whileTap={coords && address && !geocoding ? { scale: 0.97 } : {}}
            animate={coords && address && !geocoding ? {
              boxShadow: ['0 4px 20px rgba(249,115,22,0.45)', '0 4px 32px rgba(249,115,22,0.75)', '0 4px 20px rgba(249,115,22,0.45)'],
            } : {}}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            {geocoding
              ? <><Loader2 size={15} className="animate-spin" /> Detecting address…</>
              : coords && address
                ? <><CheckCircle size={15} strokeWidth={2.5} /> Confirm This Location</>
                : 'Pin a location to continue'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
