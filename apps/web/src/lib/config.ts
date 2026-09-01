/**
 * W Lotus web — Offer client (mobile-first).
 * Device PoW; server pays fees; wLotus burns miner atom for memorial.
 */

import { LIVE_PROD_WLOTUS_TOKEN_ID } from '../../../../src/params/wlotusTokens.js';
import { resolveBakedLiveTokenId } from './tokenEra.js';
import {
  MIN_PRAY_SECONDS_KEY,
  minPraySecondsToMs,
  parseMinPraySeconds,
} from './minPraySeconds.js';
import { parseTipPollMs } from './tipPollMs.js';

/**
 * Fallback when GitHub Actions omits `VITE_PRAYER_TOKEN_ID`.
 * Must be the live felt token — the old dWLOTUS dryrun default made test
 * deploys ping-pong era against `/api/status` and hid new Recent rows.
 */
export const DEFAULT_PRAYER_TOKEN_ID = resolveBakedLiveTokenId(
  import.meta.env.VITE_PRAYER_TOKEN_ID as string | undefined,
  LIVE_PROD_WLOTUS_TOKEN_ID,
);

export const PRAYER_TOKEN_ID = DEFAULT_PRAYER_TOKEN_ID;

export const PRAYER_TICKER =
  (import.meta.env.VITE_PRAYER_TICKER as string | undefined)?.trim() ||
  'WLOTUS';

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
 * Soft pray floor in seconds (between remint and memorial burn).
 * Bake: `VITE_MIN_PRAY_SECONDS=108` (default). `0` disables.
 * Runtime override: localStorage `wlotus.minPraySeconds`.
 */
export const MIN_PRAY_SECONDS = parseMinPraySeconds(
  import.meta.env.VITE_MIN_PRAY_SECONDS as string | undefined,
);

export function getMinPraySeconds(): number {
  try {
    const ls = localStorage.getItem(MIN_PRAY_SECONDS_KEY);
    if (ls != null && ls.trim() !== '') return parseMinPraySeconds(ls);
  } catch {
    /* ignore quota / private mode */
  }
  return MIN_PRAY_SECONDS;
}

/** Soft pray floor in ms (for timers only — not an env var). */
export function getMinPrayMs(): number {
  return minPraySecondsToMs(getMinPraySeconds());
}

export {
  parseMinPraySeconds,
  MIN_PRAY_SECONDS_KEY,
  minPraySecondsToMs,
};

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
