/**
 * eMPP WLPT v2 — tip announcement beside ALP MINT (no difficulty bump).
 *
 * Layout (13 bytes):
 *   WLPT (4) | ver u8=2 | locktime u32 LE | tipLocktime u32 LE
 *
 * Scale = N batons (independent tips), fixed 1-byte PoW.
 */

export const WLPT_LOKAD = new TextEncoder().encode('WLPT');
export const WLPT_VERSION = 2;

/** Fixed toy difficulty for tip Prayer. */
export const PRAYER_TIP_ZERO_BYTES = 1;

export interface PrayerTipParams {
  genesisUnix: number;
  tipLocktime: number;
}

export interface PrayerTipState {
  locktime: number;
  tipLocktime: number;
  zeroBytes: number;
  bits: number;
}

export function computePrayerTipState(
  locktime: number,
  params: PrayerTipParams,
): PrayerTipState {
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
  return {
    locktime,
    tipLocktime: params.tipLocktime,
    zeroBytes: PRAYER_TIP_ZERO_BYTES,
    bits: PRAYER_TIP_ZERO_BYTES * 8,
  };
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

/** Build the 13-byte WLPT v2 EMPP push (must match Spedn covenant). */
export function wlptPushdata(state: PrayerTipState): Uint8Array {
  const out = new Uint8Array(13);
  out.set(WLPT_LOKAD, 0);
  out[4] = WLPT_VERSION;
  out.set(u32Le(state.locktime), 5);
  out.set(u32Le(state.tipLocktime), 9);
  return out;
}
