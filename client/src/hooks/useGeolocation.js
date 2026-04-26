import { useCallback, useState } from 'react';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrent = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
      );
    });
  }, []);

  /**
   * Watches continuously — returns a cancel function.
   */
  const watch = useCallback((onPos, onErr) => {
    if (!navigator.geolocation) return () => {};
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        onPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => onErr?.(err),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { getCurrent, watch, loading, error };
}
