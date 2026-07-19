/**
 * Prayer tip state: Moore bits + tipLocktime (no activity).
 *
 * eMPP WLPT v3 layout (19 bytes):
 *   WLPT (4) | ver u8=3 | bits u16 LE | extraBits u32 LE | locktime u32 LE | tipLocktime u32 LE
 */

import {
  computeMooreBits,
  TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  type MooreBitsParams,
  type MooreBitsState,
} from './wldf.js';

export const WLPT_LOKAD = new TextEncoder().encode('WLPT');
export const WLPT_VERSION = 3;

export { TEST_MOORE_SECONDS_PER_EXTRA_BIT };

/** Dogfood base: 1 leading zero byte (= 8 bits), +1 bit / day like Moore toys. */
export const TEST_PRAYER_TIP_BASE_ZERO_BITS = 8;

export interface PrayerTipParams extends MooreBitsParams {
  tipLocktime: number;
}

export interface PrayerTipState extends MooreBitsState {
  tipLocktime: number;
}

export function computePrayerTipState(
  locktime: number,
  params: PrayerTipParams,
): PrayerTipState {
  if (locktime < params.tipLocktime) {
    throw new Error(
      `locktime ${locktime} < tipLocktime ${params.tipLocktime} (rewind)`,
    );
  }
  const moore = computeMooreBits(locktime, params);
  return { ...moore, tipLocktime: params.tipLocktime };
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

/** Build the 19-byte WLPT v3 EMPP push (must match Spedn covenant). */
export function wlptPushdata(state: PrayerTipState): Uint8Array {
  const out = new Uint8Array(19);
  out.set(WLPT_LOKAD, 0);
  out[4] = WLPT_VERSION;
  out.set(u16Le(state.bits), 5);
  out.set(u32Le(state.extraBits), 7);
  out.set(u32Le(state.locktime), 11);
  out.set(u32Le(state.tipLocktime), 15);
  return out;
}
