# W Lotus — Android TWA (Trusted Web Activity)

Wraps the live `https://wlotus.org` PWA in a thin Android shell so it can be
listed on the Google Play Store. A TWA renders through the device's real
Chrome (or another installed Trusted Web Activity provider), not a generic
WebView, so WebGPU/WASM/Web Worker PoW mining behaves exactly as it does in
mobile Chrome today — there is effectively no native code to maintain here.

This is the **primary Android distribution path**. See `../mobile/README.md`
for why iOS uses Capacitor instead (there is no TWA equivalent on iOS), and
for when you might also want a Capacitor Android build (native plugins).

## What's committed here

- `twa-manifest.json` — Bubblewrap's project manifest, hand-written to match
  `apps/web` (`manifest.webmanifest`, icons, theme colors). This is the
  source of truth; regenerate the native Android project from it any time.

The generated Gradle/Android project (`android/` from `bubblewrap init`),
the signing keystore, and build output are **not** committed — see
`.gitignore` below and "One-time setup" for how to (re)create them locally.

## One-time environment setup (do this once, on any machine with Android
Studio / the Android SDK — this repo's cloud sandbox does not have one)

1. Install a JDK 17 (Bubblewrap's installer wants 17, not newer) and Android
   Studio (or just the command-line SDK tools + platform-tools + build-tools
   34+).
2. `npm i -g @bubblewrap/cli` (or run via `npx @bubblewrap/cli` each time).
3. From `apps/twa/`, initialize the native project from the manifest already
   committed here:
   ```bash
   cd apps/twa
   bubblewrap init --manifest=./twa-manifest.json
   ```
   Answer the JDK/Android SDK prompts (let Bubblewrap install its own copies
   if you don't already have compatible ones). This generates `android/` —
   a full Gradle project — next to this manifest.
4. Generate a signing keystore (interactive prompts):
   ```bash
   bubblewrap generateSigningKey
   ```
   **Back this file up.** Losing it means you can never update the same Play
   Store listing again.
5. Get the release-signing SHA-256 fingerprint and publish it as Android App
   Links / Digital Asset Links verification:
   ```bash
   keytool -list -v -keystore android.keystore -alias wlotus
   ```
   Copy the `SHA256:` fingerprint into
   `apps/web/public/.well-known/assetlinks.json` (`sha256_cert_fingerprints`)
   — replacing the `REPLACE_WITH_APK_SIGNING_CERT_SHA256_FINGERPRINT`
   placeholder — then deploy the web app so
   `https://wlotus.org/.well-known/assetlinks.json` serves the real value.
   Without this, Android shows a browser address bar instead of a full-screen
   app (Digital Asset Link verification failed).

## Building

```bash
cd apps/twa
bubblewrap build
```

Produces a signed `.apk`/`.aab` under `android/app/build/outputs/`. Upload
the `.aab` to the Play Console.

## Updating the app after a web deploy

Nothing to do — the TWA loads the live site, so any `npm run web:build` +
deploy to `wlotus.org` is instantly reflected in the installed app. You only
need to rebuild/resubmit the TWA itself when you change `twa-manifest.json`
(icons, theme colors, `appVersionCode`, etc.) or bump the Android target SDK
for a Play Store policy requirement.

## Play Console requirements (one-time, outside this repo)

- Google Play Developer account (one-time fee).
- App listing assets: screenshots, feature graphic, short/full description,
  privacy policy URL, content rating questionnaire.
- Upload the signed `.aab`; Play Console handles distribution/signing key
  rotation (Play App Signing) if you opt in.

## Suggested `.gitignore` additions once `bubblewrap init` is run here

```
apps/twa/android/
apps/twa/android.keystore
apps/twa/*.apk
apps/twa/*.aab
```
