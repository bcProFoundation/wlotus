/**
 * Detect messenger / social in-app browsers (WebViews) and build escape
 * URLs into the system browser. In-app WebViews use a separate storage
 * partition from Safari/Chrome and from the installed PWA — opening a
 * share link there fragments localStorage (offer history, install id).
 */

const IN_APP_UA =
  /WebView|(iPhone|iPod|iPad)(?!.*Safari\/)|Android.*(wv)|\bZalo|\bFB[\w_]+\/|\bFBAV|\bFBAN|\bInstagram|\bLine\/|\bMicroMessenger|\bTwitter|\bBytedanceWebview|\bTikTok|\bSnapchat/i;

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

/** Messenger / social WebView that should not own wLotus state. */
export function isInAppBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  if (!ua) return false;
  return IN_APP_UA.test(ua);
}

/**
 * Prefer opening share links outside the captive WebView.
 * Returns an escape scheme when possible; otherwise the original HTTPS URL
 * (caller should still offer copy + manual “Open in browser” instructions).
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

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  if (isAndroid) {
    // Opens the user's default browser (or installed app that captures https).
    return (
      `intent://${url.host}${url.pathname}${url.search}${url.hash}` +
      '#Intent;scheme=https;action=android.intent.action.VIEW;end'
    );
  }

  if (isIOS) {
    if (/\bFB[\w_]+\/|\bFBAV|\bFBAN|\bMessenger/i.test(ua)) {
      return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
    }
    if (/\bInstagram/i.test(ua)) {
      return `instagram://extbrowser/?url=${encodeURIComponent(url.href)}`;
    }
  }

  return url.href;
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
