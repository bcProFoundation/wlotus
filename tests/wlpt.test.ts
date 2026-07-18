import {
  computePrayerTipState,
  wlptPushdata,
  WLPT_LOKAD,
  WLPT_VERSION,
  PRAYER_TIP_MIN_GAP_SECONDS,
} from '../src/covenant/wlpt.js';

const base = {
  genesisUnix: 1_700_000_000,
  tipLocktime: 1_700_000_000,
  tipActivity: 0,
};

describe('prayer tip activity', () => {
  it('bumps activity when gap < minGap', () => {
    const s = computePrayerTipState(base.tipLocktime, base);
    expect(s.gap).toBe(0);
    expect(s.activityPrime).toBe(1);
    expect(s.zeroBytes).toBe(2);
    expect(s.bits).toBe(16);
  });

  it('holds activity when gap ≥ minGap', () => {
    const s = computePrayerTipState(
      base.tipLocktime + PRAYER_TIP_MIN_GAP_SECONDS,
      { ...base, tipActivity: 1 },
    );
    expect(s.activityPrime).toBe(1);
    expect(s.zeroBytes).toBe(2);
  });

  it('caps activity at 2', () => {
    const s = computePrayerTipState(base.tipLocktime, {
      ...base,
      tipActivity: 2,
    });
    expect(s.activityPrime).toBe(2);
    expect(s.zeroBytes).toBe(3);
  });

  it('rejects rewind below tipLocktime', () => {
    expect(() =>
      computePrayerTipState(base.tipLocktime + 100, {
        ...base,
        tipLocktime: base.tipLocktime + 200,
      }),
    ).toThrow(/rewind/);
  });

  it('builds 15-byte WLPT push', () => {
    const s = computePrayerTipState(base.tipLocktime + 10, {
      ...base,
      tipActivity: 1,
    });
    const push = wlptPushdata(s);
    expect(push.length).toBe(15);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLPT_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLPT_VERSION);
    expect(push[5]).toBe(s.zeroBytes);
    expect(push[6]).toBe(s.activityPrime);
  });
});
