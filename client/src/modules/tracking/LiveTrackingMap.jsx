import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertCircle } from 'lucide-react';

const TOKEN          = import.meta.env.VITE_MAPBOX_TOKEN || '';
const ROUTE_COOLDOWN = 8000;
const LERP_DURATION  = 2600;
const TRAIL_MAX      = 12;       // positions kept in speed trail
const DRAW_DURATION  = 1400;     // ms for route draw animation

/* ─── Service colours ───────────────────────────────────────────── */
const SVC_COLORS = {
  electrical: '#F59E0B',
  plumbing:   '#3B82F6',
  ac_repair:  '#06B6D4',
  carpenter:  '#F97316',
  helper:     '#22C55E',
  puncture:   '#94A3B8',
  cleaning:   '#A855F7',
  painting:   '#EC4899',
};

/* ─── CSS injection ─────────────────────────────────────────────── */
function ensureStyles() {
  if (document.getElementById('lt2-styles')) return;
  const s = document.createElement('style');
  s.id = 'lt2-styles';
  s.textContent = `
    @keyframes lt2-pulse-a {
      0%   { transform:scale(1);   opacity:.55; }
      100% { transform:scale(2.6); opacity:0;   }
    }
    @keyframes lt2-pulse-b {
      0%   { transform:scale(1);   opacity:.35; }
      100% { transform:scale(3.4); opacity:0;   }
    }
    @keyframes lt2-glow {
      0%,100% { box-shadow:0 0 8px 3px var(--wc,#10B981)60; }
      50%      { box-shadow:0 0 18px 7px var(--wc,#10B981)90; }
    }
    @keyframes lt2-skeleton {
      0%,100% { opacity:.4; }
      50%      { opacity:.75; }
    }
    .lt2-skeleton { animation:lt2-skeleton 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

/* ─── Pickup marker ─────────────────────────────────────────────── */
function makePickupEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:36px;height:44px;filter:drop-shadow(0 4px 14px rgba(37,99,235,.55))';
  wrap.innerHTML = `
    <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
      <path d="M18 0C8.059 0 0 8.059 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.059 27.941 0 18 0Z" fill="#2563EB"/>
      <circle cx="18" cy="18" r="7" fill="white"/>
      <circle cx="18" cy="18" r="3.5" fill="#2563EB"/>
    </svg>`;
  return wrap;
}

/* ─── Worker marker (double pulse + glow) ───────────────────────── */
function makeWorkerEl(service) {
  ensureStyles();
  const color = SVC_COLORS[service] || '#10B981';
  const wrap  = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:26px;height:26px';
  wrap.innerHTML = `
    <div style="
      --wc:${color};
      width:26px;height:26px;border-radius:50%;
      background:${color};border:3px solid rgba(255,255,255,.9);
      box-shadow:0 2px 10px ${color}80;
      position:relative;z-index:3;
      animation:lt2-glow 2.2s ease-in-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-7px;border-radius:50%;
      background:${color}45;z-index:2;
      animation:lt2-pulse-a 2s ease-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-12px;border-radius:50%;
      background:${color}20;z-index:1;
      animation:lt2-pulse-b 2s ease-out infinite .55s;
    "></div>`;
  return wrap;
}

/* ─── Smooth LERP ───────────────────────────────────────────────── */
function animateMarkerTo(marker, from, to) {
  let startTs = null;
  function frame(now) {
    if (!startTs) startTs = now;
    const t    = Math.min((now - startTs) / LERP_DURATION, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    marker.setLngLat([
      from.lng + (to.lng - from.lng) * ease,
      from.lat + (to.lat - from.lat) * ease,
    ]);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ─── fitBounds ─────────────────────────────────────────────────── */
function fitBounds(map, pickup, worker) {
  if (!pickup) return;
  if (!worker) {
    map.easeTo({ center: [pickup.lng, pickup.lat], zoom: 15, duration: 800 });
    return;
  }
  const bounds = new mapboxgl.LngLatBounds()
    .extend([pickup.lng, pickup.lat])
    .extend([worker.lng, worker.lat]);
  map.fitBounds(bounds, {
    padding:  { top: 100, bottom: 120, left: 70, right: 70 },
    maxZoom:  16,
    duration: 900,
    easing:   t => 1 - Math.pow(1 - t, 4),
  });
}

/* ─── Route draw animation ──────────────────────────────────────── */
function animateRouteDraw(map, st, allCoords) {
  if (st.routeAnimFrame) cancelAnimationFrame(st.routeAnimFrame);
  const total = allCoords.length;
  if (total < 2) return;
  let startTs = null;
  function frame(now) {
    if (!startTs) startTs = now;
    const t     = Math.min((now - startTs) / DRAW_DURATION, 1);
    const ease  = 1 - Math.pow(1 - t, 2.5);
    const count = Math.max(2, Math.round(ease * total));
    const slice = allCoords.slice(0, count);
    if (map.getSource('route')) {
      map.getSource('route').setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: slice },
      });
    }
    if (t < 1) {
      st.routeAnimFrame = requestAnimationFrame(frame);
    } else {
      st.routeAnimFrame = null;
    }
  }
  st.routeAnimFrame = requestAnimationFrame(frame);
}

