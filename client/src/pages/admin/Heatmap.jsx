import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAdminGeoAnalyticsQuery, useAdminDemandPatternsQuery, useAdminLiveOpsQuery } from '../../services/api';
import { SectionHeader, Card, PageLoader } from './_shared';
import {
  Flame, IndianRupee, XCircle, Users, TrendingUp, Clock,
  Calendar, CheckCircle2, AlertTriangle, MapPin, ArrowUp, ArrowDown,
} from 'lucide-react';

const MAPBOX_TOKEN  = import.meta.env.VITE_MAPBOX_TOKEN || '';
const GMAPS_KEY     = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

const INDIA_CENTER = [78.9629, 20.5937];
const INDIA_ZOOM   = 4.5;
const SERVICES     = ['all', 'puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair', 'cleaning', 'painting'];
const DAY_OPTIONS  = [7, 14, 30, 60, 90];
const DOW_LABELS   = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const VIEWS = [
  { id: 'demand',  label: 'Demand Heatmap',   Icon: Flame,       color: '#f97316', desc: 'Order density — hottest areas = most bookings' },
  { id: 'revenue', label: 'Revenue Zones',    Icon: IndianRupee, color: '#2563eb', desc: 'Revenue per zone — blue intensity = earnings' },
  { id: 'cancel',  label: 'Cancel Rate',      Icon: XCircle,     color: '#dc2626', desc: 'Cancel rate — red circles = problem zones' },
  { id: 'workers', label: 'Live Workers',     Icon: Users,       color: '#10b981', desc: 'Live worker positions from GPS' },
];

const SERVICE_COLORS = {
  puncture: '#ef4444', plumbing: '#3b82f6', electrical: '#eab308',
  helper: '#6b7280', carpenter: '#f59e0b', ac_repair: '#06b6d4',
  cleaning: '#22c55e', painting: '#a855f7',
};

// ── Browser-side reverse geocoding with in-memory cache ────────────────────
const _geocodeCache = {};
async function reverseGeocodeBrowser(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (_geocodeCache[key]) return _geocodeCache[key];
  if (!GMAPS_KEY) return key;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=sublocality%7Clocality&key=${GMAPS_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results[0]) {
      const comps = data.results[0].address_components;
      const pick  = (...types) => types.map(t => comps.find(c => c.types.includes(t))?.long_name).find(Boolean);
      const sub   = pick('sublocality_level_1', 'sublocality', 'neighborhood');
      const city  = pick('locality', 'administrative_area_level_2');
      const label = [sub, city].filter(Boolean).join(', ')
        || data.results[0].formatted_address.split(',').slice(0, 2).join(', ').trim();
      _geocodeCache[key] = label;
      return label;
    }
  } catch (_) {}
  _geocodeCache[key] = key;
  return key;
}

