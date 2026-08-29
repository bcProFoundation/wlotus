/**
 * Morning giỗ / event reminders via Web Push.
 * History (this device's offers in the last year) is the follow list.
 */

import { fetchPushVapidPublicKey, postPushSubscribe } from './offerApi.js';
import type { RemindAltar } from './ownOffers.js';

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function canUseWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function needsIosInstallForPush(): boolean {
  return isIosDevice() && !isStandaloneDisplay();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  return (
    (await navigator.serviceWorker.getRegistration('/')) ??
    (await navigator.serviceWorker.getRegistration()) ??
    null
  );
}

export async function syncMorningReminders(opts: {
  installId: string;
  locale: string;
  altars: RemindAltar[];
}): Promise<boolean> {
  if (!canUseWebPush() || needsIosInstallForPush()) return false;
  if (Notification.permission !== 'granted') return false;
  const publicKey = await fetchPushVapidPublicKey();
  if (!publicKey) return false;
  const reg = await getPushRegistration();
  if (!reg) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;
  await postPushSubscribe({
    installId: opts.installId,
    endpoint,
    keys: { p256dh, auth },
    locale: opts.locale,
    timeZone: deviceTimeZone(),
    altars: opts.altars,
  });
  return true;
}

export async function enableMorningReminders(opts: {
  installId: string;
  locale: string;
  altars: RemindAltar[];
}): Promise<'on' | 'denied' | 'unavailable'> {
  if (!canUseWebPush()) return 'unavailable';
  if (needsIosInstallForPush()) return 'unavailable';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'unavailable';
  const ok = await syncMorningReminders(opts);
  return ok ? 'on' : 'unavailable';
}
