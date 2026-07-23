/**
 * Share / deeplink helpers for original dedication burns (pure).
 *
 * Share format is always HTTPS: `https://wlotus.org/<burn-txid>`.
 * That is what social apps (iOS/Android) can open, preview, and later
 * hand off to a store app via Universal Links / App Links — or to the
 * installed PWA via in-scope link capturing. Custom schemes alone
 * (`wlotus://…`) break previews and often fail from messengers when the
 * app is not installed, so we only *accept* them for future native shells.
 */

const TXID_RE = /\b([0-9a-fA-F]{64})\b/;
const PATH_TXID_RE = /^\/([0-9a-fA-F]{64})\/?$/;
/** Full site path or URL containing a 64-hex burn txid. */
const URL_TXID_RE =
  /(?:https?:\/\/)?(?:(?:www|test)\.)?wlotus\.org\/([0-9a-fA-F]{64})\b/i;
/**
 * Future native / TWA custom schemes (accepted, not shared):
 *   wlotus://<txid>
 *   wlotus://burn/<txid>
 *   web+wlotus://<txid>
 */
const SCHEME_TXID_RE =
  /^(?:wlotus|web\+wlotus):(?:\/\/)?(?:burn\/)?([0-9a-fA-F]{64})\b/i;

export function isBurnTxid(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  return /^[0-9a-fA-F]{64}$/.test(raw.trim());
}

/** Normalize to lowercase 64-hex, or null. */
export function normalizeBurnTxid(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const hex = raw.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

/**
 * Extract a dedication burn txid from:
 * - `/<txid>` path
 * - `https://wlotus.org/<txid>` (or test/www)
 * - `wlotus://…` / `web+wlotus://…` (future native)
 * - bare 64-hex
 * - free text containing either
 */
export function extractBurnTxid(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;

  const pathOnly = text.startsWith('/') ? text : null;
  if (pathOnly) {
    const m = PATH_TXID_RE.exec(pathOnly);
    if (m?.[1]) return normalizeBurnTxid(m[1]);
  }

  const scheme = SCHEME_TXID_RE.exec(text);
  if (scheme?.[1]) return normalizeBurnTxid(scheme[1]);

  const url = URL_TXID_RE.exec(text);
  if (url?.[1]) return normalizeBurnTxid(url[1]);

  if (isBurnTxid(text)) return normalizeBurnTxid(text);

  const any = TXID_RE.exec(text);
  return any?.[1] ? normalizeBurnTxid(any[1]) : null;
}

/** True when the remembrance field looks like a share link / txid (not a name). */
export function looksLikeShareInput(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (isBurnTxid(t)) return true;
  if (/^(?:wlotus|web\+wlotus):/i.test(t)) return extractBurnTxid(t) != null;
  // Names are short plain text; share URLs / paths embed a 64-hex burn id.
  if (t.length < 64) return false;
  if (!/[\/.]/.test(t) && !URL_TXID_RE.test(t)) return false;
  return extractBurnTxid(t) != null;
}

/**
 * Public share URL for an original dedication burn.
 * Always HTTPS (or current origin in local/test) — mobile social → app entry.
 */
export function dedicationShareUrl(
  burnTxid: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const id = normalizeBurnTxid(burnTxid);
  if (!id) throw new Error('invalid burn txid');
  const base = (origin || 'https://wlotus.org').replace(/\/$/, '');
  return `${base}/${id}`;
}

/** Consume `/<txid>` from the current location (SPA). */
export function burnTxidFromLocation(
  pathname: string = typeof window !== 'undefined'
    ? window.location.pathname
    : '',
): string | null {
  return extractBurnTxid(pathname);
}

/** Clear path back to `/` after consuming a deeplink (keeps query/hash). */
export function clearDedicationPath(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (!PATH_TXID_RE.test(pathname)) return;
  window.history.replaceState(null, '', `/${search}${hash}` || '/');
}
