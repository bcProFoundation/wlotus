import {
  DEFAULT_PRAYER_BASE_BITS,
  estimatePrayerPow,
  expectedHashesFromBits,
  formatElapsedTenthsMin,
  OFFER_DESK_OVERHEAD_SECONDS,
} from '../apps/web/src/lib/powEstimate.js';
import {
  formatActualDurationLocale,
  formatElapsedTenthsMinLocale,
  formatEstimateDurationLocale,
} from '../apps/web/src/i18n/format.js';

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

describe('elapsed / estimate / actual duration units', () => {
  it('elapsed tenths use real minutes (6s = 0.1), matching actual', () => {
    // User report: ~126s session showed elapsed 1.2 vs actual 2.1
    expect(formatElapsedTenthsMin(126_000)).toBe('2.1 min');
    expect(formatElapsedTenthsMinLocale(126_000, 'en')).toBe('2.1 min');
    expect(formatElapsedTenthsMinLocale(126_000, 'vi')).toBe('2.1 phút');
    expect(formatActualDurationLocale(126, 'en')).toBe('2.1 min');
  });

  it('steps elapsed every 0.1 real minute', () => {
    expect(formatElapsedTenthsMin(0)).toBe('0.0 min');
    expect(formatElapsedTenthsMin(5_999)).toBe('0.0 min');
    expect(formatElapsedTenthsMin(6_000)).toBe('0.1 min');
    expect(formatElapsedTenthsMin(108_000)).toBe('1.8 min');
  });

  it('low-diff ETA (min pray + desk overhead) aligns with ~2.1 min sessions', () => {
    expect(OFFER_DESK_OVERHEAD_SECONDS).toBe(20);
    const minPray = 108;
    const etaSeconds = Math.max(0, minPray) + OFFER_DESK_OVERHEAD_SECONDS;
    expect(formatEstimateDurationLocale(etaSeconds, 'en')).toBe('~2.1 min');
  });
});