// ── Hooks ──────────────────────────────────────────────────────────────────
function useZoneNames(zones) {
  const [names, setNames] = useState({});
  useEffect(() => {
    if (!zones?.length) return;
    const unresolved = zones.filter(z => !names[`${z.lat},${z.lng}`]);
    if (!unresolved.length) return;
    Promise.all(
      unresolved.map(async z => {
        // Use server-resolved name first, fall back to browser geocoding
        const serverName = z.name && !z.name.includes(',') === false && !/^\d/.test(z.name) ? z.name : null;
        const resolved   = serverName || await reverseGeocodeBrowser(z.lat, z.lng);
        return [`${z.lat},${z.lng}`, resolved];
      })
    ).then(entries => {
      setNames(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [zones]);
  return names;
}

// ── Map Layer Hook ─────────────────────────────────────────────────────────
function useMapLayers(mapRef, cells, workerLocations, view) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const cellGeo = {
      type: 'FeatureCollection',
      features: (cells || []).map(c => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          total: c.total, revenue: c.revenue, cancelRate: c.cancelRate,
          completed: c.completed, name: c.displayName || '',
          completionRate: c.completionRate || 0,
        },
      })),
    };
    const workerGeo = {
      type: 'FeatureCollection',
      features: (workerLocations || []).map(w => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: { id: w.id },
      })),
    };

    ['cells', 'workers'].forEach(src => {
      if (map.getSource(src)) map.getSource(src).setData(src === 'cells' ? cellGeo : workerGeo);
      else map.addSource(src, { type: 'geojson', data: src === 'cells' ? cellGeo : workerGeo });
    });

    ['heatmap-layer', 'circles-layer', 'workers-layer'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });

    const maxRev = Math.max(...(cells || []).map(c => c.revenue), 1);

    if (view === 'demand') {
      map.addLayer({ id: 'heatmap-layer', type: 'heatmap', source: 'cells', paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'total'], 0, 0, 50, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 3],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,255,0)', 0.15, '#fde68a', 0.4, '#fb923c', 0.7, '#ea580c', 1, '#7c2d12'],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 9, 35, 12, 55],
        'heatmap-opacity': 0.88,
      }});
      map.addLayer({ id: 'circles-layer', type: 'circle', source: 'cells', minzoom: 8, paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 1, 6, 200, 40],
        'circle-color': ['interpolate', ['linear'], ['get', 'total'], 1, '#fed7aa', 50, '#f97316', 200, '#7c2d12'],
        'circle-opacity': 0.75, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
      }});
    } else if (view === 'revenue') {
      map.addLayer({ id: 'heatmap-layer', type: 'heatmap', source: 'cells', paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'revenue'], 0, 0, maxRev, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 3],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,255,0)', 0.2, '#bfdbfe', 0.5, '#3b82f6', 0.8, '#1d4ed8', 1, '#1e3a8a'],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 9, 35, 12, 55],
        'heatmap-opacity': 0.88,
      }});
      map.addLayer({ id: 'circles-layer', type: 'circle', source: 'cells', minzoom: 7, paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'revenue'], 0, 5, maxRev, 38],
        'circle-color': ['interpolate', ['linear'], ['get', 'revenue'], 0, '#dbeafe', maxRev * 0.3, '#3b82f6', maxRev, '#1e3a8a'],
        'circle-opacity': 0.8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
      }});
    } else if (view === 'cancel') {
      map.addLayer({ id: 'circles-layer', type: 'circle', source: 'cells', filter: ['>=', ['get', 'total'], 2], paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 1, 8, 100, 40],
        'circle-color': ['interpolate', ['linear'], ['get', 'cancelRate'],
          0, '#dcfce7', 15, '#fef9c3', 30, '#fed7aa', 50, '#fca5a5', 70, '#dc2626'],
        'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
      }});
    } else if (view === 'workers') {
      map.addLayer({ id: 'circles-layer', type: 'circle', source: 'cells', paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 1, 4, 50, 22],
        'circle-color': '#f97316', 'circle-opacity': 0.2,
      }});
      map.addLayer({ id: 'workers-layer', type: 'circle', source: 'workers', paint: {
        'circle-radius': 9, 'circle-color': '#10b981', 'circle-opacity': 0.9,
        'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
      }});
    }

    const onClick = (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['circles-layer', 'workers-layer'] });
      if (!features.length) return;
      const p = features[0].properties;
      const isWorker = features[0].layer.id === 'workers-layer';
      if (isWorker) {
        new mapboxgl.Popup({ closeButton: true, maxWidth: '180px' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:system-ui;font-size:12px"><b style="color:#10b981">● Online</b><br/><span style="color:#6b7280;font-size:11px">Worker ${String(p.id).slice(-6)}</span></div>`)
          .addTo(map);
        return;
      }
      new mapboxgl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:system-ui;font-size:12px;line-height:1.8">
            ${p.name ? `<b style="font-size:13px;display:block;margin-bottom:4px;color:#111">${p.name}</b>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin-top:4px">
              <span style="color:#6b7280">Orders</span><b>${p.total || 0}</b>
              <span style="color:#6b7280">Completed</span><b style="color:#16a34a">${p.completed || 0} (${p.completionRate || 0}%)</b>
              <span style="color:#6b7280">Cancel rate</span><b style="color:${(p.cancelRate || 0) > 40 ? '#dc2626' : '#374151'}">${p.cancelRate || 0}%</b>
              <span style="color:#6b7280">Revenue</span><b>₹${Math.round(p.revenue || 0).toLocaleString('en-IN')}</b>
            </div>
          </div>
        `)
        .addTo(map);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [cells, workerLocations, view, mapRef]);
}

