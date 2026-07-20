/**
 * White Lotus web — Prayer client (mobile-first).
 * Device PoW; server pays fees; memorial on mint (no separate burn).
 */

/** Live memorial-mint dPRAYER (mint 1 + WLBR on remint) */
export const DEFAULT_PRAYER_TOKEN_ID =
  (import.meta.env.VITE_PRAYER_TOKEN_ID as string | undefined)?.trim() ||
  '173e02605a8f7c226c43793539687b1084a605f336faf47aa07f7976edfa6078';

export const PRAYER_TOKEN_ID = DEFAULT_PRAYER_TOKEN_ID;

export const PRAYER_TICKER =
  (import.meta.env.VITE_PRAYER_TICKER as string | undefined)?.trim() || 'dPRAYER';

/** Mint API base — empty = same origin (/api via Vite proxy or nginx). */
export const MINT_API_BASE =
  (import.meta.env.VITE_MINT_API_BASE as string | undefined)?.trim() || '';

export const INSTALL_ID_KEY = 'wlotus.installId';
export const LOCAL_OFFERS_KEY = 'wlotus.web.offers';
/** Cached device hashrate (H/s) for Prayer ETA — skip probe on reopen. */
export const HASHRATE_CACHE_KEY = 'wlotus.deviceHashrateHps';

export function getOrCreateInstallId(): string {
  try {
    const existing = localStorage.getItem(INSTALL_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `wl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(INSTALL_ID_KEY, id);
    return id;
  } catch {
    return `wl-ephemeral-${Date.now()}`;
  }
}
