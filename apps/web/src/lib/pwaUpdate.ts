/**
 * Register the service worker and reload when a new deploy activates.
 * Also poll for updates when the app becomes visible again.
 */
export function registerPwaAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_url, registration) {
          if (!registration) return;
          const check = () => {
            void registration.update();
          };
          // Periodic + on focus / visibility
          setInterval(check, 5 * 60_000);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
          window.addEventListener('focus', check);
        },
        onOfflineReady() {
          /* installed for offline shell — mining still needs network */
        },
      });
      // Expose for pull-to-refresh hard update
      (
        window as Window & { __wlotusUpdateSW?: typeof updateSW }
      ).__wlotusUpdateSW = updateSW;
    })
    .catch(() => {
      /* plugin absent in some preview modes */
    });
}
