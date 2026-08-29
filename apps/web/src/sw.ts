/**
 * Custom service worker: Workbox precache + Web Push for morning reminders.
 */
/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/index-api/'),
  new NetworkOnly(),
);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener('push', event => {
  let data: PushPayload = {};
  try {
    data = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = (data.title || 'W Lotus').trim() || 'W Lotus';
  const body = (data.body || '').trim();
  const url = data.url || '/';
  const tag = data.tag || 'wlotus-memorial';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: '/images/wlotus-icon-192.png',
      badge: '/images/wlotus-icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = (event.notification.data as { url?: string } | undefined)?.url;
  const url = raw && raw.trim() ? raw : '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && url.startsWith('http')) {
            try {
              await (client as WindowClient).navigate(url);
            } catch {
              /* keep focus */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
