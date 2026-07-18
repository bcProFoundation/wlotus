import {
  computeMooreTipState,
  wlptV4Pushdata,
  WLPT_LOKAD,
  WLPT_VERSION,
  PROD_SECONDS_PER_EXTRA_BIT,
  MOORE_TIP_MAX_BITS,
} from '../src/covenant/mooreTip.js';
import {
  POW_CANDLE_BASE_ZERO_BITS,
  POW_FLOWER_BASE_ZERO_BITS,
  POW_PRAYER_BASE_ZERO_BITS,
} from '../src/params/consensus.js';

describe('MooreTip production covenant', () => {
  const genesis = 1_700_000_000;
  const base = {
    genesisUnix: genesis,
    baseZeroBits: POW_PRAYER_BASE_ZERO_BITS,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: genesis,
  };

  it('uses production Moore clock (840d/bit) not activity', () => {
    const day0 = computeMooreTipState(genesis, base);
    expect(day0.bits).toBe(22);
    expect(day0.extraBits).toBe(0);

    const after840d = computeMooreTipState(
      genesis + PROD_SECONDS_PER_EXTRA_BIT,
      base,
    );
    expect(after840d.extraBits).toBe(1);
    expect(after840d.bits).toBe(23);
  });

  it('dryrun whole-byte bases stay under absolute cap', () => {
    for (const bits of [24, 40, 56]) {
      const s = computeMooreTipState(genesis, { ...base, baseZeroBits: bits });
      expect(s.bits % 8).toBe(0);
      expect(s.bits).toBeLessThanOrEqual(MOORE_TIP_MAX_BITS);
    }
  });

  it('rejects tip rewind', () => {
    expect(() =>
      computeMooreTipState(genesis + 10, {
        ...base,
        tipLocktime: genesis + 100,
      }),
    ).toThrow(/rewind/);
  });

  it('allows production bit targets under absolute cap', () => {
    for (const bits of [
      POW_PRAYER_BASE_ZERO_BITS,
      POW_CANDLE_BASE_ZERO_BITS,
      POW_FLOWER_BASE_ZERO_BITS,
    ]) {
      const s = computeMooreTipState(genesis, { ...base, baseZeroBits: bits });
      expect(s.bits).toBe(bits);
      expect(s.bits).toBeLessThanOrEqual(MOORE_TIP_MAX_BITS);
    }
  });

  it('WLPT v4 is 15 bytes', () => {
    const s = computeMooreTipState(genesis + 1, base);
    const push = wlptV4Pushdata(s);
    expect(push.length).toBe(15);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLPT_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLPT_VERSION);
  });

  it('absolute cap is 128 not base+8', () => {
    expect(MOORE_TIP_MAX_BITS).toBe(128);
    expect(
      POW_FLOWER_BASE_ZERO_BITS + 8,
    ).toBeLessThan(MOORE_TIP_MAX_BITS);
  });
});
