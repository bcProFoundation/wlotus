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
  MIN_PRAY_S_KEY,
  minPraySecondsToMs,
  parseLegacyMinPrayMsAsSeconds,
  parseMinPraySeconds,
} from './minPrayS.js';
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

function bakeMinPraySeconds(): number {
  const primary = (import.meta.env.VITE_MIN_PRAY_S as string | undefined)?.trim();
  if (primary != null && primary !== '') {
    return parseMinPraySeconds(primary);
  }
  const legacy = parseLegacyMinPrayMsAsSeconds(
    import.meta.env.VITE_MIN_PRAY_MS as string | undefined,
  );
  if (legacy != null) return legacy;
  return parseMinPraySeconds(undefined);
}

/**
 * Soft pray floor in seconds (between remint and memorial burn).
 * Bake: `VITE_MIN_PRAY_S=60` (default). `0` disables.
 * Runtime override: localStorage `wlotus.minPrayS`.
 */
export const MIN_PRAY_S = bakeMinPraySeconds();

/** Soft pray floor in ms (internal timers). */
export const MIN_PRAY_MS = minPraySecondsToMs(MIN_PRAY_S);

export function getMinPraySeconds(): number {
  try {
    const ls =
      localStorage.getItem(MIN_PRAY_S_KEY) ??
      localStorage.getItem(MIN_PRAY_MS_KEY);
    if (ls != null && ls.trim() !== '') {
      // Legacy localStorage key stored seconds-or-ms ambiguity; prefer S key.
      if (localStorage.getItem(MIN_PRAY_S_KEY) != null) {
        return parseMinPraySeconds(ls);
      }
      return parseLegacyMinPrayMsAsSeconds(ls) ?? parseMinPraySeconds(ls);
    }
  } catch {
    /* ignore quota / private mode */
  }
  return MIN_PRAY_S;
}

export function getMinPrayMs(): number {
  return minPraySecondsToMs(getMinPraySeconds());
}

export {
  parseMinPraySeconds,
  MIN_PRAY_S_KEY,
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
