/**
 * Short browser SHA256d probe for device hashrate (separate from ETA math so
 * Jest can import powEstimate without WASM).
 */

import { sha256d } from 'ecash-lib';
import { PHONE_UX_HASHRATE_H_S } from './powEstimate.js';

/**
 * Short browser SHA256d probe approximating Offer PoW hash work
 * (sha256d over a fixed prefix || nonce). Yields so the UI stays responsive.
 * Prefer cached / mining rates over re-probing.
 */
export async function measureDeviceHashrate(opts?: {
  durationMs?: number;
  batchSize?: number;
}): Promise<number> {
  const durationMs = opts?.durationMs ?? 450;
  const batchSize = opts?.batchSize ?? 250;
  const prefix = new Uint8Array(32);
  for (let i = 0; i < prefix.length; i++) prefix[i] = (i * 17) & 0xff;
  const nonce = new Uint8Array(4);
  const buf = new Uint8Array(prefix.length + nonce.length);
  buf.set(prefix, 0);

  let attempts = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < durationMs) {
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < nonce.length; j++) {
        nonce[j] = (nonce[j] + 1) & 0xff;
        if (nonce[j] !== 0) break;
      }
      buf.set(nonce, prefix.length);
      sha256d(buf);
      attempts++;
    }
    await new Promise<void>(r => {
      setTimeout(r, 0);
    });
  }
  const elapsedSec = (performance.now() - t0) / 1000;
  if (elapsedSec <= 0 || attempts < 1) return PHONE_UX_HASHRATE_H_S;
  return Math.round(attempts / elapsedSec);
}
