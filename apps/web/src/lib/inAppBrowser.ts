/**
 * Detect messenger / social in-app browsers (WebViews) and escape into the
 * system browser. Captive WebViews use a separate storage partition from
 * Safari/Chrome and the installed PWA — share links opened there fragment
 * localStorage (offer history, install id).
 *
 * Strategy (2025–2026 practice — deepthix/inapp-escape, eiab, paul.af):
 * - Android: auto `intent://…#Intent;scheme=https;…end` (usually works)
 * - Facebook / Messenger iOS: auto `x-safari-https://…`
 * - Instagram / Threads iOS: auto `instagram://extbrowser/?url=…`
 * - LINE: auto HTTPS + `?openExternalBrowser=1`
 * - Twitter/X, TikTok, …: JS redirects are blocked — need a user tap
 * - Always keep a tap fallback; never loop forever (sessionStorage guard)
 */

export type InAppApp =
  | 'zalo'
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'threads'
  | 'line'
  | 'twitter'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'wechat'
  | 'other';

/** Apps whose WKWebView drops JS-initiated scheme redirects. */
const NEEDS_USER_GESTURE = new Set<InAppApp>([
  'twitter',
  'tiktok',
  'snapchat',
  'linkedin',
]);

const ESCAPE_GUARD_KEY = 'wlotus.iabEscape';

/** True when running as an installed PWA / home-screen app. */
export function isStandaloneDisplay(
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): boolean {
  if (!win) return false;
  try {
    if (win.matchMedia('(display-mode: standalone)').matches) return true;
    if (win.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch {
    /* ignore */
  }
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function detectInAppApp(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): InAppApp | null {
  if (!ua) return null;
  if (/\bZalo/i.test(ua)) return 'zalo';
  if (/\bFB[\w_]+\/(Messenger|MESSENGER)|\bMessenger/i.test(ua)) return 'messenger';
  if (/\bFB[\w_]+\/|\bFBAV|\bFBAN/i.test(ua)) return 'facebook';
  if (/\bThreads/i.test(ua)) return 'threads';
  if (/\bInstagram/i.test(ua)) return 'instagram';
  if (/\bLine\//i.test(ua)) return 'line';
  if (/\bTwitter|\bX\/|TwitterAndroid/i.test(ua)) return 'twitter';
  if (/\bTikTok|\bBytedanceWebview|\bmusical_ly/i.test(ua)) return 'tiktok';
  if (/\bSnapchat/i.test(ua)) return 'snapchat';
  if (/\bLinkedInApp/i.test(ua)) return 'linkedin';
  if (/\bMicroMessenger/i.test(ua)) return 'wechat';
  if (
    /WebView|(iPhone|iPod|iPad)(?!.*Safari\/)|Android.*(wv)/i.test(ua)
  ) {
    return 'other';
  }
  return null;
}

/** Messenger / social WebView that should not own wLotus state. */
export function isInAppBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  return detectInAppApp(ua) != null;
}

export function isAndroid(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  return /Android/i.test(ua);
}

export function isIOS(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  return /iPad|iPhone|iPod/i.test(ua);
}

/** Whether a silent JS redirect is worth trying for this host WebView. */
export function canAutoEscapeInAppBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  const app = detectInAppApp(ua);
  if (!app) return false;
  if (isAndroid(ua)) return true; // intent:// usually works without a gesture
  if (NEEDS_USER_GESTURE.has(app)) return false;
  return true;
}

/**
 * Prefer opening share links outside the captive WebView.
 * Returns an escape scheme / URL when possible.
 */
export function externalBrowserEscapeUrl(
  httpsUrl: string,
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): string {
  let url: URL;
  try {
    url = new URL(httpsUrl);
  } catch {
    return httpsUrl;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return httpsUrl;

  const app = detectInAppApp(ua);
  const href = url.href;

  if (isAndroid(ua)) {
    // Omit package= so Samsung Internet / Brave / Firefox can handle it.
    return (
      `intent://${url.host}${url.pathname}${url.search}${url.hash}` +
      `#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(href)};end`
    );
  }

  if (isIOS(ua)) {
    if (app === 'instagram' || app === 'threads') {
      return `instagram://extbrowser/?url=${encodeURIComponent(href)}`;
    }
    if (app === 'line') {
      const line = new URL(href);
      line.searchParams.set('openExternalBrowser', '1');
      return line.href;
    }
    // Facebook / Messenger / Zalo / others — best-effort Safari handoff.
    return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
  }

  if (app === 'line') {
    const line = new URL(href);
    line.searchParams.set('openExternalBrowser', '1');
    return line.href;
  }

  return href;
}

/** Block share-deeplink handling while stuck in a messenger WebView. */
export function shouldEscapeShareInAppBrowser(opts?: {
  pathname?: string;
  ua?: string;
  standalone?: boolean;
}): boolean {
  const pathname =
    opts?.pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const ua =
    opts?.ua ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const standalone =
    opts?.standalone ??
    (typeof window !== 'undefined' ? isStandaloneDisplay() : false);

  if (standalone) return false;
  if (!isInAppBrowser(ua)) return false;
  // Only gate dedication share paths: /<64-hex>
  return /^\/[0-9a-fA-F]{64}\/?$/.test(pathname.trim());
}

function escapeGuardKey(pathname: string): string {
  return `${ESCAPE_GUARD_KEY}:${pathname}`;
}

/** True if we already attempted an auto-escape for this share path. */
export function hasAttemptedAutoEscape(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '',
): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(escapeGuardKey(pathname)) === '1';
  } catch {
    return false;
  }
}

export function markAutoEscapeAttempted(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '',
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(escapeGuardKey(pathname), '1');
  } catch {
    /* private mode */
  }
}

/**
 * Try a silent redirect out of the WebView. Returns true if a redirect was
 * started. Callers should still render a tap fallback in case the host blocks it.
 */
export function tryAutoEscapeInAppBrowser(
  httpsUrl: string,
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '',
): boolean {
  if (!canAutoEscapeInAppBrowser(ua)) return false;
  if (hasAttemptedAutoEscape(pathname)) return false;
  const target = externalBrowserEscapeUrl(httpsUrl, ua);
  if (!target) return false;
  // No-op same URL would loop; LINE mutates query so target !== httpsUrl.
  if (target === httpsUrl) return false;
  markAutoEscapeAttempted(pathname);
  try {
    window.location.replace(target);
    return true;
  } catch {
    return false;
  }
}
