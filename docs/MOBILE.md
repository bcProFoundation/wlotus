# Mobile app strategy — TWA + Capacitor, side by side

`apps/web` is already a fully installable PWA (manifest, service worker,
home-screen icon, offline shell). Two lightweight native "shells" sit on top
of it for store distribution — no separate app codebase, no bundled copy of
the UI to keep in sync:

| Platform | Shell | Directory | Why |
|----------|-------|-----------|-----|
| Android (Play Store) | **TWA** (Trusted Web Activity, via Bubblewrap) | [`apps/twa`](../apps/twa/README.md) | Renders in the device's real Chrome — the same WebGPU/WASM/Worker PoW-mining engine already used in mobile Chrome, with zero native UI code to maintain. |
| iOS (App Store) | **Capacitor** | [`apps/mobile`](../apps/mobile/README.md) | There is no TWA-equivalent on iOS; Capacitor's WKWebView shell is the standard, only realistic route onto the App Store for an existing web app. |

Both shells point at the **live site** (`server.url` / TWA's `host` field —
not a bundled build), so every `npm run web:build` + deploy updates the
installed apps instantly with no store resubmission. Store review/signing is
only needed again when native-side config changes (icons, permissions,
target SDK bumps, plugin versions).

## Why both, rather than picking one

- They target **different, non-overlapping platforms in practice**: TWA is
  Android-only, Capacitor is the only path to iOS. Running both isn't
  redundant — iOS categorically requires Capacitor (or an equivalent
  WebView wrapper); nothing else exists for it.
- For **Android specifically**, `apps/mobile` also scaffolds an Android
  platform via Capacitor, but the TWA remains the one we intend to publish.
  Two live Play Store listings for the same product would confuse users and
  double the release/signing overhead. Keep the Capacitor Android platform
  in reserve for when a genuine native-plugin need shows up (push
  notifications, biometric confirm on burns, secure keystore, etc.) that a
  TWA cannot host; until then it's unpublished.
- Both shells are **inert config on top of the same web app** — no shared
  native code, no build coupling between them. Maintaining both costs
  nothing extra day-to-day.

## Shared prerequisites (already in place)

- HTTPS site with a valid PWA manifest and icon set (`apps/web/vite.config.ts`
  `VitePWA` config).
- Deep-link verification files served from the site root:
  - `apps/web/public/.well-known/assetlinks.json` — Android Digital Asset
    Links, required for the TWA to render full-screen instead of showing a
    Custom Tabs address bar. **Placeholder fingerprint — fill in per
    `apps/twa/README.md` before shipping.**
  - `apps/web/public/.well-known/apple-app-site-association` — iOS
    Universal Links, required for Capacitor's Associated Domains capability
    (tapping a `wlotus.org/<txid>` share link opens the app instead of
    Safari). **Placeholder Team ID — fill in per `apps/mobile/README.md`.**
  - Both are already served correctly by every `deploy/contabo/nginx-*.conf`
    (explicit `default_type application/json`, since stock nginx doesn't map
    `.json` and has no mapping at all for the extension-less AASA file).

## What's still needed to actually ship (outside this repo, one-time)

- **Android**: Android SDK/Studio to run `bubblewrap build`; a signing
  keystore (back it up — losing it blocks future updates to the same
  listing); a Google Play Developer account.
- **iOS**: a Mac with Xcode + CocoaPods to run `cap add ios`/`pod install`/
  archive; an Apple Developer Program membership; App Store Connect listing.

Neither toolchain is available in this Linux sandbox, so `apps/mobile/ios`
and `apps/mobile/android` were scaffolded here (file templates only) and
must be opened/built on machines with the respective SDKs — see each app's
README for exact commands.

## Not pursued: full native rewrite

A ground-up native app (Swift/Kotlin or React Native/Flutter) was considered
and rejected: it would duplicate the PoW-mining, wallet, and altar/offering
logic that already lives in `apps/web` in TypeScript, for no benefit over
wrapping the existing PWA — this product has no native-only requirement
(camera, Bluetooth, background execution, etc.) that a WebView-based shell
can't satisfy today.
