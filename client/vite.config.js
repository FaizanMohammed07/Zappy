import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ── Dev server ──────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code !== 'ECONNABORTED' && err.code !== 'ECONNRESET') {
              console.error('[proxy error]', err);
            }
          });
        },
      },
    },
  },

  // ── Pre-bundle heavy ESM libs that Vite would otherwise re-transform ────
  optimizeDeps: {
    include: ['mapbox-gl'],
  },

  // ── Production build ────────────────────────────────────────────────────
  build: {
    // Target Android Chrome 85+ / iOS Safari 14+.
    // Chrome 80 (Android 8) is below this; Vite will transpile and polyfill.
    // Going below es2015 significantly increases bundle size — tradeoff accepted. (#66)
    target: ['chrome85', 'safari14', 'firefox90', 'edge88'],

    // Warn if any single chunk exceeds 500KB (default is 1500KB, too lax). (#70)
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // ── Manual chunks — keep large third-party libs in their own files ──
        // Browsers cache vendor chunks independently of app code.
        // A code change no longer busts the cached mapbox or firebase chunk. (#70)
        manualChunks: {
          // Map + location (largest single dep, ~330KB gzipped)
          'vendor-map':      ['mapbox-gl'],
          // Firebase (push notifications + FCM, ~180KB gzipped)
          'vendor-firebase': ['firebase/app', 'firebase/messaging'],
          // Animation engine
          'vendor-motion':   ['framer-motion'],
          // React core — almost never changes
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          // State management
          'vendor-redux':    ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },

    // Enable CSS code splitting so route chunks only load their own styles. (#70)
    cssCodeSplit: true,

    // Use esbuild minification (faster than terser, ships with Vite). (#70)
    minify: 'esbuild',

    // Strip console.log in production — reduces bundle + removes debug noise. (#70)
    esbuildOptions: {
      drop: ['console'],
    },
  },
});
