import {
  computePrayerTipState,
  wlptPushdata,
  WLPT_LOKAD,
  WLPT_VERSION,
  PRAYER_TIP_ZERO_BYTES,
} from '../src/covenant/wlpt.js';

const base = {
  genesisUnix: 1_700_000_000,
  tipLocktime: 1_700_000_000,
};

describe('prayer tip scale (fixed PoW)', () => {
  it('keeps fixed 1-byte PoW regardless of gap', () => {
    const rapid = computePrayerTipState(base.tipLocktime, base);
    const later = computePrayerTipState(base.tipLocktime + 3600, base);
    expect(rapid.zeroBytes).toBe(PRAYER_TIP_ZERO_BYTES);
    expect(later.zeroBytes).toBe(PRAYER_TIP_ZERO_BYTES);
    expect(rapid.bits).toBe(8);
  });

  it('rejects rewind below tipLocktime', () => {
    expect(() =>
      computePrayerTipState(base.tipLocktime + 100, {
        ...base,
        tipLocktime: base.tipLocktime + 200,
      }),
    ).toThrow(/rewind/);
  });

  it('builds 13-byte WLPT v2 push', () => {
    const s = computePrayerTipState(base.tipLocktime + 10, base);
    const push = wlptPushdata(s);
    expect(push.length).toBe(13);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLPT_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLPT_VERSION);
  });
});
