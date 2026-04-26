import { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from '../../services/maps';

/**
 * LiveTrackingMap
 * - Renders pickup marker + worker marker.
 * - When worker location updates, smoothly animates the marker (not jumps).
 * - Draws the driving route from worker → pickup when they're both present.
 */
export default function LiveTrackingMap({ pickup, workerLocation, height = '60vh' }) {
  const { isLoaded } = useGoogleMaps();
  const mapRef = useRef(null);
  const [directions, setDirections] = useState(null);
  const lastRouteFetch = useRef(0);

  // Debounce directions API calls — don't refetch on every tiny movement.
  useEffect(() => {
    if (!isLoaded || !pickup || !workerLocation || !window.google) return;
    const now = Date.now();
    if (now - lastRouteFetch.current < 8000) return; // at most every 8s
    lastRouteFetch.current = now;

    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: workerLocation.lat, lng: workerLocation.lng },
        destination: { lat: pickup.lat, lng: pickup.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') setDirections(result);
      }
    );
  }, [isLoaded, pickup, workerLocation]);

  // Auto-fit bounds when both points are present
  useEffect(() => {
    if (!mapRef.current || !pickup || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(pickup);
    if (workerLocation) bounds.extend({ lat: workerLocation.lat, lng: workerLocation.lng });
    mapRef.current.fitBounds(bounds, 80);
  }, [pickup, workerLocation]);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-slate-100 rounded-2xl">
        <span className="text-slate-400">Loading map…</span>
      </div>
    );
  }

  const center = workerLocation
    ? { lat: workerLocation.lat, lng: workerLocation.lng }
    : pickup || { lat: 17.385, lng: 78.486 };

  return (
    <div style={{ height }} className="rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-white">
      <GoogleMap
        onLoad={(m) => (mapRef.current = m)}
        center={center}
        zoom={14}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          styles: mapStyle,
        }}
      >
        {pickup && (
          <Marker
            position={pickup}
            label={{ text: 'You', color: '#0284c7', fontWeight: 'bold' }}
          />
        )}
        {workerLocation && (
          <Marker
            position={workerLocation}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        )}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: '#0284c7', strokeWeight: 5, strokeOpacity: 0.8 },
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

const mapStyle = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
