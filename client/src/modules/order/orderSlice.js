import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'order',
  initialState: {
    activeOrderId:   null,
    status:          null,
    workerLocation:  null, // { lat, lng, at }
    workerInfo:      null,
    etaMinutes:      null,
    dispatchMessage: null, // live search-radius status ("Expanding to 3km…")
    history:         [],
  },
  reducers: {
    setActiveOrder: (state, { payload }) => {
      state.activeOrderId   = payload.orderId;
      state.status          = payload.status;
      state.workerLocation  = null;
      state.workerInfo      = null;
      state.dispatchMessage = null;
      state.history         = [];
    },
    clearActiveOrder: (state) => {
      state.activeOrderId   = null;
      state.status          = null;
      state.workerLocation  = null;
      state.workerInfo      = null;
      state.dispatchMessage = null;
      state.history         = [];
    },
    setStatus: (state, { payload }) => {
      state.status = payload.status;
      if (payload.status !== 'searching') state.dispatchMessage = null;
      state.history.push({ status: payload.status, at: payload.at || Date.now() });
    },
    setWorkerLocation: (state, { payload }) => {
      state.workerLocation = payload;
    },
    setWorkerInfo: (state, { payload }) => {
      state.workerInfo = payload;
    },
    setEta: (state, { payload }) => {
      state.etaMinutes = payload.minutes ?? null;
    },
    setDispatchMessage: (state, { payload }) => {
      state.dispatchMessage = payload.message ?? null;
    },
  },
});

export const {
  setActiveOrder,
  clearActiveOrder,
  setStatus,
  setWorkerLocation,
  setWorkerInfo,
  setEta,
  setDispatchMessage,
} = slice.actions;

export const selectOrder = (s) => s.order;
export default slice.reducer;
