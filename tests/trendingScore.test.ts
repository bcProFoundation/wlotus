import {
  compareTrending,
  TRENDING_GRAVITY,
  trendingBurnScore,
  trendingGroupScore,
} from '../src/lib/trendingScore.js';

const hour = 3_600_000;
const nowMs = Date.parse('2026-08-30T12:00:00.000Z');

describe('trendingBurnScore', () => {
  it('uses HN-style gravity so newer offerings outrank older ones', () => {
    expect(TRENDING_GRAVITY).toBe(1.5);
    const fresh = trendingBurnScore(1);
    const dayOld = trendingBurnScore(24);
    const weekOld = trendingBurnScore(7 * 24);
    expect(fresh).toBeGreaterThan(dayOld);
    expect(dayOld).toBeGreaterThan(weekOld);
    expect(weekOld).toBeGreaterThan(0);
  });
});

describe('trendingGroupScore', () => {
  it('sums every burn so a quiet week still ranks', () => {
    const oneHourAgo = nowMs - hour;
    const threeDaysAgo = nowMs - 3 * 24 * hour;
    const weekAgo = nowMs - 7 * 24 * hour;
    const hot = trendingGroupScore([oneHourAgo, oneHourAgo - 60_000], nowMs);
    const warm = trendingGroupScore([threeDaysAgo], nowMs);
    const lingering = trendingGroupScore([weekAgo], nowMs);
    expect(hot).toBeGreaterThan(warm);
    expect(warm).toBeGreaterThan(lingering);
    expect(lingering).toBeGreaterThan(0);
  });

  it('ignores future and invalid timestamps', () => {
    expect(trendingGroupScore([nowMs + hour, 0, -1], nowMs)).toBe(0);
  });
});

describe('compareTrending', () => {
  it('breaks score ties by recency', () => {
    expect(
      compareTrending(
        { score: 1, atMs: 10 },
        { score: 1, atMs: 20 },
      ),
    ).toBeGreaterThan(0);
  });
});
