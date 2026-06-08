import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, X, Trash2, Check, Pencil, Loader2, Users, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAdminZonesQuery, useAdminCreateZoneMutation, useAdminUpdateZoneMutation,
  useAdminDeleteZoneMutation, useAdminZoneStatsQuery,
} from '../../services/api';
import { SectionHeader, Card, PageLoader, FormRow, Input, Select } from './_shared';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

const INDIA_CENTER = [78.9629, 20.5937];
const INDIA_ZOOM   = 4.5;

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#06B6D4'];
const STATUS_LABEL = { active: 'Active', coming_soon: 'Coming Soon', disabled: 'Disabled' };
const STATUS_BADGE = {
  active:      'bg-green-100 text-green-700',
  coming_soon: 'bg-amber-100 text-amber-700',
  disabled:    'bg-slate-100 text-slate-500',
};

const SERVICE_OPTIONS = [
  'screen_replacement', 'battery_replacement', 'puncture', 'car_wash', 'bike_wash',
  'car_service', 'bike_service', 'cctv_install', 'pet_grooming', 'event_helper',
];

function closeRing(pts) {
  // GeoJSON polygon ring must be closed (first === last).
  if (pts.length < 3) return null;
  const ring = pts.map((p) => [p.lng, p.lat]);
  const [f] = ring;
  const l = ring[ring.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]]);
  return [ring];
}

