import {
  DEFAULT_MIN_PRAY_SECONDS,
  MAX_MIN_PRAY_SECONDS,
  minPraySecondsToMs,
  parseMinPraySeconds,
  remainingMinPrayMs,
} from '../apps/web/src/lib/minPraySeconds.js';

describe('parseMinPraySeconds', () => {
  it('defaults to 108s when unset or invalid', () => {
    expect(parseMinPraySeconds(undefined)).toBe(DEFAULT_MIN_PRAY_SECONDS);
    expect(parseMinPraySeconds('')).toBe(DEFAULT_MIN_PRAY_SECONDS);
    expect(parseMinPraySeconds('nope')).toBe(DEFAULT_MIN_PRAY_SECONDS);
    expect(parseMinPraySeconds('-1')).toBe(DEFAULT_MIN_PRAY_SECONDS);
    expect(DEFAULT_MIN_PRAY_SECONDS).toBe(108);
  });

  it('allows 0 to disable', () => {
    expect(parseMinPraySeconds('0')).toBe(0);
  });

  it('parses seconds and clamps to 10 min', () => {
    expect(parseMinPraySeconds('60')).toBe(60);
    expect(parseMinPraySeconds('108')).toBe(108);
    expect(parseMinPraySeconds('90')).toBe(90);
    expect(parseMinPraySeconds('999')).toBe(MAX_MIN_PRAY_SECONDS);
  });
});

describe('minPraySecondsToMs / remainingMinPrayMs', () => {
  it('converts and computes remaining', () => {
    expect(minPraySecondsToMs(108)).toBe(108_000);
    expect(minPraySecondsToMs(0)).toBe(0);
    expect(remainingMinPrayMs(1000, 108_000, 11_000)).toBe(98_000);
  });
});
