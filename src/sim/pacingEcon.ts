/**
 * Miner-paced issuance economics (ELOTUS v4 research simulator) — PURE.
 *
 * Answers: what happens to issuance / difficulty-lag / miner P&L when
 * miners choose backfill-vs-jump under varying block-reward value ($1 vs
 * $100 per 100-token block), token crashes, and REAL energy costs?
 *
 * Energy model (the point of the sim — unforgeable costliness, not
 * printing out of thin air): network energy per block E = E0·G/target,
 * with E0 = $0.30 at genesis target (30% of a $1 block). E0 is an
 * explicit PRODUCTION-PUZZLE ASSUMPTION: today's 128-sha256 placeholder
 * costs ~$1e-11 (eleven orders short); production needs sequential or
 * memory-hard work ~2e8x harder (TBD). E scales with 1/target (physics),
 * independent of token price — so the energy share is highest at LOW
 * prices (30% @ $1) and collapses at high ones (0.3% @ $100).
 * Consequence baked in: monotonic difficulty + real energy = a treadmill
 * (E grows 0.0815%/day; flat $1 exhausts margin in ~4 years — the sim's
 * R7 runs show it; only rising prices or the crash/resurrect cobweb
 * outrun it).
 *
 * Races: entry M* = (R−F−E)/o (rent dissipation — miners enter until
 * per-miner expected cash ≈ opportunity cost); winner uniform (symmetric
 * first-seen; fee-bidding NOT modeled). Losers burn E/M* each (all-pay).
 * P&L attributes loser energy by population fractions (expected-value,
 * exact in expectation; keeps rounds O(1)). Strategies: backfill (tip+1),
 * jump (latest), threshold (backfill iff backlog ≤ 12).
 *
 * Seeded (mulberry32) → fully reproducible trajectories.
 */
import {
  UDELTA_DENOMINATOR,
  UDELTA_NUMERATOR,
} from '../covenant/singleShardDeltaMath.js';

export type PacingStrategy = 'backfill' | 'jump' | 'threshold';

export interface SimPopulation {
  backfill: number;
  jump: number;
  threshold: number;
}

export interface SimParams {
  slots: number;
  /** Block reward (100 tokens) in USD per slot. */
  rewardUsd: (slot: number) => number;
  /** XEC/USD per slot (fee channel — dust at real prices). */
  xecUsd: (slot: number) => number;
  population: SimPopulation;
  /** Protocol fee in sats (default 1750 — measured single-shard remint). */
  feeSats?: number;
  /** Network energy $/block at genesis target (default 0.30). */
  energy0Usd?: number;
  roundsPerSlot?: number;
  /** Per-race fixed cost in USD (default 0.005 ≈ $21/mo always-on infra). */
  opportunityUsd?: number;
  threshold?: number;
  genesisTarget?: number;
  seed?: number;
}

