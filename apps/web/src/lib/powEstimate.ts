/**
 * Static PoW wall-time estimate from difficulty bits + hash rate.
 * Pre-mint ETA uses a cached this-device rate (or a one-time probe).
 * Post-mint stats come from the mint API (actual PoW wall time).
 */

/** Keep in sync with `HASHRATE_CACHE_KEY` in config.ts (avoid Vite import.meta here for Jest). */
const HASHRATE_CACHE_KEY = 'wlotus.deviceHashrateHps';

/** Phone-class SHA256d UX hashrate (matches `UX_PHONE_HASHRATE_H_S` in pricing). */
export const PHONE_UX_HASHRATE_H_S = 150_000;

/** Fallback when status API has not returned bits yet (wLotus genesis = 0). */
export const DEFAULT_PRAYER_BASE_BITS = 0;

/** Inflate ETA so users usually finish sooner than the label suggests. */
export const ETA_BUFFER = 1.3;

export function expectedHashesFromBits(bits: number): number {
  // bits=0 → any nonce works (vacuous PoW); treat as 1 hash of work for ETA.
  if (!Number.isFinite(bits) || bits <= 0) return 1;
  return 2 ** bits;
}

export function wallSeconds(
  expectedHashes: number,
  hashesPerSec: number,
): number {
  return expectedHashes / hashesPerSec;
}

/** Short human label for estimated duration (no countdown). Prefer tenths of minutes. */
export function formatEstimateDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds > 1e12) return '—';
  if (seconds < 6) return '~0.1 min';
  if (seconds < 3600) {
    const tenths = Math.max(1, Math.round(seconds / 6));
    return `~${(tenths / 10).toFixed(1)} min`;
  }
  if (seconds < 86400) {
    const h = seconds / 3600;
    const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
    return `~${rounded} h`;
  }
  return `~${(seconds / 86400).toFixed(1)} d`;
}

/** Actual duration label (post-mint), no leading tilde. */
export function formatActualDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) {
    const rounded =
      seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
    return `${rounded} s`;
  }
  if (seconds < 3600) {
    const min = seconds / 60;
    const rounded = min >= 10 ? Math.round(min) : Math.round(min * 10) / 10;
    return `${rounded} min`;
  }
  const h = seconds / 3600;
  const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
  return `${rounded} h`;
}

/**
 * Elapsed mining label in tenths of a minute, stepped every 10s:
 * 0.1, 0.2, 0.3, …
 */
export function formatElapsedTenthsMin(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '0.0 min';
  const tenths = Math.floor(elapsedMs / 10_000); // 10s → 0.1 min
  return `${(tenths / 10).toFixed(1)} min`;
}

export function formatHashrateLabel(hashesPerSec: number): string {
  if (!Number.isFinite(hashesPerSec) || hashesPerSec <= 0) return '—';
  if (hashesPerSec >= 1e12) return `${(hashesPerSec / 1e12).toFixed(1)} TH/s`;
  if (hashesPerSec >= 1e9) return `${(hashesPerSec / 1e9).toFixed(1)} GH/s`;
  if (hashesPerSec >= 1e6) return `${(hashesPerSec / 1e6).toFixed(1)} MH/s`;
  if (hashesPerSec >= 1e3) {
    const k = hashesPerSec / 1e3;
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${rounded} kH/s`;
  }
  return `${Math.round(hashesPerSec)} H/s`;
}

export function estimatePrayerPow(opts?: {
  bits?: number | null;
  hashesPerSec?: number | null;
}): {
  bits: number;
  hashesPerSec: number;
  expectedHashes: number;
  seconds: number;
  durationLabel: string;
  hashrateLabel: string;
  measured: boolean;
} {
  // baseZeroBits = 0 is valid (wLotus genesis). Do not treat 0 as "missing".
  const bits =
    opts?.bits != null && Number.isFinite(opts.bits) && opts.bits >= 0
      ? opts.bits
      : DEFAULT_PRAYER_BASE_BITS;
  const measured =
    opts?.hashesPerSec != null &&
    Number.isFinite(opts.hashesPerSec) &&
    opts.hashesPerSec > 0;
  const hashesPerSec = measured
    ? (opts!.hashesPerSec as number)
    : PHONE_UX_HASHRATE_H_S;
  const expectedHashes = expectedHashesFromBits(bits);
  const seconds = wallSeconds(expectedHashes, hashesPerSec) * ETA_BUFFER;
  return {
    bits,
    hashesPerSec,
    expectedHashes,
    seconds,
    durationLabel: formatEstimateDuration(seconds),
    hashrateLabel: formatHashrateLabel(hashesPerSec),
    measured,
  };
}

export function loadCachedHashrate(): number | null {
  try {
    const raw = localStorage.getItem(HASHRATE_CACHE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  } catch {
    return null;
  }
}

export function saveCachedHashrate(hashesPerSec: number): void {
  if (!Number.isFinite(hashesPerSec) || hashesPerSec <= 0) return;
  try {
    localStorage.setItem(
      HASHRATE_CACHE_KEY,
      String(Math.round(hashesPerSec)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
