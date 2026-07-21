import {
  DEFAULT_MIN_PRAY_MS,
  MAX_MIN_PRAY_MS,
  parseMinPrayMs,
  remainingMinPrayMs,
} from '../apps/web/src/lib/minPrayMs.js';

describe('parseMinPrayMs', () => {
  it('defaults to 60s when unset or invalid', () => {
    expect(parseMinPrayMs(undefined)).toBe(DEFAULT_MIN_PRAY_MS);
    expect(parseMinPrayMs('')).toBe(DEFAULT_MIN_PRAY_MS);
    expect(parseMinPrayMs('nope')).toBe(DEFAULT_MIN_PRAY_MS);
    expect(parseMinPrayMs('-1')).toBe(DEFAULT_MIN_PRAY_MS);
  });

  it('allows 0 to disable', () => {
    expect(parseMinPrayMs('0')).toBe(0);
  });

  it('clamps to 10 minutes max', () => {
    expect(parseMinPrayMs('60000')).toBe(60_000);
    expect(parseMinPrayMs('120000')).toBe(120_000);
    expect(parseMinPrayMs('999999')).toBe(MAX_MIN_PRAY_MS);
  });
});

describe('remainingMinPrayMs', () => {
  it('returns 0 when disabled or already elapsed', () => {
    expect(remainingMinPrayMs(1000, 0, 1500)).toBe(0);
    expect(remainingMinPrayMs(1000, 60_000, 61_000)).toBe(0);
  });

  it('returns remaining wall time', () => {
    expect(remainingMinPrayMs(1000, 60_000, 11_000)).toBe(50_000);
  });
});
