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
  in reserve for when a genuine native-plugin need shows up (biometric
  confirm on burns, secure keystore, etc.) that a TWA cannot host — note
  push notifications are *not* such a case: the TWA (real Chrome) already
  supports standard Web Push with no plugin. See "Push notifications" below.
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

## Push notifications (e.g. anniversary reminders) don't require Capacitor

A recurring "anniversary reminder" notification is a **Web Push** feature,
not something that requires either native shell:

| Platform | Does Web Push work? | Native shell needed? |
|----------|---------------------|-----------------------|
| Android — Chrome, or the TWA (real Chrome) | Yes, today, no install required | No — standard Push API + service worker, same code as desktop |
| iOS — Safari, **only if added to the Home Screen** and launched from that icon | Yes, since iOS 16.4 (2023) | No — but only reaches users who installed the PWA; a plain Safari tab can never subscribe |
| iOS — inside the Capacitor app (WKWebView) | **No** — Apple explicitly does not expose the Push API inside WKWebView, installed-PWA or not | Would need a *separate* native integration: `@capacitor/push-notifications` (or `@capacitor-firebase/messaging`) talking to APNs, its own Apple Developer "Push Notifications" capability + `.p8` auth key, and server-side code that posts to APNs/FCM instead of (or alongside) plain VAPID Web Push |

So: **Capacitor is not required to ship this feature.** Implementing
standard Web Push (VAPID keys + `PushManager.subscribe()` + a service-worker
`push` event handler + a small backend that stores subscriptions per
altar/dedication and sends at the right time) covers Android completely and
covers iOS for any user who has installed the PWA to their Home Screen —
which the app already nudges toward via `handle_links`/`launch_handler` in
the manifest. Real-world reach on iOS is meaningfully smaller than native
push because of that install step (industry estimates put it roughly an
order of magnitude lower), but this is a low-stakes, non-time-critical
reminder, not an OTP or urgent alert, so the trade-off is reasonable to
start with.

Capacitor's `apps/mobile` scaffold only becomes *useful* for push if you
later decide the iOS reach gap is unacceptable and want to reach iOS users
who never install the PWA — that would mean standing up native APNs (Apple
Developer Push capability, `.p8` key, App Store review) in addition to, not
instead of, the Web Push path already needed for Android/installed-iOS.

Recommended order: build Web Push first (one implementation, works on
Android + installed-iOS PWA, no store review, no Apple Developer Program
needed at all); revisit native APNs via Capacitor only if iOS reach proves
insufficient in practice.

## Per-device daily offer limit: neither PWA nor TWA strengthen `installId`

`apps/mint-api` caps offers per day per `installId`
(`MAX_OFFERS_PER_DAY`, see `apps/mint-api/src/offer.ts`). The web app
generates that id once with `crypto.randomUUID()` and persists it in
`localStorage` (`getOrCreateInstallId()`, `apps/web/src/lib/config.ts`) — the
server just trusts whatever 8–128 char string the client sends
(`requireInstallId()`); there's no cryptographic binding to a real device.

**Neither shell changes this:**

- **PWA** — this *is* the current mechanism. `localStorage` is per-origin,
  per-browser-profile storage: trivially reset by clearing site data, private
  browsing, a different browser on the same phone, or simply POSTing a fresh
  random string directly to the API. There's no web-platform API for a
  install-scoped id stronger than this.
- **TWA** — gives **nothing extra by default**. A stock Bubblewrap TWA isn't
  a WebView with a native bridge; it launches the device's real installed
  Chrome via Custom Tabs and shares *that Chrome's* normal per-origin
  storage — the exact same `localStorage` the PWA already uses. There is no
  JS↔native bridge to read an Android-level id unless you fork the generated
  Android project into a custom WebView + `@JavascriptInterface` shim
  (defeats the "real Chrome, zero native code" rationale for choosing TWA in
  the first place — see the table at the top of this doc).
- **Capacitor** *can* do a bit better, but with real caveats: a plugin like
  `@capacitor/device` stores an app-generated random UUID in native storage
  (Android SharedPreferences / iOS Keychain) instead of the WebView's
  `localStorage`. The one genuinely stronger property: an iOS Keychain-backed
  id can survive an app **delete + reinstall** on the same device (unlike
  any web storage or an Android app's data, which is normally wiped on
  uninstall). It is still not a true hardware id — Google Play policy
  restricts raw persistent identifiers (`ANDROID_ID`, IMEI) for non-telephony
  apps, so Android plugins hand you the same kind of app-generated UUID,
  reset by "Clear app data" or uninstall/reinstall. And it only covers users
  who installed the Capacitor app — PWA/TWA users are unaffected either way.

**None of this is a hard security boundary, native or not** — a determined
abuser can always multi-device, multi-account, or use an emulator, regardless
of which shell they're using. The real scarcity mechanism this app already
has is the **Proof-of-Work cost per offer** (`apps/mint-api` challenge/submit
flow); the per-`installId` daily cap is a soft, good-faith UX guard against
casual re-offering, not the security boundary itself.

If real abuse of the daily cap shows up in practice, cheaper wins exist
before reaching for native identifiers:

- **IP-based secondary limiting** — nginx already forwards
  `X-Real-IP`/`X-Forwarded-For` to `apps/mint-api` for `/api/` (see
  `deploy/contabo/nginx-*.conf`); the server doesn't currently read it for
  rate limiting. Cheap to add (defeated by shared/dynamic IPs and VPNs, but
  catches the common "just clear localStorage" case for free).
- **`navigator.storage.persist()`** — reduces the chance the browser evicts
  `localStorage`/IndexedDB under storage pressure; does nothing against a
  user (or script) deliberately clearing/resetting it.
- Flag/soft-throttle `installId`s that are brand-new (created moments before
  their first challenge) as a heuristic, without claiming real device
  identity.

Only pursue Capacitor's native device-id plugins if there's evidence the
daily cap is being abused at meaningful scale by the same real users
reinstalling — and even then, budget for it only helping the fraction of
traffic that installs the native app, not PWA/TWA users.

## Not pursued: full native rewrite

A ground-up native app (Swift/Kotlin or React Native/Flutter) was considered
and rejected: it would duplicate the PoW-mining, wallet, and altar/offering
logic that already lives in `apps/web` in TypeScript, for no benefit over
wrapping the existing PWA — this product has no native-only requirement
(camera, Bluetooth, background execution, etc.) that a WebView-based shell
can't satisfy today.
