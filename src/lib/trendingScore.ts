/**
 * Home Trending score — Hacker News gravity on each offering.
 *
 * A hard 24-hour window goes empty when the network is quiet. Summing
 * `1 / (ageHours + 2)^G` keeps recent burns on top while older offerings
 * still contribute, so the list stays populated.
 */

/** Higher gravity fades older offerings faster. 1.5 is a bit milder than HN 1.8. */
export const TRENDING_GRAVITY = 1.5;

const MS_PER_HOUR = 3_600_000;

export function trendingBurnScore(
  ageHours: number,
  gravity = TRENDING_GRAVITY,
): number {
  const age = Number.isFinite(ageHours) ? Math.max(0, ageHours) : 0;
  return 1 / (age + 2) ** gravity;
}

export function trendingGroupScore(
  activityTimesMs: readonly number[],
  nowMs: number,
  gravity = TRENDING_GRAVITY,
): number {
  let score = 0;
  for (const t of activityTimesMs) {
    if (!(t > 0) || t > nowMs) continue;
    score += trendingBurnScore((nowMs - t) / MS_PER_HOUR, gravity);
  }
  return score;
}

export function compareTrending(
  a: { score: number; atMs: number },
  b: { score: number; atMs: number },
): number {
  if (a.score !== b.score) return b.score - a.score;
  return b.atMs - a.atMs;
}