// ── MapView component ──────────────────────────────────────────────────────
function MapView({ cells, workerLocations, view, isLoading }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: INDIA_CENTER, zoom: INDIA_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl());
    map.on('load', () => { mapRef.current = map; setReady(true); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useMapLayers(mapRef, ready ? cells : [], ready ? workerLocations : [], view);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 500 }}>
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-slate-900/80 text-white text-sm font-semibold px-4 py-2 rounded-lg animate-pulse">Updating map…</div>
        </div>
      )}
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Add VITE_MAPBOX_TOKEN to .env.local</p>
        </div>
      )}
    </div>
  );
}

// ── Rich Zone Card ─────────────────────────────────────────────────────────
function ZoneCard({ zone, rank, metric, nameMap }) {
  const coordKey = `${zone.lat},${zone.lng}`;
  const name     = nameMap[coordKey] || zone.name || coordKey;
  const isCoord  = /^\d+\.\d+,\s*\d+/.test(name);

  const mainVal  = metric === 'revenue'
    ? `₹${Math.round(zone.revenue).toLocaleString('en-IN')}`
    : metric === 'cancelRate'
      ? `${zone.cancelRate}%`
      : zone.total;

  const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
  const rankBg     = ['bg-amber-50 border-amber-200', 'bg-slate-50 border-slate-200', 'bg-orange-50 border-orange-100'];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition hover:shadow-sm ${rank < 3 ? rankBg[rank] : 'bg-white border-slate-100'}`}>
      {/* Rank */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-extrabold text-xs ${rank < 3 ? rankColors[rank] : 'text-slate-400'}`}>
        {rank + 1}
      </div>

      <div className="flex-1 min-w-0">
        {/* Area name */}
        <p className="text-sm font-bold text-slate-800 truncate leading-tight" title={name}>
          {isCoord ? <span className="font-mono text-xs text-slate-500">{name}</span> : name}
        </p>

        {/* Sub-stats row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {metric !== 'total' && (
            <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
              <MapPin size={9} />{zone.total} orders
            </span>
          )}
          <span className="text-[11px] text-emerald-600 flex items-center gap-0.5">
            <CheckCircle2 size={9} />{zone.completionRate || Math.round(zone.completed / Math.max(zone.total, 1) * 100)}%
          </span>
          {metric !== 'cancelRate' && zone.cancelRate > 0 && (
            <span className={`text-[11px] flex items-center gap-0.5 ${zone.cancelRate > 40 ? 'text-red-500' : 'text-slate-400'}`}>
              <XCircle size={9} />{zone.cancelRate}% cancel
            </span>
          )}
          {metric !== 'revenue' && zone.revenue > 0 && (
            <span className="text-[11px] text-blue-600 font-semibold">
              ₹{Math.round(zone.revenue).toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>

      {/* Main value */}
      <div className="text-right shrink-0">
        <p className={`font-extrabold text-sm tabular-nums ${metric === 'cancelRate' && zone.cancelRate > 50 ? 'text-red-600' : metric === 'revenue' ? 'text-blue-700' : 'text-slate-900'}`}>
          {mainVal}
        </p>
      </div>
    </div>
  );
}

function ZoneList({ title, Icon, zones, metric, nameMap, iconColor }) {
  if (!zones?.length) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className={iconColor} />
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <span className="text-[10px] text-slate-400 ml-auto">{zones.length} zones</span>
      </div>
      <div className="space-y-1.5">
        {zones.slice(0, 8).map((z, i) => (
          <ZoneCard key={`${z.lat},${z.lng}`} zone={z} rank={i} metric={metric} nameMap={nameMap} />
        ))}
      </div>
    </Card>
  );
}

