/**
 * Static PoW wall-time estimate from difficulty bits + assumed device hash rate.
 * Not a live timer — actual mint time varies with hardware and luck.
 */

/** Phone-class SHA256d UX hashrate (matches `UX_PHONE_HASHRATE_H_S` in pricing). */
export const PHONE_UX_HASHRATE_H_S = 150_000;

/** Fallback when status API has not returned bits yet (live dual-mint Prayer). */
export const DEFAULT_PRAYER_BASE_BITS = 24;

export function expectedHashesFromBits(bits: number): number {
  return 2 ** bits;
}

export function wallSeconds(
  expectedHashes: number,
  hashesPerSec: number,
): number {
  return expectedHashes / hashesPerSec;
}

/** Short human label for estimated duration (no countdown). */
export function formatEstimateDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds > 1e12) return '—';
  if (seconds < 1) return '<1 s';
  if (seconds < 60) return `~${Math.round(seconds)} s`;
  if (seconds < 3600) {
    const min = seconds / 60;
    const rounded = min >= 10 ? Math.round(min) : Math.round(min * 10) / 10;
    return `~${rounded} min`;
  }
  if (seconds < 86400) {
    const h = seconds / 3600;
    const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
    return `~${rounded} h`;
  }
  return `~${(seconds / 86400).toFixed(1)} d`;
}

export function formatHashrateLabel(hashesPerSec: number): string {
  if (hashesPerSec >= 1e12) return `${(hashesPerSec / 1e12).toFixed(0)} TH/s`;
  if (hashesPerSec >= 1e9) return `${(hashesPerSec / 1e9).toFixed(0)} GH/s`;
  if (hashesPerSec >= 1e6) return `${(hashesPerSec / 1e6).toFixed(0)} MH/s`;
  if (hashesPerSec >= 1e3) return `${(hashesPerSec / 1e3).toFixed(0)} kH/s`;
  return `${hashesPerSec} H/s`;
}

export function estimatePrayerPow(opts?: {
  bits?: number | null;
  hashesPerSec?: number;
}): {
  bits: number;
  hashesPerSec: number;
  expectedHashes: number;
  seconds: number;
  durationLabel: string;
  hashrateLabel: string;
} {
  const bits =
    opts?.bits != null && Number.isFinite(opts.bits) && opts.bits > 0
      ? opts.bits
      : DEFAULT_PRAYER_BASE_BITS;
  const hashesPerSec = opts?.hashesPerSec ?? PHONE_UX_HASHRATE_H_S;
  const expectedHashes = expectedHashesFromBits(bits);
  const seconds = wallSeconds(expectedHashes, hashesPerSec);
  return {
    bits,
    hashesPerSec,
    expectedHashes,
    seconds,
    durationLabel: formatEstimateDuration(seconds),
    hashrateLabel: formatHashrateLabel(hashesPerSec),
  };
}
