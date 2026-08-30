/**
 * Register the service worker and reload when a new deploy activates.
 * Also poll for updates when the app becomes visible again.
 *
 * Registers `/sw.js?v=<per-build id>` instead of the plain vite-plugin-pwa
 * default. WebKit/Safari does not reliably bypass the HTTP cache for the
 * service-worker "update" fetch the way Chromium does, so relying on
 * `Cache-Control` headers alone can pin an iPhone on an old JS/CSS bundle
 * indefinitely — even across force-quit/reopen — because the *active* SW
 * keeps answering every request straight from its own Cache Storage
 * precache without ever reaching the network. A version query string makes
 * each deploy a genuinely new URL the browser has never cached, so the very
 * first registration attempt after a deploy is guaranteed to hit the
 * network and discover the new worker.
 *
 * Never check-or-reload while an offering is in progress — skipWaiting +
 * clientsClaim would swap the controller and this listener would reload,
 * aborting the mine and losing the burn. After the session, the next
 * visibility / focus / 5-minute poll applies the deferred reload.
 */
import { pwaReloadGate } from './pwaReloadGate';

export { setOfferingBlocksPwaReload } from './pwaReloadGate';

function reloadOnce(state: { refreshing: boolean }): void {
  if (state.refreshing) return;
  state.refreshing = true;
  window.location.reload();
}

export function registerPwaAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  const state = { refreshing: false };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pwaReloadGate.onControllerChange() === 'reload') {
      reloadOnce(state);
    }
  });

  const swUrl = `/sw.js?v=${__WLOTUS_BUILD_ID__}`;

  navigator.serviceWorker
    .register(swUrl, { scope: '/', type: 'classic' })
    .then(registration => {
      const check = () => {
        const action = pwaReloadGate.onCheck();
        if (action === 'reload') {
          reloadOnce(state);
          return;
        }
        if (action === 'check') void registration.update();
      };
      // Periodic + on focus / visibility
      setInterval(check, 5 * 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
      // Expose for pull-to-refresh hard update
      (
        window as Window & { __wlotusUpdateSW?: () => Promise<void> }
      ).__wlotusUpdateSW = async () => {
        await registration.update();
      };
    })
    .catch(() => {
      /* SW registration failed — app still works online without offline shell */
    });
}
