/**
 * Miner-paced issuance economics (ELOTUS v4 research simulator) — PURE.
 *
 * Answers: what happens to issuance / difficulty-lag / miner P&L when
 * miners choose backfill-vs-jump under varying block-reward value ($1 vs
 * $100 per 100-token block) and XEC-price shocks (fee pressure)?
 *
 * Model (documented approximations):
 * - Discrete 10-minute slots. Each slot opens one latest slot; miners race
 *   in rounds (~20s each, ≤30/slot) until the tip catches up or all idle.
 * - Entry: miner i enters a race iff R − F·multᵢ > o (block reward minus
 *   all-in cost beats the per-race opportunity cost). Losers pay ~compute
 *   only (unconfirmed txs never pay fees) — mildly optimistic entry, which
 *   matches real race over-entry.
 * - Fees are dust at real XEC (~$7e-6): 1750 sats ≈ $0.00012. The idle
 *   driver is the REWARD side (token crashes vs opportunity cost o), never
 *   the fee side — an XEC x1000 moon would be needed for fees to bind at
 *   $1 rewards. o defaults to $0.005/race (≈$21/mo always-on infra).
 * - Winner uniform among entrants (symmetric first-seen/propagation;
 *   fee-bidding wars are NOT modeled — extension point).
 * - Strategies: backfill (always tip+1), jump (always latest), threshold
 *   (backfill iff backlog ≤ 12, else jump).
 * - Difficulty: exactly one SUB-form micro-step per block from the current
 *   tip target (mirrors the covenant via the shared UDELTA consts).
 * - PoW compute: symmetric race costs one block's expected hashes total
 *   (≈2³¹/target × hash price — negligible at these targets; fees dominate).
 *
 * Seeded (mulberry32) → fully reproducible trajectories.
 */
import {
  UDELTA_DENOMINATOR,
  UDELTA_NUMERATOR,
} from '../covenant/singleShardDeltaMath.js';

export type PacingStrategy = 'backfill' | 'jump' | 'threshold';

export interface SimMiner {
  strategy: PacingStrategy;
  /** All-in cost multiplier on the protocol fee (efficiency spread). */
  costMult: number;
}

export interface SimParams {
  slots: number;
  /** Block reward (100 tokens) in USD per slot. */
  rewardUsd: (slot: number) => number;
  /** XEC/USD per slot (fee pressure channel). */
  xecUsd: (slot: number) => number;
  miners: SimMiner[];
  /** Protocol fee in sats (default 1750 — measured single-shard remint). */
  feeSats?: number;
  roundsPerSlot?: number;
  /** Per-race fixed cost in USD (default 0.005 ≈ $21/mo always-on infra). */
  opportunityUsd?: number;
  hashCostUsd?: number;
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
  computeUsd: number;
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

/** Expected sha256 attempts to clear an Ergon head target (~2³¹/t). */
export function expectedAttempts(target: number): number {
  return 2 ** 31 / target;
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
  const roundsPerSlot = p.roundsPerSlot ?? 30;
  const o = p.opportunityUsd ?? 0.005;
  const hashCost = p.hashCostUsd ?? 1e-9;
  const threshold = p.threshold ?? 12;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const rng = mulberry32(p.seed ?? 1);

  let tip = 0;
  let target = genesis;
  let blocks = 0;
  let filled = 0;
  let destroyed = 0;
  let idleSlots = 0;
  let recoverySlots = 0;
  let maxBacklog = 0;
  let feesUsd = 0;
  let computeUsd = 0;
  let entrantsSum = 0;
  let roundCount = 0;
  const profit = zeroStrategies();
  const wins = zeroStrategies();

  for (let slot = 1; slot <= p.slots; slot++) {
    const latest = slot;
    const backlogStart = latest - tip;
    if (backlogStart > 0) {
      if (backlogStart > maxBacklog) maxBacklog = backlogStart;
    }
    const R = p.rewardUsd(slot);
    const F = feeUsd(feeSats, p.xecUsd(slot));
    if (
      backlogStart > 1 &&
      p.miners.some(m => R - F * m.costMult > o)
    ) {
      recoverySlots++;
    }
    let rounds = 0;
    let minedThisSlot = false;
    while (tip < latest && rounds < roundsPerSlot) {
      rounds++;
      const entrants = p.miners.filter(m => R - F * m.costMult > o);
      if (entrants.length === 0) break;
      minedThisSlot = true;
      entrantsSum += entrants.length;
      roundCount++;
      computeUsd += expectedAttempts(target) * hashCost;
      const w = entrants[Math.floor(rng() * entrants.length)]!;
      const t = strategyTarget(w.strategy, tip, latest, threshold);
      if (t === tip + 1) {
        filled++;
      } else {
        destroyed += t - tip - 1;
        filled++;
      }
      tip = t;
      blocks++;
      wins[w.strategy]++;
      profit[w.strategy] += R - F * w.costMult;
      feesUsd += F;
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
    computeUsd,
    profitByStrategy: profit,
    winsByStrategy: wins,
    avgEntrants: roundCount > 0 ? entrantsSum / roundCount : 0,
    idleSlots,
    recoverySlots,
    maxBacklog,
  };
}
