/**
 * eMPP WLPT (White Lotus Prayer Tip) pushdata — tip announcement beside ALP MINT.
 *
 * Layout (15 bytes):
 *   WLPT (4) | ver u8 | zeroBytes u8 | activity u8 | locktime u32 LE | tipLocktime u32 LE
 *
 * Dogfood: zeroBytes = 1 + activityPrime (cap activity 2 → max 3 leading zero bytes).
 * minGap hardcoded to 60s in the covenant (op budget).
 */

export const WLPT_LOKAD = new TextEncoder().encode('WLPT');
export const WLPT_VERSION = 1;

/** Cap matches WlotusPowRemintPrayerTip.spedn: activity ≤ 2. */
export const PRAYER_TIP_MAX_ACTIVITY = 2;

/** Hardcoded in covenant. */
export const PRAYER_TIP_MIN_GAP_SECONDS = 60;

export interface PrayerTipParams {
  genesisUnix: number;
  tipLocktime: number;
  tipActivity: number;
}

export interface PrayerTipState {
  locktime: number;
  tipLocktime: number;
  tipActivity: number;
  activityPrime: number;
  zeroBytes: number;
  /** Equivalent bit count for miners (zeroBytes * 8). */
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
  const activityPrime =
    gap < PRAYER_TIP_MIN_GAP_SECONDS
      ? Math.min(params.tipActivity + 1, PRAYER_TIP_MAX_ACTIVITY)
      : params.tipActivity;
  const zeroBytes = 1 + activityPrime;
  return {
    locktime,
    tipLocktime: params.tipLocktime,
    tipActivity: params.tipActivity,
    activityPrime,
    zeroBytes,
    bits: zeroBytes * 8,
    gap,
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

/** Build the 15-byte WLPT EMPP push (must match Spedn covenant). */
export function wlptPushdata(state: PrayerTipState): Uint8Array {
  const out = new Uint8Array(15);
  out.set(WLPT_LOKAD, 0);
  out[4] = WLPT_VERSION;
  out[5] = state.zeroBytes & 0xff;
  out[6] = state.activityPrime & 0xff;
  out.set(u32Le(state.locktime), 7);
  out.set(u32Le(state.tipLocktime), 11);
  return out;
}
