/**
 * White Lotus web — Offer client (mobile-first).
 * Device PoW; server pays fees; wLotus burns miner atom for memorial.
 */

/** Live dWLOTUS temple dryrun (mint 108 mala → burn 1) */
export const DEFAULT_PRAYER_TOKEN_ID =
  (import.meta.env.VITE_PRAYER_TOKEN_ID as string | undefined)?.trim() ||
  'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';

export const PRAYER_TOKEN_ID = DEFAULT_PRAYER_TOKEN_ID;

export const PRAYER_TICKER =
  (import.meta.env.VITE_PRAYER_TICKER as string | undefined)?.trim() ||
  'dWLOTUS';

import {
  MIN_PRAY_MS_KEY,
  parseMinPrayMs,
} from './minPrayMs.js';
import { parseTipPollMs } from './tipPollMs.js';

/** Mint API base — empty = same origin (/api via Vite proxy or nginx). */
export const MINT_API_BASE =
  (import.meta.env.VITE_MINT_API_BASE as string | undefined)?.trim() || '';

/**
 * While mining, how often to poll `/api/status` for tipEpoch changes
 * (someone else won the tip → abort and restart).
 *
 * Bake at build time: `VITE_TIP_POLL_MS=1000` (1s) or `5000` (5s).
 * Not sensitive — prefer a GitHub Actions *variable*; a secret also works
 * because other VITE_* values are already wired that way.
 * Clamped to 1–30s; default 2s.
 */
export const TIP_POLL_MS = parseTipPollMs(
  import.meta.env.VITE_TIP_POLL_MS as string | undefined,
);

export { parseTipPollMs };

/**
 * Minimum wall-clock prayer time (ms) between remint and memorial burn.
 * Bake: `VITE_MIN_PRAY_MS=60000` (default). `0` disables.
 * Runtime override: localStorage `wlotus.minPrayMs`.
 * Remint always submits immediately; this only delays `/api/burn`.
 */
export const MIN_PRAY_MS = parseMinPrayMs(
  import.meta.env.VITE_MIN_PRAY_MS as string | undefined,
);

export function getMinPrayMs(): number {
  try {
    const ls = localStorage.getItem(MIN_PRAY_MS_KEY);
    if (ls != null && ls.trim() !== '') return parseMinPrayMs(ls);
  } catch {
    /* ignore quota / private mode */
  }
  return MIN_PRAY_MS;
}

export { parseMinPrayMs, MIN_PRAY_MS_KEY };

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
