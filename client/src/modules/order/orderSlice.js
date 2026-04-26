import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'order',
  initialState: {
    activeOrderId: null,
    status: null,
    workerLocation: null, // { lat, lng, at }
    workerInfo: null, // populated when assigned
    history: [], // status transitions received via socket
  },
  reducers: {
    setActiveOrder: (state, { payload }) => {
      state.activeOrderId = payload.orderId;
      state.status = payload.status;
      state.workerLocation = null;
      state.workerInfo = null;
      state.history = [];
    },
    clearActiveOrder: (state) => {
      state.activeOrderId = null;
      state.status = null;
      state.workerLocation = null;
      state.workerInfo = null;
      state.history = [];
    },
    setStatus: (state, { payload }) => {
      state.status = payload.status;
      state.history.push({ status: payload.status, at: payload.at || Date.now() });
    },
    setWorkerLocation: (state, { payload }) => {
      state.workerLocation = payload;
    },
    setWorkerInfo: (state, { payload }) => {
      state.workerInfo = payload;
    },
  },
});

export const {
  setActiveOrder,
  clearActiveOrder,
  setStatus,
  setWorkerLocation,
  setWorkerInfo,
} = slice.actions;

export const selectOrder = (s) => s.order;
export default slice.reducer;
