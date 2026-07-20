import { parseTipPollMs } from '../apps/web/src/lib/tipPollMs.js';

describe('parseTipPollMs', () => {
  it('defaults to 2s when unset or invalid', () => {
    expect(parseTipPollMs(undefined)).toBe(2_000);
    expect(parseTipPollMs('')).toBe(2_000);
    expect(parseTipPollMs('nope')).toBe(2_000);
    expect(parseTipPollMs('0')).toBe(2_000);
  });

  it('clamps to 1–30 seconds', () => {
    expect(parseTipPollMs('1000')).toBe(1_000);
    expect(parseTipPollMs('5000')).toBe(5_000);
    expect(parseTipPollMs('500')).toBe(1_000);
    expect(parseTipPollMs('60000')).toBe(30_000);
  });
});
