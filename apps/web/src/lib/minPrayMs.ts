/**
 * Minimum wall-clock prayer time after Offer starts hashing.
 * Remint submits as soon as PoW finds a nonce (tip race). Soft wait only
 * delays the memorial burn; cancel during the wait skips burn and the desk
 * keeps the miner atom. Anti-farming is separate: wLotus 1/107 + XEC fees —
 * see docs/ECONOMICS_WLOTUS_GLOTUS.md § Product intent.
 *
 * Bake at build time: `VITE_MIN_PRAY_MS=60000` (1 min). `0` disables.
 * Optional runtime override: localStorage `wlotus.minPrayMs`.
 * Clamped to 0–10 min; default 60s.
 */

export const DEFAULT_MIN_PRAY_MS = 60_000;
export const MAX_MIN_PRAY_MS = 600_000;
export const MIN_PRAY_MS_KEY = 'wlotus.minPrayMs';

export function parseMinPrayMs(raw: string | undefined): number {
  const s = (raw ?? '').trim();
  if (s === '') return DEFAULT_MIN_PRAY_MS;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MIN_PRAY_MS;
  if (n === 0) return 0;
  return Math.min(MAX_MIN_PRAY_MS, Math.round(n));
}

export function remainingMinPrayMs(
  startedAtMs: number,
  minPrayMs: number,
  nowMs = Date.now(),
): number {
  if (minPrayMs <= 0) return 0;
  return Math.max(0, minPrayMs - (nowMs - startedAtMs));
}

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Wait until wall-clock since `startedAtMs` reaches min pray (abortable). */
export async function waitMinPray(opts: {
  startedAtMs: number;
  minPrayMs: number;
  signal?: AbortSignal;
}): Promise<void> {
  const rem = remainingMinPrayMs(opts.startedAtMs, opts.minPrayMs);
  if (rem <= 0) return;
  await sleepAbortable(rem, opts.signal);
}
