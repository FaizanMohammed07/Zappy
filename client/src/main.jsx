import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { setAuth } from './modules/auth/authSlice';
import App from './App';
import './styles/index.css';

/**
 * On page load / refresh the access token is gone (memory-only).
 * Hit /auth/refresh — the httpOnly RT cookie is sent automatically.
 * If it's valid we get a fresh access token and the session is restored silently.
 * If not (cookie expired, revoked) the user lands on the login page. (#78)
 */
async function restoreSession() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // send the httpOnly cookie
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.accessToken) {
      const profile = (() => {
        try { return JSON.parse(sessionStorage.getItem('zappy_profile_v2')); } catch { return null; }
      })();
      store.dispatch(setAuth({
        accessToken: data.accessToken,
        profile: profile,
        role: profile?.role ?? null,
      }));
    }
  } catch { /* network error — remain logged out */ }
}

function Root() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    restoreSession().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <Root />
    </Provider>
  </React.StrictMode>
);