export interface SimResult {
  slots: number;
  blocks: number;
  filled: number;
  destroyed: number;
  utilization: number;
  issuance: number;
  finalTarget: number;
  scheduleTarget: number;
  /** Share of the full-utilization schedule movement lost to lag (0–1). */
  lagShare: number;
  feesUsd: number;
  energyUsd: number;
  profitByStrategy: Record<PacingStrategy, number>;
  winsByStrategy: Record<PacingStrategy, number>;
  avgEntrants: number;
  idleSlots: number;
  recoverySlots: number;
  maxBacklog: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One covenant micro-step: t − floor(t·82/14400000). */
export function microStep(t: number): number {
  return t - Math.floor((t * UDELTA_NUMERATOR) / UDELTA_DENOMINATOR);
}

export function feeUsd(feeSats: number, xecUsdRate: number): number {
  return (feeSats / 100) * xecUsdRate;
}

/** Network energy $/block at the current target (scales with 1/target). */
export function energyPerBlock(
  energy0Usd: number,
  genesisTarget: number,
  target: number,
): number {
  return (energy0Usd * genesisTarget) / target;
}

export function strategyTarget(
  strategy: PacingStrategy,
  tip: number,
  latest: number,
  threshold: number,
): number {
  if (strategy === 'jump') return latest;
  if (strategy === 'backfill') return tip + 1;
  return latest - tip <= threshold ? tip + 1 : latest;
}

const zeroStrategies = (): Record<PacingStrategy, number> => ({
  backfill: 0,
  jump: 0,
  threshold: 0,
});

export function runSim(p: SimParams): SimResult {
  const feeSats = p.feeSats ?? 1750;
  const energy0 = p.energy0Usd ?? 0.3;
  const roundsPerSlot = p.roundsPerSlot ?? 30;
  const o = p.opportunityUsd ?? 0.005;
  const threshold = p.threshold ?? 12;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const rng = mulberry32(p.seed ?? 1);
  const popTotal =
    p.population.backfill + p.population.jump + p.population.threshold;
  const fracB = p.population.backfill / popTotal;
  const fracJ = p.population.jump / popTotal;

  let tip = 0;
  let target = genesis;
  let blocks = 0;
  let filled = 0;
  let destroyed = 0;
  let idleSlots = 0;
  let recoverySlots = 0;
  let maxBacklog = 0;
  let feesUsd = 0;
  let energyUsd = 0;
  let entrantsSum = 0;
  let roundCount = 0;
  const profit = zeroStrategies();
  const wins = zeroStrategies();

  for (let slot = 1; slot <= p.slots; slot++) {
    const latest = slot;
    const backlogStart = latest - tip;
    if (backlogStart > maxBacklog) maxBacklog = backlogStart;
    const R = p.rewardUsd(slot);
    const F = feeUsd(feeSats, p.xecUsd(slot));
    const Eslot = energyPerBlock(energy0, genesis, target);
    const mStarSlot =
      R - F - Eslot > 0
        ? Math.min(popTotal, Math.floor((R - F - Eslot) / o))
        : 0;
    if (backlogStart > 1 && mStarSlot > 0) recoverySlots++;
    let rounds = 0;
    let minedThisSlot = false;
    while (tip < latest && rounds < roundsPerSlot) {
      rounds++;
      const E = energyPerBlock(energy0, genesis, target);
      const mStar =
        R - F - E > 0 ? Math.min(popTotal, Math.floor((R - F - E) / o)) : 0;
      if (mStar === 0) break;
      minedThisSlot = true;
      entrantsSum += mStar;
      roundCount++;
      const r = rng();
      const w: PacingStrategy =
        r < fracB ? 'backfill' : r < fracB + fracJ ? 'jump' : 'threshold';
      const t = strategyTarget(w, tip, latest, threshold);
      if (t === tip + 1) {
        filled++;
      } else {
        destroyed += t - tip - 1;
        filled++;
      }
      tip = t;
      blocks++;
      wins[w]++;
      feesUsd += F;
      energyUsd += E;
      const eShare = E / mStar;
      profit[w] += R - F - eShare;
      const frac: Record<PacingStrategy, number> = {
        backfill: fracB,
        jump: fracJ,
        threshold: 1 - fracB - fracJ,
      };
      for (const s of ['backfill', 'jump', 'threshold'] as const) {
        profit[s] -= eShare * (mStar * frac[s] - (s === w ? 1 : 0));
      }
      target = microStep(target);
    }
    if (!minedThisSlot && tip < latest) idleSlots++;
  }

  let schedule = genesis;
  for (let i = 0; i < p.slots; i++) schedule = microStep(schedule);
  const movement = genesis - schedule;
  const lagShare = movement > 0 ? (target - schedule) / movement : 0;

  return {
    slots: p.slots,
    blocks,
    filled,
    destroyed,
    utilization: p.slots > 0 ? filled / p.slots : 0,
    issuance: blocks * 100,
    finalTarget: target,
    scheduleTarget: schedule,
    lagShare,
    feesUsd,
    energyUsd,
    profitByStrategy: profit,
    winsByStrategy: wins,
    avgEntrants: roundCount > 0 ? entrantsSum / roundCount : 0,
    idleSlots,
    recoverySlots,
    maxBacklog,
  };
}
