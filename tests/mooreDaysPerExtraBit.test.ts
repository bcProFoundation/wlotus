import {
  MOORE_DAYS_PER_EXTRA_BIT,
  MOORE_DAYS_PER_EXTRA_BIT_MAX,
  MOORE_DAYS_PER_EXTRA_BIT_MIN,
  resolveMooreDaysPerExtraBit,
} from '../src/params/consensus.js';
import { resolveProdSecondsPerExtraBit } from '../src/covenant/mooreTip.js';

describe('resolveMooreDaysPerExtraBit', () => {
  it('defaults to 365 (1 year)', () => {
    expect(MOORE_DAYS_PER_EXTRA_BIT).toBe(365);
    expect(resolveMooreDaysPerExtraBit(undefined)).toBe(365);
    expect(resolveMooreDaysPerExtraBit('')).toBe(365);
  });

  it('clamps to 365–730 (1–2 years)', () => {
    expect(resolveMooreDaysPerExtraBit('365')).toBe(365);
    expect(resolveMooreDaysPerExtraBit('730')).toBe(730);
    expect(resolveMooreDaysPerExtraBit('100')).toBe(MOORE_DAYS_PER_EXTRA_BIT_MIN);
    expect(resolveMooreDaysPerExtraBit('9999')).toBe(MOORE_DAYS_PER_EXTRA_BIT_MAX);
  });

  it('maps to seconds for covenant bake', () => {
    expect(resolveProdSecondsPerExtraBit('365')).toBe(365 * 86_400);
    expect(resolveProdSecondsPerExtraBit('730')).toBe(730 * 86_400);
  });
});
