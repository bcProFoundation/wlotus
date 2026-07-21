import {
  DEFAULT_MIN_PRAY_S,
  MAX_MIN_PRAY_S,
  minPraySecondsToMs,
  parseLegacyMinPrayMsAsSeconds,
  parseMinPraySeconds,
  remainingMinPrayMs,
} from '../apps/web/src/lib/minPrayS.js';

describe('parseMinPraySeconds', () => {
  it('defaults to 60s when unset or invalid', () => {
    expect(parseMinPraySeconds(undefined)).toBe(DEFAULT_MIN_PRAY_S);
    expect(parseMinPraySeconds('')).toBe(DEFAULT_MIN_PRAY_S);
    expect(parseMinPraySeconds('nope')).toBe(DEFAULT_MIN_PRAY_S);
    expect(parseMinPraySeconds('-1')).toBe(DEFAULT_MIN_PRAY_S);
  });

  it('allows 0 to disable', () => {
    expect(parseMinPraySeconds('0')).toBe(0);
  });

  it('parses seconds and clamps to 10 min', () => {
    expect(parseMinPraySeconds('60')).toBe(60);
    expect(parseMinPraySeconds('90')).toBe(90);
    expect(parseMinPraySeconds('999')).toBe(MAX_MIN_PRAY_S);
  });
});

describe('parseLegacyMinPrayMsAsSeconds', () => {
  it('treats small values as seconds and large as ms', () => {
    expect(parseLegacyMinPrayMsAsSeconds(undefined)).toBeNull();
    expect(parseLegacyMinPrayMsAsSeconds('60')).toBe(60);
    expect(parseLegacyMinPrayMsAsSeconds('60000')).toBe(60);
    expect(parseLegacyMinPrayMsAsSeconds('0')).toBe(0);
  });
});

describe('minPraySecondsToMs / remainingMinPrayMs', () => {
  it('converts and computes remaining', () => {
    expect(minPraySecondsToMs(60)).toBe(60_000);
    expect(minPraySecondsToMs(0)).toBe(0);
    expect(remainingMinPrayMs(1000, 60_000, 11_000)).toBe(50_000);
  });
});
