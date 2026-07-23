import {
  DEFAULT_PRAYER_BASE_BITS,
  estimatePrayerPow,
  expectedHashesFromBits,
} from '../apps/web/src/lib/powEstimate.js';

describe('estimatePrayerPow / baseZeroBits=0', () => {
  it('treats bits=0 as valid (not missing → legacy 24)', () => {
    expect(DEFAULT_PRAYER_BASE_BITS).toBe(0);
    expect(expectedHashesFromBits(0)).toBe(1);

    const eta = estimatePrayerPow({ bits: 0, hashesPerSec: 1_000 });
    expect(eta.bits).toBe(0);
    expect(eta.expectedHashes).toBe(1);
    // ~1 hash / 1000 H/s * 1.3 buffer — sub-second, not multi-hour
    expect(eta.seconds).toBeLessThan(1);
  });

  it('does not fall back to 24 when bits is explicitly 0', () => {
    const wrongLegacy =
      (2 ** 24) / 1_000 * 1.3; /* ~6.1 h if 0 were treated as missing */
    const eta = estimatePrayerPow({ bits: 0, hashesPerSec: 1_000 });
    expect(eta.seconds).toBeLessThan(wrongLegacy / 1000);
  });

  it('still estimates 24-bit work when bits=24', () => {
    const eta = estimatePrayerPow({ bits: 24, hashesPerSec: 1_000 });
    expect(eta.bits).toBe(24);
    expect(eta.seconds).toBeCloseTo((2 ** 24) / 1_000 * 1.3, 0);
  });
});