// ── Hourly chart ───────────────────────────────────────────────────────────
function HourlyChart({ data = [] }) {
  const all24 = Array.from({ length: 24 }, (_, h) => {
    const found = data.find(d => d.hour === h);
    return { value: found?.orders || 0, hour: h };
  });
  const max    = Math.max(...all24.map(d => d.value), 1);
  const peakH  = all24.reduce((m, d) => d.value > (m?.value || 0) ? d : m, null);
  const NIGHT  = new Set([0, 1, 2, 3, 4, 5, 22, 23]);
  const MORN   = new Set([6, 7, 8, 9, 10, 11]);

  return (
    <div>
      <div className="flex items-end gap-px" style={{ height: 72 }}>
        {all24.map((d) => {
          const isPeak = d.hour === peakH?.hour;
          const col    = isPeak ? '#f97316' : NIGHT.has(d.hour) ? '#475569' : MORN.has(d.hour) ? '#6366f1' : '#3b82f6';
          return (
            <div key={d.hour} className="flex-1 flex flex-col justify-end group relative" style={{ height: '100%' }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10 shadow-lg">
                {d.hour}:00–{d.hour + 1}:00<br/>{d.value} orders
              </div>
              <div className="w-full rounded-sm transition-all" style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: col, opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {['12am', '6am', '12pm', '6pm', '11pm'].map(l => <span key={l} className="text-[9px] text-slate-400">{l}</span>)}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-orange-500" /> Peak hour</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-indigo-500" /> Morning</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-slate-500" /> Night</span>
      </div>
      {peakH && <p className="text-xs text-orange-600 font-bold mt-1.5">Peak: {peakH.hour}:00 ({peakH.value} orders)</p>}
    </div>
  );
}

function DowChart({ data = [] }) {
  const all7 = Array.from({ length: 7 }, (_, i) => {
    const d = data.find(d => d.dow === i + 1);
    return { label: DOW_LABELS[i + 1], value: d?.orders || 0, dow: i + 1 };
  });
  const max  = Math.max(...all7.map(d => d.value), 1);
  const peak = all7.reduce((m, d) => d.value > (m?.value || 0) ? d : m, null);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 64 }}>
        {all7.map(d => (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            <div className="w-full rounded-sm transition-all"
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: d.dow === peak?.dow ? '#f97316' : '#8b5cf6', opacity: 0.8 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {all7.map(d => <span key={d.label} className={`flex-1 text-center text-[10px] font-semibold ${d.dow === peak?.dow ? 'text-orange-500' : 'text-slate-400'}`}>{d.label}</span>)}
      </div>
      {peak && <p className="text-xs text-orange-600 font-bold mt-1.5">Busiest: {peak.label} ({peak.value} orders)</p>}
    </div>
  );
}

function ServiceBreakdown({ data = [] }) {
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  return (
    <div className="space-y-2.5">
      {data.map(s => {
        const pct      = Math.round((s.total / total) * 100);
        const cancelPct = s.total > 0 ? Math.round((s.cancelled / s.total) * 100) : 0;
        const col       = SERVICE_COLORS[s.service] || '#94a3b8';
        return (
          <div key={s.service}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                <span className="text-xs font-semibold text-slate-700 capitalize">{s.service?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">{s.total} orders</span>
                <span className="font-bold text-slate-800">₹{s.revenue?.toLocaleString('en-IN')}</span>
                <span className="text-slate-400">avg ₹{s.avgFare}</span>
              </div>
            </div>
            <div className="flex bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="h-2.5 transition-all" style={{ width: `${s.completionRate}%`, backgroundColor: col, opacity: 0.8 }} title={`Completed: ${s.completionRate}%`} />
              <div className="h-2.5 bg-red-400 transition-all" style={{ width: `${cancelPct}%` }} title={`Cancelled: ${cancelPct}%`} />
            </div>
            <div className="flex justify-between text-[10px] mt-0.5">
              <span className="text-slate-400">{pct}% of orders</span>
              <span className={cancelPct > 30 ? 'text-red-500 font-semibold' : 'text-slate-400'}>{cancelPct}% cancel</span>
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 pt-2 border-t border-slate-50 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block rounded-sm bg-blue-500 opacity-80" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block rounded-sm bg-red-400" /> Cancelled</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Heatmap() {
  const [view, setView]       = useState('demand');
  const [days, setDays]       = useState(30);
  const [service, setService] = useState('all');
  const [tab, setTab]         = useState('zones');

  const { data: geoData, isLoading: geoLoading } = useAdminGeoAnalyticsQuery({ days, service });
  const { data: patData, isLoading: patLoading } = useAdminDemandPatternsQuery({ days, service });
  const { data: liveData }                        = useAdminLiveOpsQuery(undefined, { pollingInterval: 30000 });

  const rawCells   = geoData?.cells || [];
  const workerLocs = liveData?.workerLocations || [];
  const topZones   = geoData?.topZones || {};

  // All unique zones that need names (top lists + cells with server name)
  const allNamedZones = useMemo(() => [
    ...(topZones.byDemand  || []),
    ...(topZones.byRevenue || []),
    ...(topZones.byCancel  || []),
  ], [topZones]);

  const nameMap = useZoneNames(allNamedZones);

  // Enrich cells with display names where known
  const cells = useMemo(() =>
    rawCells.map(c => {
      const k = `${c.lat},${c.lng}`;
      return { ...c, displayName: nameMap[k] || c.name || null };
    }),
    [rawCells, nameMap]
  );

  const currentViewMeta = VIEWS.find(v => v.id === view);
  const totalOrders  = geoData?.totalOrders || 0;
  const totalRevenue = geoData?.totalRevenue || 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Geographic Intelligence"
        subtitle={geoData
          ? `${totalOrders.toLocaleString('en-IN')} orders · ₹${totalRevenue.toLocaleString('en-IN')} revenue · ${cells.length} zones mapped`
          : 'Loading…'}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <select value={service} onChange={e => setService(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 capitalize">
            {SERVICES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Services' : s.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="flex gap-1">
            {DAY_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${days === d ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </SectionHeader>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders',    value: totalOrders.toLocaleString('en-IN'),             Icon: MapPin,       color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'Total Revenue',   value: `₹${totalRevenue.toLocaleString('en-IN')}`,       Icon: IndianRupee,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Zones Mapped',    value: cells.length,                                      Icon: TrendingUp,   color: 'text-violet-600',  bg: 'bg-violet-50' },
          { label: 'Live Workers',    value: liveData?.counts?.onlineWorkers || 0,              Icon: Users,        color: 'text-orange-600',  bg: 'bg-orange-50' },
        ].map(({ label, value, Icon, color, bg }) => (
          <Card key={label} className="p-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{value}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Map layer selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {VIEWS.map(v => {
          const Icon     = v.Icon;
          const isActive = view === v.id;
          return (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition shadow-sm ${
                isActive ? 'text-white border-transparent shadow-md' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
              }`}
              style={isActive ? { backgroundColor: v.color } : {}}
            >
              <Icon size={13} />
              {v.label}
              {v.id === 'workers' && liveData?.counts?.onlineWorkers != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25' : 'bg-emerald-50 text-emerald-700'}`}>
                  {liveData.counts.onlineWorkers} live
                </span>
              )}
            </button>
          );
        })}
        <span className="text-xs text-slate-400 ml-1 hidden sm:inline">{currentViewMeta?.desc}</span>
      </div>

      {/* Map */}
      <MapView cells={cells} workerLocations={workerLocs} view={view} isLoading={geoLoading} />

      {/* Legend */}
      {view !== 'workers' && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            {view === 'cancel' ? 'Cancel rate' : view === 'revenue' ? 'Revenue' : 'Order volume'}:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Low</span>
            <div className="w-24 h-2.5 rounded-full" style={{
              background: view === 'cancel'
                ? 'linear-gradient(to right, #dcfce7, #fef9c3, #fca5a5, #dc2626)'
                : view === 'revenue'
                  ? 'linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6, #1e3a8a)'
                  : 'linear-gradient(to right, #fde68a, #f97316, #c2410c, #7c2d12)',
            }} />
            <span className="text-[10px] text-slate-400">High</span>
          </div>
          <span className="text-[10px] text-slate-400 ml-1">Click any circle for details</span>
        </div>
      )}

      {/* Data tabs */}
      <div className="flex gap-0 border-b border-slate-100">
        {[
          { id: 'zones',    label: 'Top & Worst Zones', Icon: MapPin },
          { id: 'patterns', label: 'Demand Patterns',   Icon: Clock },
          { id: 'services', label: 'Service Breakdown', Icon: TrendingUp },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Zones tab */}
      {tab === 'zones' && (
        <div className="grid sm:grid-cols-3 gap-4">
          <ZoneList title="Top Demand Zones" Icon={Flame}       zones={topZones.byDemand}  metric="total"      nameMap={nameMap} iconColor="text-orange-500" />
          <ZoneList title="Top Revenue Zones" Icon={IndianRupee} zones={topZones.byRevenue} metric="revenue"    nameMap={nameMap} iconColor="text-blue-500" />
          <ZoneList title="Worst Cancel Zones" Icon={AlertTriangle} zones={topZones.byCancel} metric="cancelRate" nameMap={nameMap} iconColor="text-red-500" />
        </div>
      )}

      {/* Patterns tab */}
      {tab === 'patterns' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-slate-500" />
                <p className="text-sm font-bold text-slate-700">Orders by Hour of Day (IST)</p>
              </div>
              <p className="text-xs text-slate-400 mb-4">Plan worker shifts for peak demand windows</p>
              {patLoading ? <div className="h-20 bg-slate-50 rounded-lg animate-pulse" /> : <HourlyChart data={patData?.hourly} />}
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-slate-500" />
                <p className="text-sm font-bold text-slate-700">Orders by Day of Week</p>
              </div>
              <p className="text-xs text-slate-400 mb-4">Weekly demand pattern — plan supply accordingly</p>
              {patLoading ? <div className="h-16 bg-slate-50 rounded-lg animate-pulse" /> : <DowChart data={patData?.byDow} />}
            </Card>
          </div>

          {patData && (
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-4">Operations Intelligence</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {[
                  { label: 'Peak Hour (IST)',   value: patData.peakHour != null ? `${patData.peakHour}:00` : '—', sub: 'highest demand', Icon: ArrowUp, color: 'text-orange-500' },
                  { label: 'Busiest Day',       value: DOW_LABELS[patData.peakDow] || '—',                        sub: 'most bookings',  Icon: Calendar, color: 'text-violet-500' },
                  { label: 'Total Orders',      value: (patData.byDay?.reduce((s, d) => s + d.orders, 0) || 0).toLocaleString('en-IN'), sub: `in ${days} days`, Icon: TrendingUp, color: 'text-blue-500' },
                  { label: 'Avg Daily Orders',  value: patData.byDay?.length > 0 ? Math.round(patData.byDay.reduce((s, d) => s + d.orders, 0) / patData.byDay.length) : '—', sub: 'orders/day', Icon: ArrowDown, color: 'text-emerald-500' },
                ].map(({ label, value, sub, Icon, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                      <Icon size={18} className={color} />
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">{value}</p>
                      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Services tab */}
      {tab === 'services' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">Service Order Mix & Completion Rate</p>
            {patLoading ? <div className="h-40 bg-slate-50 rounded-lg animate-pulse" /> : <ServiceBreakdown data={patData?.byService || []} />}
          </Card>
          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">Revenue & Avg Fare by Service</p>
            <div className="space-y-2">
              {(patData?.byService || []).map((s, i) => {
                const col = SERVICE_COLORS[s.service] || '#94a3b8';
                return (
                  <div key={s.service} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col }} />
                      <span className="text-xs font-semibold text-slate-700 capitalize truncate">{s.service?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-slate-800">₹{s.revenue?.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">avg ₹{s.avgFare}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
