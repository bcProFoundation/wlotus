import {
  computePrayerTipState,
  wlptPushdata,
  WLPT_LOKAD,
  WLPT_VERSION,
} from '../src/covenant/wlpt.js';

const base = {
  genesisUnix: 1_700_000_000,
  baseZeroBits: 1,
  minGapSeconds: 60,
  coolGapSeconds: 3_600,
  tipLocktime: 1_700_000_000,
  tipActivity: 0,
};

describe('prayer tip activity', () => {
  it('bumps activity when gap < minGap', () => {
    const s = computePrayerTipState(base.tipLocktime, base);
    expect(s.gap).toBe(0);
    expect(s.activityPrime).toBe(1);
    expect(s.bits).toBe(2);
  });

  it('holds activity in the middle band', () => {
    const s = computePrayerTipState(base.tipLocktime + 120, {
      ...base,
      tipActivity: 3,
    });
    expect(s.activityPrime).toBe(3);
    expect(s.bits).toBe(4);
  });

  it('cools activity when gap ≥ coolGap', () => {
    const s = computePrayerTipState(base.tipLocktime + 3_600, {
      ...base,
      tipActivity: 2,
    });
    expect(s.activityPrime).toBe(1);
    expect(s.bits).toBe(2);
  });

  it('caps activity at 8', () => {
    const s = computePrayerTipState(base.tipLocktime, {
      ...base,
      tipActivity: 8,
    });
    expect(s.activityPrime).toBe(8);
    expect(s.bits).toBe(9);
  });

  it('rejects rewind below tipLocktime', () => {
    expect(() =>
      computePrayerTipState(base.tipLocktime + 100, {
        ...base,
        tipLocktime: base.tipLocktime + 200,
      }),
    ).toThrow(/rewind/);
  });

  it('builds 16-byte WLPT push', () => {
    const s = computePrayerTipState(base.tipLocktime + 10, {
      ...base,
      tipActivity: 1,
    });
    const push = wlptPushdata(s);
    expect(push.length).toBe(16);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLPT_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLPT_VERSION);
    expect(push[5] | (push[6]! << 8)).toBe(s.bits);
    expect(push[7]).toBe(s.activityPrime);
  });
});
