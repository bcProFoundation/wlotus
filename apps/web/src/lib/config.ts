/**
 * White Lotus web — Prayer-only dual-mint client (mobile-first).
 * No browser wallet yet; offerings go through mint API (remint 2 → burn 1 → keep 1).
 */

/** Live dual-mint dPRAYER (mint 2 → burn 1 + desk 1) */
export const DEFAULT_PRAYER_TOKEN_ID =
  (import.meta.env.VITE_PRAYER_TOKEN_ID as string | undefined)?.trim() ||
  'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b';

export const PRAYER_TOKEN_ID = DEFAULT_PRAYER_TOKEN_ID;

export const PRAYER_TICKER =
  (import.meta.env.VITE_PRAYER_TICKER as string | undefined)?.trim() || 'dPRAYER';

/** Mint API base — empty = same origin (/api via Vite proxy or nginx). */
export const MINT_API_BASE =
  (import.meta.env.VITE_MINT_API_BASE as string | undefined)?.trim() || '';

export const INSTALL_ID_KEY = 'wlotus.installId';
export const LOCAL_OFFERS_KEY = 'wlotus.web.offers';

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
