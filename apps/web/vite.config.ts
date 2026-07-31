import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    // Per-build id baked into the SW registration URL (?v=…) so every deploy
    // is a genuinely new request the browser has never cached — sidesteps
    // WebKit/Safari's unreliable HTTP-cache bypass on service-worker update
    // checks, which can otherwise pin an iPhone on an old JS/CSS bundle
    // indefinitely even with correct Cache-Control headers on sw.js.
    __WLOTUS_BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // App registers the SW itself (apps/web/src/lib/pwaUpdate.ts) with a
      // versioned URL — don't also auto-inject vite-plugin-pwa's own
      // registerSW.js script tag (its "auto" heuristic only skips injection
      // when it detects a `virtual:pwa-register` import, which we no longer
      // use now that registration is hand-rolled).
      injectRegister: false,
      includeAssets: [
        'images/wlotus.png',
        'images/wlotus-icon-32.png',
        'images/wlotus-icon-180.png',
        'images/wlotus-icon-192.png',
        'images/wlotus-icon-512.png',
        'images/wlotus-icon-maskable-512.png',
      ],
      manifest: {
        id: '/',
        name: 'W Lotus',
        short_name: 'W Lotus',
        description: 'Offer a lotus — memorial and dana on eCash',
        theme_color: '#0a0a0a',
        background_color: '#050505',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        // Installed Android PWA: in-scope https://wlotus.org/<txid> opens the
        // app (same path Universal Links / App Links will use for a store app).
        handle_links: 'preferred',
        launch_handler: {
          client_mode: 'navigate-existing',
        },
        icons: [
          {
            src: '/images/wlotus-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/wlotus-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/wlotus-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fresh check often so deploys land quickly on phones
        clientsClaim: true,
        skipWaiting: true,
        navigationPreload: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/index-api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/index-api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/index-api/, ''),
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
