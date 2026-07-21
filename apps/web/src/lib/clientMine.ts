/**
 * Browser SHA256d Prayer PoW miner (matches server minePowBits commit=sha256-preimage).
 * Runs in a Web Worker so the UI stays responsive.
 */
import { fromHex, sha256d, toHex } from 'ecash-lib';
import { bumpNonceLe, meetsPowBits } from './powBits.js';

export { bumpNonceLe, meetsPowBits };

export interface MineProgress {
  attempts: number;
  elapsedMs: number;
  hashrateHps: number;
}

export interface MineResult {
  nonceHex: string;
  attempts: number;
  elapsedMs: number;
  hashrateHps: number;
}

/**
 * Mine until meetsPowBits(sha256d(powPrefix || nonce), bits).
 * Yields every `batchSize` attempts so the event loop / worker can report progress.
 *
 * Optional `nonceStart` / `nonceStride` partition the search for multi-worker mining.
 */
export async function minePrayerPow(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  batchSize?: number;
  /** Initial LE nonce (default zeros). */
  nonceStartHex?: string;
  /** Add this to the nonce each attempt (default 1). */
  nonceStride?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult> {
  const nonceLen = opts.nonceLength ?? 4;
  const batchSize = opts.batchSize ?? 2_000;
  const stride = Math.max(1, opts.nonceStride ?? 1);
  const prefix = fromHex(opts.powPrefixHex);
  const nonce = opts.nonceStartHex
    ? fromHex(opts.nonceStartHex)
    : new Uint8Array(nonceLen);
  if (nonce.length !== nonceLen) {
    throw new Error(
      `nonceStart length ${nonce.length} != nonceLength ${nonceLen}`,
    );
  }
  const buf = new Uint8Array(prefix.length + nonceLen);
  buf.set(prefix, 0);

  let attempts = 0;
  const t0 = performance.now();

  for (;;) {
    if (opts.signal?.aborted) {
      throw new DOMException('Mining aborted', 'AbortError');
    }
    for (let i = 0; i < batchSize; i++) {
      buf.set(nonce, prefix.length);
      const hash = sha256d(buf);
      attempts++;
      if (meetsPowBits(hash, opts.bits)) {
        const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
        return {
          nonceHex: toHex(nonce),
          attempts,
          elapsedMs,
          hashrateHps: Math.round(attempts / (elapsedMs / 1000)),
        };
      }
      bumpNonceLe(nonce, stride);
    }
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
    opts.onProgress?.({
      attempts,
      elapsedMs,
      hashrateHps: Math.round(attempts / (elapsedMs / 1000)),
    });
    await new Promise<void>(r => setTimeout(r, 0));
  }
}
