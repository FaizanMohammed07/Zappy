import { createSlice } from '@reduxjs/toolkit';

const locationSlice = createSlice({
  name: 'location',
  initialState: {
    lat: null,
    lng: null,
    accuracy: null,
    resolvedAt: null,
  },
  reducers: {
    setLocation(state, { payload }) {
      state.lat       = payload.lat;
      state.lng       = payload.lng;
      state.accuracy  = payload.accuracy ?? null;
      state.resolvedAt = Date.now();
    },
    clearLocation(state) {
      state.lat = null;
      state.lng = null;
      state.accuracy = null;
      state.resolvedAt = null;
    },
  },
});

export const { setLocation, clearLocation } = locationSlice.actions;

export const selectLocation     = (s) => s.location;
export const selectHasLocation  = (s) => s.location.lat !== null && s.location.lng !== null;

export default locationSlice.reducer;