/* ─── Zone form drawer ──────────────────────────────────────────────────── */
function ZoneDrawer({ initial, coordinates, onClose, onSaved }) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState({
    name: initial?.name || '',
    city: initial?.city || '',
    description: initial?.description || '',
    status: initial?.status || 'active',
    surgeMultiplierOverride: initial?.surgeMultiplierOverride ?? '',
    pricingMultiplier: initial?.pricingMultiplier ?? 1.0,
    color: initial?.color || COLORS[0],
    disabledServices: initial?.disabledServices || [],
  });
  const [createZone, { isLoading: creating }] = useAdminCreateZoneMutation();
  const [updateZone, { isLoading: updating }] = useAdminUpdateZoneMutation();
  const busy = creating || updating;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function toggleService(s) {
    setForm((f) => ({
      ...f,
      disabledServices: f.disabledServices.includes(s)
        ? f.disabledServices.filter((x) => x !== s)
        : [...f.disabledServices, s],
    }));
  }

  async function save() {
    if (!form.name.trim() || !form.city.trim()) { toast.error('Name and city are required'); return; }

    const body = {
      name: form.name.trim(),
      city: form.city.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      surgeMultiplierOverride: form.surgeMultiplierOverride === '' ? null : Number(form.surgeMultiplierOverride),
      pricingMultiplier: Number(form.pricingMultiplier),
      color: form.color,
      disabledServices: form.disabledServices,
    };

    if (!isEdit) {
      const polygon = coordinates ? { type: 'Polygon', coordinates } : null;
      if (!polygon) { toast.error('Draw a polygon on the map first'); return; }
      body.polygon = polygon;
    } else if (coordinates) {
      body.polygon = { type: 'Polygon', coordinates };
    }

    try {
      if (isEdit) await updateZone({ id: initial._id, ...body }).unwrap();
      else await createZone(body).unwrap();
      toast.success(isEdit ? 'Zone updated' : 'Zone created');
      onSaved();
    } catch (e) {
      toast.error(e.data?.error || e.data?.details?.[0] || 'Save failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <p className="font-bold text-slate-900">{isEdit ? 'Edit Zone' : 'New Zone'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <FormRow label="Name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Whitefield" /></FormRow>
          <FormRow label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Bengaluru" /></FormRow>
          <FormRow label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="coming_soon">Coming Soon</option>
              <option value="disabled">Disabled</option>
            </Select>
          </FormRow>
          <FormRow label="Description">
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </FormRow>
          <FormRow label="Surge Override" hint="Leave empty to use global surge">
            <Input type="number" min="1" max="5" step="0.1" value={form.surgeMultiplierOverride}
              onChange={(e) => set('surgeMultiplierOverride', e.target.value)} placeholder="(global)" />
          </FormRow>
          <FormRow label="Pricing Multiplier" hint="1.0 = no change · 1.2 = 20% more expensive">
            <Input type="number" min="0.5" max="3" step="0.05" value={form.pricingMultiplier}
              onChange={(e) => set('pricingMultiplier', e.target.value)} />
          </FormRow>
          <FormRow label="Color">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)}
                  className={`w-8 h-8 rounded-lg transition ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </FormRow>
          <FormRow label="Disabled Services" hint="Services blocked in this zone">
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((s) => (
                <button key={s} onClick={() => toggleService(s)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${form.disabledServices.includes(s) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </FormRow>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={save} disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Zone'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Zone stats bar ────────────────────────────────────────────────────── */
function ZoneStats({ zoneId }) {
  const { data, isLoading } = useAdminZoneStatsQuery(zoneId);
  if (isLoading) return <div className="text-xs text-slate-400 px-4 py-3">Loading stats…</div>;
  if (!data) return null;
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-t border-slate-100">
      <div className="flex items-center gap-1.5">
        <Users size={14} className="text-emerald-500" />
        <span className="text-sm font-bold text-slate-800">{data.workerCount}</span>
        <span className="text-xs text-slate-400">online workers</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ShoppingBag size={14} className="text-blue-500" />
        <span className="text-sm font-bold text-slate-800">{data.recentOrders}</span>
        <span className="text-xs text-slate-400">orders (7d)</span>
      </div>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function Zones() {
  const { data, isLoading, refetch } = useAdminZonesQuery();
  const [deleteZone] = useAdminDeleteZoneMutation();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const drawPtsRef = useRef([]);
  const [drawCount, setDrawCount] = useState(0);
  const [drawer, setDrawer] = useState(null); // { initial, coordinates }

  const zones = data?.zones || [];
  const selected = zones.find((z) => z._id === selectedId) || null;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/light-v11', center: INDIA_CENTER, zoom: INDIA_ZOOM });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => { mapRef.current = map; setMapReady(true); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render existing zone polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const fc = {
      type: 'FeatureCollection',
      features: zones
        .filter((z) => z.polygon?.coordinates?.length)
        .map((z) => ({
          type: 'Feature',
          properties: { id: z._id, name: z.name, color: z.color || '#3B82F6', selected: z._id === selectedId },
          geometry: { type: 'Polygon', coordinates: z.polygon.coordinates },
        })),
    };

    if (map.getSource('zones')) {
      map.getSource('zones').setData(fc);
    } else {
      map.addSource('zones', { type: 'geojson', data: fc });
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 } });
      map.addLayer({
        id: 'zones-line', type: 'line', source: 'zones',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 4, 2] },
      });
      map.addLayer({ id: 'zones-label', type: 'symbol', source: 'zones', layout: { 'text-field': ['get', 'name'], 'text-size': 12 }, paint: { 'text-color': '#334155', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      map.on('click', 'zones-fill', (e) => {
        if (drawPtsRef.current.length) return; // ignore while drawing
        const id = e.features?.[0]?.properties?.id;
        if (id) setSelectedId(id);
      });
    }
  }, [zones, mapReady, selectedId, drawing]);

  // Draw-mode click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function ensureDrawLayers() {
      if (!map.getSource('draw')) {
        map.addSource('draw', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.2 } });
        map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', paint: { 'line-color': '#2563EB', 'line-width': 2, 'line-dasharray': [2, 1] } });
        map.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#2563EB', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      }
    }

    function renderDraw() {
      ensureDrawLayers();
      const pts = drawPtsRef.current;
      const features = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }));
      if (pts.length >= 3) {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...pts.map((p) => [p.lng, p.lat]), [pts[0].lng, pts[0].lat]]] } });
      } else if (pts.length === 2) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } });
      }
      map.getSource('draw').setData({ type: 'FeatureCollection', features });
    }

    function onClick(e) {
      drawPtsRef.current = [...drawPtsRef.current, { lng: e.lngLat.lng, lat: e.lngLat.lat }];
      setDrawCount(drawPtsRef.current.length);
      renderDraw();
    }
    function onDblClick(e) {
      e.preventDefault();
      finishDraw();
    }

    function finishDraw() {
      const coords = closeRing(drawPtsRef.current);
      if (!coords) { toast.error('Add at least 3 points'); return; }
      setDrawing(false);
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      map.doubleClickZoom.enable();
      setDrawer({ initial: null, coordinates: coords });
    }

    if (drawing) {
      map.doubleClickZoom.disable();
      map.on('click', onClick);
      map.on('dblclick', onDblClick);
      renderDraw();
      // expose finisher for the Complete button
      mapRef.current._finishDraw = finishDraw;
    }

    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
    };
  }, [drawing, mapReady]);

  function startDraw() {
    drawPtsRef.current = [];
    setDrawCount(0);
    setSelectedId(null);
    setDrawing(true);
  }
  function cancelDraw() {
    drawPtsRef.current = [];
    setDrawCount(0);
    setDrawing(false);
    const map = mapRef.current;
    if (map?.getSource('draw')) map.getSource('draw').setData({ type: 'FeatureCollection', features: [] });
  }
  function completeDraw() {
    if (mapRef.current?._finishDraw) mapRef.current._finishDraw();
  }

  function afterSaved() {
    setDrawer(null);
    cancelDraw();
    refetch();
  }

  async function handleDelete(z) {
    if (!window.confirm(`Delete zone "${z.name}"? This cannot be undone.`)) return;
    try {
      await deleteZone(z._id).unwrap();
      toast.success('Zone deleted');
      if (selectedId === z._id) setSelectedId(null);
      refetch();
    } catch (e) { toast.error(e.data?.error || 'Delete failed'); }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-5 space-y-5">
      <SectionHeader title="Zones & Geofences" subtitle={`${zones.length} zones · pricing, surge and availability by area`}>
        <button onClick={startDraw} disabled={drawing}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg transition">
          <Plus size={14} /> Add Zone
        </button>
      </SectionHeader>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left: list */}
        <div className="lg:col-span-2 space-y-2">
          {zones.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No zones yet. Click "Add Zone" to draw one.</p>}
          {zones.map((z) => (
            <button key={z._id} onClick={() => setSelectedId(z._id)}
              className={`w-full text-left bg-white rounded-xl border p-3 transition ${selectedId === z._id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: z.color || '#3B82F6' }} />
                  <p className="font-semibold text-slate-800 truncate">{z.name}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_BADGE[z.status]}`}>{STATUS_LABEL[z.status]}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{z.city}</p>
              <div className="flex gap-3 mt-2 text-[11px] text-slate-500">
                <span>Surge: {z.surgeMultiplierOverride ? `${z.surgeMultiplierOverride}×` : 'global'}</span>
                <span>Price: {z.pricingMultiplier}×</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: map */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="relative" style={{ height: 460 }}>
              <div ref={containerRef} className="w-full h-full" />
              {!MAPBOX_TOKEN && (
                <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                  <p className="text-slate-400 text-sm">Add VITE_MAPBOX_TOKEN to .env.local</p>
                </div>
              )}
              <AnimatePresence>
                {drawing && (
                  <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3">
                    <MapPin size={15} />
                    <span className="text-sm font-semibold">Drawing mode — click to add points ({drawCount})</span>
                    <button onClick={completeDraw} disabled={drawCount < 3}
                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 disabled:opacity-40 rounded-lg px-2 py-1 text-xs font-bold">
                      <Check size={12} /> Complete
                    </button>
                    <button onClick={cancelDraw} className="bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 text-xs font-bold">Cancel</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {selected && !drawing && (
              <>
                <ZoneStats zoneId={selected._id} />
                <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
                  <button onClick={() => setDrawer({ initial: selected, coordinates: null })}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(selected)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <ZoneDrawer
            initial={drawer.initial}
            coordinates={drawer.coordinates}
            onClose={() => { setDrawer(null); cancelDraw(); }}
            onSaved={afterSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
