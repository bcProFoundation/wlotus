/**
 * eMPP WLPT (White Lotus Prayer Tip) pushdata — tip announcement beside ALP MINT.
 *
 * Layout (16 bytes):
 *   WLPT (4) | ver u8 | bits u16 LE | activity u8 | locktime u32 LE | tipLocktime u32 LE
 *
 * Consensus tip' lives in the next P2SH redeem; WLPT must match this remint.
 */

export const WLPT_LOKAD = new TextEncoder().encode('WLPT');
export const WLPT_VERSION = 1;

/** Cap matches WlotusPowRemintPrayerTip.spedn: activity ≤ 8. */
export const PRAYER_TIP_MAX_ACTIVITY = 8;

export interface PrayerTipParams {
  genesisUnix: number;
  baseZeroBits: number;
  minGapSeconds: number;
  coolGapSeconds: number;
  tipLocktime: number;
  tipActivity: number;
}

export interface PrayerTipState {
  locktime: number;
  tipLocktime: number;
  tipActivity: number;
  activityPrime: number;
  bits: number;
  gap: number;
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
  if (
    !Number.isInteger(params.tipActivity) ||
    params.tipActivity < 0 ||
    params.tipActivity > PRAYER_TIP_MAX_ACTIVITY
  ) {
    throw new Error(`tipActivity out of range: ${params.tipActivity}`);
  }

  const gap = locktime - params.tipLocktime;
  let activityPrime = params.tipActivity;
  if (gap < params.minGapSeconds) {
    activityPrime = Math.min(params.tipActivity + 1, PRAYER_TIP_MAX_ACTIVITY);
  } else if (gap >= params.coolGapSeconds) {
    activityPrime = Math.max(params.tipActivity - 1, 0);
  }

  const bits = params.baseZeroBits + activityPrime;
  if (bits > params.baseZeroBits + PRAYER_TIP_MAX_ACTIVITY) {
    throw new Error(`bits ${bits} exceeds tip cap`);
  }

  return {
    locktime,
    tipLocktime: params.tipLocktime,
    tipActivity: params.tipActivity,
    activityPrime,
    bits,
    gap,
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

/** Build the 16-byte WLPT EMPP push (must match Spedn covenant). */
export function wlptPushdata(state: PrayerTipState): Uint8Array {
  const out = new Uint8Array(16);
  out.set(WLPT_LOKAD, 0);
  out[4] = WLPT_VERSION;
  out.set(u16Le(state.bits), 5);
  out[7] = state.activityPrime & 0xff;
  out.set(u32Le(state.locktime), 8);
  out.set(u32Le(state.tipLocktime), 12);
  return out;
}
