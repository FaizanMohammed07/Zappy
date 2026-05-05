import { useCallback, useState } from 'react';
import { saveGeoLocation, loadGeoLocation } from '../utils/geoCache';

export { loadGeoLocation };

const OPTS_ONE  = { enableHighAccuracy: true, timeout: 5000,  maximumAge: 0     };
const OPTS_WATCH = { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000  };

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const getCurrent = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        saveGeoLocation(loc);
        resolve(loc);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        reject(err);
      },
      OPTS_ONE,
    );
  }), []);

  const watch = useCallback((onPos, onErr) => {
    if (!navigator.geolocation) return () => {};
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        saveGeoLocation(loc);
        onPos(loc);
      },
      (err) => onErr?.(err),
      OPTS_WATCH,
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { getCurrent, watch, loading, error };
}
