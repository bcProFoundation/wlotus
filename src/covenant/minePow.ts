import { sha256d } from 'ecash-lib';
import { meetsPowDifficulty } from './powRemintScript.js';

export interface MinePowResult {
  nonce: Uint8Array;
  hash: Uint8Array;
  attempts: number;
}

/**
 * Mist-style PoW: find nonce where hash256(preimage || nonce) has D leading zero bytes.
 * `preimage` is the BIP143 sighash preimage (independent of scriptSig).
 */
export function minePow(opts: {
  preimage: Uint8Array;
  difficultyLeadingZeroBytes: number;
  nonceLength?: number;
  maxAttempts?: number;
}): MinePowResult {
  const nonceLen = opts.nonceLength ?? 4;
  const max = opts.maxAttempts ?? 5_000_000;
  const nonce = new Uint8Array(nonceLen);

  for (let attempts = 1; attempts <= max; attempts++) {
    for (let i = 0; i < nonceLen; i++) {
      nonce[i] = (nonce[i] + 1) & 0xff;
      if (nonce[i] !== 0) break;
    }
    const buf = new Uint8Array(opts.preimage.length + nonceLen);
    buf.set(opts.preimage, 0);
    buf.set(nonce, opts.preimage.length);
    const hash = sha256d(buf);
    if (meetsPowDifficulty(hash, opts.difficultyLeadingZeroBytes)) {
      return { nonce: nonce.slice(), hash, attempts };
    }
  }
  throw new Error(
    `PoW not found after ${max} attempts (d=${opts.difficultyLeadingZeroBytes})`,
  );
}
