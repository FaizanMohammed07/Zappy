import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

/**
 * Manages Mapbox GL layer lifecycle for the geo-intelligence heatmap.
 * Adds/removes/updates 'cells' and 'workers' sources and their layers
 * whenever cells, workerLocations, or view changes.
 */
export default function useMapLayers(mapRef, cells, workerLocations, view) {
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
  }, [cells, workerLocations, view]); // eslint-disable-line
}