/* ─── Route fetch ───────────────────────────────────────────────── */
async function fetchRoute(map, st, from, to) {
  if (!TOKEN) return;
  const now = Date.now();
  if (now - st.lastRoute < ROUTE_COOLDOWN) return;
  st.lastRoute = now;
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?access_token=${TOKEN}&geometries=geojson&overview=full`;
    const res   = await fetch(url);
    if (!res.ok) return;
    const data  = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (coords) animateRouteDraw(map, st, coords);
  } catch { /* non-critical */ }
}

/* ─── Speed trail update ────────────────────────────────────────── */
function updateTrail(map, st, pos) {
  st.trailPositions.push({ ...pos, t: Date.now() });
  if (st.trailPositions.length > TRAIL_MAX) st.trailPositions.shift();
  if (!map.getSource('trail')) return;
  const now = Date.now();
  const features = st.trailPositions.map((p, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { age: i / (st.trailPositions.length - 1 || 1) },
  }));
  map.getSource('trail').setData({ type: 'FeatureCollection', features });
}

/* ════════════════════════════════════════════════════════════════
   Component
════════════════════════════════════════════════════════════════ */
export default function LiveTrackingMap({ pickup, workerLocation, service, height = '60vh' }) {
  const containerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const sr = useRef({
    map:            null,
    ready:          false,
    pickupMarker:   null,
    workerMarker:   null,
    workerService:  service || null,
    prevWorkerPos:  null,
    lastRoute:      0,
    pendingPickup:  null,
    pendingWorker:  null,
    trailPositions: [],
    routeAnimFrame: null,
  });

  /* ── Init map ── */
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    const st = sr.current;

    mapboxgl.accessToken = TOKEN;

    const initCenter = st.pendingWorker
      ? [st.pendingWorker.lng, st.pendingWorker.lat]
      : st.pendingPickup
      ? [st.pendingPickup.lng, st.pendingPickup.lat]
      : [78.486671, 17.385044];

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              'mapbox://styles/mapbox/streets-v12',
      center:             initCenter,
      zoom:               14,
      attributionControl: false,
      logoPosition:       'bottom-left',
    });
    st.map = map;

    // Zoom + compass controls
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      /* ── Route source (lineMetrics required for gradient) ── */
      map.addSource('route', {
        type:        'geojson',
        lineMetrics: true,
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      });

      /* outer glow */
      map.addLayer({
        id:     'route-glow',
        type:   'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width':   16,
          'line-blur':    8,
          'line-opacity': 0.28,
          'line-gradient': [
            'interpolate', ['linear'], ['line-progress'],
            0,   '#6366F1',
            0.5, '#3B82F6',
            1,   '#06B6D4',
          ],
        },
      });
      /* casing — white border for contrast on light map */
      map.addLayer({
        id:     'route-casing',
        type:   'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width':   9,
          'line-color':   '#ffffff',
          'line-opacity': 0.9,
        },
      });
      /* core */
      map.addLayer({
        id:     'route-core',
        type:   'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width':   5,
          'line-opacity': 1,
          'line-gradient': [
            'interpolate', ['linear'], ['line-progress'],
            0,   '#6366F1',
            0.5, '#3B82F6',
            1,   '#06B6D4',
          ],
        },
      });

      /* ── Speed trail source ── */
      map.addSource('trail', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id:     'trail-dots',
        type:   'circle',
        source: 'trail',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'age'], 0, 2.5, 1, 5.5],
          'circle-color':  SVC_COLORS[service] || '#10B981',
          'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0, 0.6, 0.25, 1, 0.55],
          'circle-blur':   0.4,
        },
      });

      st.ready = true;
      setMapReady(true);

      const p = st.pendingPickup;
      const w = st.pendingWorker;
      if (p) {
        st.pickupMarker = new mapboxgl.Marker({ element: makePickupEl(), anchor: 'bottom' })
          .setLngLat([p.lng, p.lat]).addTo(map);
      }
      if (w) {
        st.workerMarker = new mapboxgl.Marker({ element: makeWorkerEl(st.workerService) })
          .setLngLat([w.lng, w.lat]).addTo(map);
        st.prevWorkerPos = w;
      }
      fitBounds(map, p, w);
      if (p && w) fetchRoute(map, st, w, p);
    });

    map.on('error', (e) => {
      console.warn('[LiveTrackingMap]', e.error?.message);
      if (e.error?.status === 401) setMapError(true);
    });

    return () => {
      if (st.routeAnimFrame) cancelAnimationFrame(st.routeAnimFrame);
      st.ready = false;
      st.map   = null;
      st.pickupMarker  = null;
      st.workerMarker  = null;
      st.prevWorkerPos = null;
      st.trailPositions = [];
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pickup prop ── */
  useEffect(() => {
    const st = sr.current;
    st.pendingPickup = pickup || null;
    if (!st.map || !st.ready || !pickup) return;
    if (st.pickupMarker) {
      st.pickupMarker.setLngLat([pickup.lng, pickup.lat]);
    } else {
      st.pickupMarker = new mapboxgl.Marker({ element: makePickupEl(), anchor: 'bottom' })
        .setLngLat([pickup.lng, pickup.lat]).addTo(st.map);
    }
    fitBounds(st.map, pickup, st.pendingWorker);
  }, [pickup]);

  /* ── Worker location prop ── */
  useEffect(() => {
    const st = sr.current;
    st.pendingWorker = workerLocation || null;
    if (!st.map || !st.ready || !workerLocation) return;

    if (st.workerMarker) {
      const from = st.prevWorkerPos || workerLocation;
      animateMarkerTo(st.workerMarker, from, workerLocation);
    } else {
      st.workerMarker = new mapboxgl.Marker({ element: makeWorkerEl(st.workerService) })
        .setLngLat([workerLocation.lng, workerLocation.lat]).addTo(st.map);
    }
    st.prevWorkerPos = workerLocation;
    updateTrail(st.map, st, workerLocation);

    const p = st.pendingPickup;
    if (p) {
      fitBounds(st.map, p, workerLocation);
      fetchRoute(st.map, st, workerLocation, p);
    }
  }, [workerLocation]);

  /* ── Worker marker colour when service changes ── */
  useEffect(() => {
    const st = sr.current;
    st.workerService = service || null;
    if (!st.workerMarker || !st.map || !st.ready) return;
    const pos = st.pendingWorker;
    if (!pos) return;
    st.workerMarker.remove();
    st.workerMarker = new mapboxgl.Marker({ element: makeWorkerEl(service) })
      .setLngLat([pos.lng, pos.lat]).addTo(st.map);
    /* also update trail dot colour */
    if (st.map.getLayer('trail-dots')) {
      st.map.setPaintProperty('trail-dots', 'circle-color', SVC_COLORS[service] || '#10B981');
    }
  }, [service]);

  /* ── Render ── */
  if (!TOKEN || mapError) {
    return (
      <div style={{ height }} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 flex flex-col items-center justify-center gap-2">
        <AlertCircle size={20} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-500">
          {!TOKEN ? 'Map token not configured' : 'Map temporarily unavailable'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-100">
      {!mapReady && (
        <div className="lt2-skeleton absolute inset-0 bg-slate-100 z-10 rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center ring-1 ring-slate-300">
              <div className="w-5 h-5 rounded-full bg-blue-400" />
            </div>
            <div className="w-28 h-2 rounded-full bg-slate-200" />
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ opacity: mapReady ? 1 : 0, transition: 'opacity 0.5s ease' }}
      />
    </div>
  );
}
