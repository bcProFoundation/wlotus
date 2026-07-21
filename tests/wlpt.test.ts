import {
  computePrayerTipState,
  wlptPushdata,
  WLPT_LOKAD,
  WLPT_VERSION,
  TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  TEST_PRAYER_TIP_BASE_ZERO_BITS,
} from '../src/covenant/wlpt.js';

const base = {
  genesisUnix: 1_700_000_000,
  baseZeroBits: TEST_PRAYER_TIP_BASE_ZERO_BITS,
  secondsPerExtraBit: TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  tipLocktime: 1_700_000_000,
};

describe('prayer tip Moore + tipLocktime', () => {
  it('uses Moore bits from locktime (not activity)', () => {
    const day0 = computePrayerTipState(base.genesisUnix, base);
    expect(day0.bits).toBe(8);
    expect(day0.extraBits).toBe(0);

    const day1 = computePrayerTipState(
      base.genesisUnix + TEST_MOORE_SECONDS_PER_EXTRA_BIT,
      { ...base, tipLocktime: base.genesisUnix },
    );
    expect(day1.extraBits).toBe(1);
    expect(day1.bits).toBe(9);
  });

  it('rejects rewind below tipLocktime even if Moore-valid', () => {
    expect(() =>
      computePrayerTipState(base.genesisUnix + 100, {
        ...base,
        tipLocktime: base.genesisUnix + 200,
      }),
    ).toThrow(/rewind/);
  });

  it('builds 19-byte DANA tip v3 push', () => {
    const s = computePrayerTipState(base.genesisUnix + 10, base);
    const push = wlptPushdata(s);
    expect(push.length).toBe(19);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLPT_LOKAD))).toBe(
      true,
    );
    expect(Buffer.from(push.slice(0, 4)).toString('ascii')).toBe('DANA');
    expect(push[4]).toBe(WLPT_VERSION);
    expect(push[5] | (push[6]! << 8)).toBe(s.bits);
  });
});
