import { useJsApiLoader } from '@react-google-maps/api';

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
export const GOOGLE_LIBRARIES = ['places', 'geometry'];

export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
}
