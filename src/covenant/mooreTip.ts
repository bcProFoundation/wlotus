/**
 * Production Moore + tip EMPP (WLPT v4).
 *
 * Layout (15 bytes) — tipLocktime is enforced in-Script via ctor, not EMPP:
 *   WLPT (4) | ver u8=4 | bits u16 LE | extraBits u32 LE | locktime u32 LE
 */

import {
  MOORE_DAY_SECONDS,
  MOORE_DAYS_PER_EXTRA_BIT,
} from '../params/consensus.js';

export const WLPT_LOKAD = new TextEncoder().encode('WLPT');
export const WLPT_VERSION = 4;

/** Production Moore clock: +1 bit / 840 days. */
export const PROD_SECONDS_PER_EXTRA_BIT =
  MOORE_DAYS_PER_EXTRA_BIT * MOORE_DAY_SECONDS;

/** Absolute bit ceiling in WlotusPowRemintMooreTip.spedn. */
export const MOORE_TIP_MAX_BITS = 128;

export interface MooreTipParams {
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  tipLocktime: number;
}

export interface MooreTipState {
  locktime: number;
  tipLocktime: number;
  extraBits: number;
  bits: number;
}

export function computeMooreTipState(
  locktime: number,
  params: MooreTipParams,
): MooreTipState {
  if (locktime < params.genesisUnix) {
    throw new Error(
      `locktime ${locktime} < genesisUnix ${params.genesisUnix}`,
    );
  }
  if (locktime < params.tipLocktime) {
    throw new Error(
      `locktime ${locktime} < tipLocktime ${params.tipLocktime} (rewind)`,
    );
  }
  const elapsed = locktime - params.genesisUnix;
  const extraBits = Math.floor(elapsed / params.secondsPerExtraBit);
  const bits = params.baseZeroBits + extraBits;
  if (bits > MOORE_TIP_MAX_BITS) {
    throw new Error(`bits ${bits} exceeds cap ${MOORE_TIP_MAX_BITS}`);
  }
  return {
    locktime,
    tipLocktime: params.tipLocktime,
    extraBits,
    bits,
  };
}

function u16Le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new Error(`u16 out of range: ${n}`);
  }
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32Le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`u32 Script-safe out of range: ${n}`);
  }
  const v = n >>> 0;
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

/** Build the 15-byte WLPT v4 EMPP push (must match Spedn covenant). */
export function wlptV4Pushdata(state: MooreTipState): Uint8Array {
  const out = new Uint8Array(15);
  out.set(WLPT_LOKAD, 0);
  out[4] = WLPT_VERSION;
  out.set(u16Le(state.bits), 5);
  out.set(u32Le(state.extraBits), 7);
  out.set(u32Le(state.locktime), 11);
  return out;
}
