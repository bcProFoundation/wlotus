/**
 * v5 (durable generation) PoW: u64 head < u64 nBits threshold.
 *
 * The script checks the exponent-gated 32-bit form (head4 = H[e..e+4] < m
 * AND top = H[e+4..8] == 0); this BigInt form (H64 < m×256^e) is exactly
 * equivalent (integer-division identity, proven in the design notes) and
 * obviously correct. Grind order matches the script: HASH256(powcommit ++
 * nonce) where powcommit = SHA256(sighash preimage).
 */
import { sha256, sha256d } from 'ecash-lib';
import { thresholdU64 } from './singleShardDeltaMathV5.js';
import type { MinePowResult, PowCommit } from './minePow.js';

function u64Le(head8: Uint8Array): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(head8[i]!);
  return v;
}

/** Off-chain pass predicate: LE64(hash[0:8]) < m×256^e. */
export function meetsU64Threshold(
  hash: Uint8Array,
  m: number,
  e: number,
): boolean {
  return u64Le(hash.subarray(0, 8)) < thresholdU64(m, e);
}

export function minePowU64(opts: {
  preimage: Uint8Array;
  m: number;
  e: number;
  nonceLength?: number;
  maxAttempts?: number;
  commit?: PowCommit;
}): MinePowResult {
  const nonceLen = opts.nonceLength ?? 4;
  const max = opts.maxAttempts ?? 5_000_000;
  const threshold = thresholdU64(opts.m, opts.e);
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
    if (u64Le(hash.subarray(0, 8)) < threshold) {
      return { nonce: nonce.slice(), hash, attempts };
    }
  }
  throw new Error(
    `u64 PoW not found after ${max} attempts (m=${opts.m} e=${opts.e})`,
  );
}

/** Verify a client-submitted nonce against the challenge preimage. */
export function verifyPowU64(opts: {
  preimage: Uint8Array;
  nonce: Uint8Array;
  m: number;
  e: number;
  commit?: PowCommit;
}): boolean {
  const commit = opts.commit ?? 'sha256-preimage';
  const prefix =
    commit === 'sha256-preimage' ? sha256(opts.preimage) : opts.preimage;
  const buf = new Uint8Array(prefix.length + opts.nonce.length);
  buf.set(prefix, 0);
  buf.set(opts.nonce, prefix.length);
  return meetsU64Threshold(sha256d(buf), opts.m, opts.e);
}
