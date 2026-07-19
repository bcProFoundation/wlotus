import { sha256, sha256d } from 'ecash-lib';
import { meetsPowDifficulty } from './powRemintScript.js';
import { meetsPowBits } from './wldf.js';
import { meetsErgonTarget } from './ergon.js';

export interface MinePowResult {
  nonce: Uint8Array;
  hash: Uint8Array;
  attempts: number;
}

/**
 * Mist-style PoW: find nonce where hash256(preimage || nonce) has D leading zero bytes.
 */
export function minePow(opts: {
  preimage: Uint8Array;
  difficultyLeadingZeroBytes: number;
  nonceLength?: number;
  maxAttempts?: number;
}): MinePowResult {
  return minePowBits({
    preimage: opts.preimage,
    bits: opts.difficultyLeadingZeroBytes * 8,
    nonceLength: opts.nonceLength,
    maxAttempts: opts.maxAttempts,
    commit: 'preimage',
  });
}

export type PowCommit = 'preimage' | 'sha256-preimage';

export function minePowBits(opts: {
  preimage: Uint8Array;
  bits: number;
  nonceLength?: number;
  maxAttempts?: number;
  commit?: PowCommit;
}): MinePowResult {
  const nonceLen = opts.nonceLength ?? 4;
  const max = opts.maxAttempts ?? 5_000_000;
  const nonce = new Uint8Array(nonceLen);
  const bits = opts.bits;
  const commit = opts.commit ?? 'preimage';
  const prefix =
    commit === 'sha256-preimage' ? sha256(opts.preimage) : opts.preimage;

  for (let attempts = 1; attempts <= max; attempts++) {
    for (let i = 0; i < nonceLen; i++) {
      nonce[i] = (nonce[i] + 1) & 0xff;
      if (nonce[i] !== 0) break;
    }
    const buf = new Uint8Array(prefix.length + nonceLen);
    buf.set(prefix, 0);
    buf.set(nonce, prefix.length);
    const hash = sha256d(buf);
    if (meetsPowBits(hash, bits)) {
      if (bits % 8 === 0 && !meetsPowDifficulty(hash, bits / 8)) {
        continue;
      }
      return { nonce: nonce.slice(), hash, attempts };
    }
  }
  throw new Error(`PoW not found after ${max} attempts (bits=${bits})`);
}

/** Ergon compact-target PoW: bin2num(hash[0:4]) ∈ [0, target). */
export function minePowErgonTarget(opts: {
  preimage: Uint8Array;
  target: number;
  nonceLength?: number;
  maxAttempts?: number;
  commit?: PowCommit;
}): MinePowResult {
  const nonceLen = opts.nonceLength ?? 4;
  const max = opts.maxAttempts ?? 5_000_000;
  const nonce = new Uint8Array(nonceLen);
  const commit = opts.commit ?? 'sha256-preimage';
  const prefix =
    commit === 'sha256-preimage' ? sha256(opts.preimage) : opts.preimage;

  for (let attempts = 1; attempts <= max; attempts++) {
    for (let i = 0; i < nonceLen; i++) {
      nonce[i] = (nonce[i] + 1) & 0xff;
      if (nonce[i] !== 0) break;
    }
    const buf = new Uint8Array(prefix.length + nonceLen);
    buf.set(prefix, 0);
    buf.set(nonce, prefix.length);
    const hash = sha256d(buf);
    if (meetsErgonTarget(hash, opts.target)) {
      return { nonce: nonce.slice(), hash, attempts };
    }
  }
  throw new Error(
    `Ergon PoW not found after ${max} attempts (target=${opts.target})`,
  );
}
