import type { CapacitorConfig } from '@capacitor/cli';

// Loads the live PWA instead of a bundled copy of apps/web/dist, so every
// `npm run web:build && deploy` to wlotus.org updates the store app instantly
// with no rebuild/resubmit — mirroring the TWA's always-live behaviour
// (see apps/twa/README.md). Switch `server.url` to a staging origin (or drop
// it and point `webDir` at a local build) to test against test.wlotus.org.
const config: CapacitorConfig = {
  appId: 'org.wlotus.app',
  appName: 'W Lotus',
  webDir: '../web/dist',
  server: {
    url: 'https://wlotus.org',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    // Real Android WebView (Chromium-based, auto-updates via Play Store) —
    // kept here only as an optional escape hatch for native-plugin work;
    // the primary Android store listing is the TWA in apps/twa (real Chrome,
    // no separate native shell to maintain). See apps/mobile/README.md.
    allowMixedContent: false,
  },
};

export default config;
