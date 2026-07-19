/**
 * Browser SHA256d Prayer PoW miner (matches server minePowBits commit=sha256-preimage).
 * Runs in a Web Worker so the UI stays responsive.
 */
import { fromHex, sha256d, toHex } from 'ecash-lib';

/** Same leading-zero-bits check as `meetsPowBits` in src/covenant/wldf.ts */
export function meetsPowBits(hash: Uint8Array, bits: number): boolean {
  if (!Number.isInteger(bits) || bits < 0) return false;
  const zeroBytes = Math.floor(bits / 8);
  const remBits = bits % 8;
  if (hash.length < zeroBytes + (remBits > 0 ? 1 : 0)) return false;
  for (let i = 0; i < zeroBytes; i++) {
    if (hash[i] !== 0) return false;
  }
  if (remBits === 0) return true;
  const next = hash[zeroBytes]!;
  const limit = 1 << (8 - remBits);
  return next < limit;
}

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
 */
export async function minePrayerPow(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  batchSize?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult> {
  const nonceLen = opts.nonceLength ?? 4;
  const batchSize = opts.batchSize ?? 2_000;
  const prefix = fromHex(opts.powPrefixHex);
  const nonce = new Uint8Array(nonceLen);
  const buf = new Uint8Array(prefix.length + nonceLen);
  buf.set(prefix, 0);

  let attempts = 0;
  const t0 = performance.now();

  for (;;) {
    if (opts.signal?.aborted) {
      throw new DOMException('Mining aborted', 'AbortError');
    }
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < nonceLen; j++) {
        nonce[j] = (nonce[j] + 1) & 0xff;
        if (nonce[j] !== 0) break;
      }
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
