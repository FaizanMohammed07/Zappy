import { createSlice } from '@reduxjs/toolkit';

const KEY = 'qfx_auth_v2';

function loadInitial() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { accessToken: null, refreshToken: null, profile: null, role: null };
  } catch {
    return { accessToken: null, refreshToken: null, profile: null, role: null };
  }
}

const slice = createSlice({
  name: 'auth',
  initialState: loadInitial(),
  reducers: {
    setAuth: (state, { payload }) => {
      state.accessToken = payload.accessToken;
      state.refreshToken = payload.refreshToken;
      state.profile = payload.profile;
      state.role = payload.role;
      localStorage.setItem(KEY, JSON.stringify(state));
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.profile = null;
      state.role = null;
      localStorage.removeItem(KEY);
    },
    updateProfile: (state, { payload }) => {
      state.profile = { ...state.profile, ...payload };
      localStorage.setItem(KEY, JSON.stringify(state));
    },
  },
});

export const { setAuth, logout, updateProfile } = slice.actions;
export const selectAuth = (s) => s.auth;
export const selectIsAuthed = (s) => !!s.auth.accessToken;
export const selectRole = (s) => s.auth.role;
// Back-compat: some code reads `state.auth.token`. Provide a computed selector.
export const selectToken = (s) => s.auth.accessToken;
export default slice.reducer;
