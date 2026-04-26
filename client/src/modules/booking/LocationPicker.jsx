import { useRef, useState, useEffect } from 'react';
import { GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from '../../services/maps';
import { useGeolocation } from '../../hooks/useGeolocation';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const DEFAULT_CENTER = { lat: 17.385044, lng: 78.486671 }; // Hyderabad fallback

/**
 * LocationPicker
 * - Tab 1: "Use current location" → browser geolocation + reverse geocode
 * - Tab 2: "Choose on map" → Places autocomplete + draggable marker pin
 *
 * onConfirm(location) fires with { lat, lng, address } when the user commits.
 */
export default function LocationPicker({ onConfirm, onCancel }) {
  const { isLoaded } = useGoogleMaps();
  const { getCurrent, loading: geoLoading } = useGeolocation();
  const [tab, setTab] = useState('current');
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [marker, setMarker] = useState(null); // { lat, lng }
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);

  // Auto-fetch current location on open (tab=current)
  useEffect(() => {
    if (tab !== 'current') return;
    (async () => {
      try {
        const pos = await getCurrent();
        setCenter(pos);
        setMarker(pos);
        await reverseGeocode(pos);
      } catch {
        toast.error('Could not get your location');
      }
    })();
     
  }, [tab]);

  async function reverseGeocode({ lat, lng }) {
    if (!window.google) return;
    setResolving(true);
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setResolving(false);
        if (status === 'OK' && results[0]) {
          setAddress(results[0].formatted_address);
          resolve(results[0].formatted_address);
        } else {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(fallback);
          resolve(fallback);
        }
      });
    });
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const pos = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };
    setCenter(pos);
    setMarker(pos);
    setAddress(place.formatted_address || place.name);
  }

  async function handleMapClick(e) {
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    setCenter(pos);
    await reverseGeocode(pos);
  }

  async function handleMarkerDragEnd(e) {
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    await reverseGeocode(pos);
  }

  function confirm() {
    if (!marker || !address) {
      toast.error('Please select a location');
      return;
    }
    onConfirm({ ...marker, address });
  }

  if (!isLoaded) {
    return (
      <div className="h-[70vh] flex items-center justify-center text-slate-500">
        Loading map…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-2 p-3 bg-white border-b border-slate-200">
        <TabButton active={tab === 'current'} onClick={() => setTab('current')}>
          📍 Use current
        </TabButton>
        <TabButton active={tab === 'manual'} onClick={() => setTab('manual')}>
          🔎 Choose on map
        </TabButton>
      </div>

      {/* Search (manual mode only) */}
      {tab === 'manual' && (
        <div className="p-3 bg-white border-b border-slate-200">
          <Autocomplete
            onLoad={(a) => (autocompleteRef.current = a)}
            onPlaceChanged={handlePlaceChanged}
          >
            <input
              type="text"
              placeholder="Search area, street, landmark…"
              className="input"
            />
          </Autocomplete>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          onLoad={(m) => (mapRef.current = m)}
          center={center}
          zoom={15}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          onClick={tab === 'manual' ? handleMapClick : undefined}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
          }}
        >
          {marker && (
            <Marker
              position={marker}
              draggable={tab === 'manual'}
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </GoogleMap>

        {tab === 'current' && (geoLoading || !marker) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="text-slate-600 font-medium">Fetching your location…</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 p-4 space-y-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Selected address</div>
          <div className="text-sm text-slate-900 min-h-[2.5rem]">
            {resolving ? 'Resolving…' : address || 'Tap the map to choose a spot'}
          </div>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="btn-secondary flex-1">
              Cancel
            </button>
          )}
          <button
            onClick={confirm}
            disabled={!marker || !address}
            className="btn-primary flex-1"
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition',
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
      )}
    >
      {children}
    </button>
  );
}
