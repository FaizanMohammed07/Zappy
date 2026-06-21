import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ── Dev server ──────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
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
        manualChunks: {
          'vendor-map':      ['mapbox-gl'],
          'vendor-firebase': ['firebase/app', 'firebase/messaging'],
          'vendor-motion':   ['framer-motion'],
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux':    ['@reduxjs/toolkit', 'react-redux'],
          'vendor-ui':       ['lucide-react'],
        },
        // Content-hash filenames for aggressive long-term caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },

    // Enable CSS code splitting so route chunks only load their own styles. (#70)
    cssCodeSplit: true,

    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
    },
  },
});
