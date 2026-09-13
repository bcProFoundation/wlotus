/**
 * Miner-paced issuance economics (ELOTUS v4 research simulator) — PURE.
 *
 * Energy model (all-pay-full, sequential-puzzle): every entrant burns full
 * work Wc per race (no early exit — the structure a constant energy share
 * REQUIRES: lottery puzzles fix total work/block, so their energy share
 * collapses at high prices; sequential work scales with entry). Wc0 is
 * derived from the energy share: Wc0 = share·o/(1−share) ($0.00214 at
 * share=30%, o=$0.005), scaling with 1/target (treadmill). Total network
 * energy/block = M*·Wc = 30% of R at ANY price ($0.30 @ $1, $30 @ $100).
 * Production corollary: the puzzle must be sequential-ish (all-pay-full),
 * ~2e8x today's 128-sha256 placeholder (~$1e-11) — TBD, now sharply
 * specified instead of vaguely "harder".
 *
 * Entry M* = (R-F)/(Wc+o) (rent dissipation). Viability floor is about
 * Wc+o, roughly $0.007 (MARGINAL single-miner cost - sequential degrades
 * gracefully since energy scales down with entry). Wc grows 0.0815%/day
 * until the q=0 quantization floor (~15y, difficulty caps ~95x genesis),
 * then freezes: flat $1 mines forever at M*=4 (R7 runs).
 *
 * Elastic-cash price formation (NOT Bitcoin lottery): the DESIGN sets
 * difficulty so production costs ~$1/block (energy $0.2-0.3 at design
 * scale + o ~= $263/yr/entrant infra/attention/margin + fee dust), and
 * the market price FOLLOWS cost. Demand D ($/slot of buying pressure)
 * is exogenous; the block trades at P=D and fills iff D covers cost
 * (miners idle below, mine at ~cost within the cap). Premium P/P_design
 * near 1 is the ANCHORED regime; sustained premium >> 1 is the
 * ABOVE-CAP (Bitcoin-like) regime - persistent over-cap demand burns
 * premium as entry-race energy (waste: $30/block chasing a $1-design
 * block). The anchor is ASYMMETRIC: idle-threat floors price at cost
 * from below, but only HEADROOM (cap above typical demand - the pace
 * choice!) anchors it from above. A $100 block is a different DESIGN
 * (100x harder), never the same block mooning.
 *
 * Calibration chain (design scale): Wc0=$0.0021/entrant/race,
 * M*=140 entrants -> total energy $0.30/block, the design spec.
 * Treadmill reframe (HYPOTHESIS, needs hardware data): if hardware
 * $/hash improves ~35%/yr, the delta schedule eats efficiency gains
 * to HOLD the $1 anchor (anti-deflation), with the quantization
 * floor as the backstop era. Sticky-demand fixture here (D
 * exogenous); adaptive demand (buyers tracking cost up the
 * treadmill = 35%/yr anchor inflation) is deferred to v3.
 *
 * Strategies as stakeholder behavior: backfill = sustain-the-mine
 * (patient going-concern miners preserving future races); jump = drain
 * (greedy extractors/holders destroying backlog for scarcity + quick
 * tokens — zero-sum vs miners over the contested backlog); threshold =
 * the miner-faithful default (sustain when feasible, drain only when
 * unbackfillable). Races are symmetric → no selective pressure → norms
 * (software defaults, pool coordination) decide the mix.
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
  /** Demand: buying pressure $/slot for the block's 100 tokens. */
  demandUsd: (slot: number) => number;
  /** Design price $/block the difficulty was calibrated for (default 1). */
  designUsd?: number;
  /** XEC/USD per slot (fee channel — dust at real prices). */
  xecUsd: (slot: number) => number;
  population: SimPopulation;
  /** Protocol fee in sats (default 1750 — measured single-shard remint). */
  feeSats?: number;
  /** Network energy share of block reward (default 0.30). */
  energyShare?: number;
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
  /** Mean trade-price/design over filled rounds (1.0 = anchored). */
  meanPremium: number;
  maxPremium: number;
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

/**
 * Per-entrant energy $/race at the current target. Wc0 = share·o/(1−share)
 * at genesis, scaling with 1/target (treadmill: harder puzzle = pricier
 * entry over time).
 */
export function energyPerEntrant(
  energyShare: number,
  opportunityUsd: number,
  genesisTarget: number,
  target: number,
): number {
  return (
    ((energyShare * opportunityUsd) / (1 - energyShare)) *
    (genesisTarget / target)
  );
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
  const share = p.energyShare ?? 0.3;
  const roundsPerSlot = p.roundsPerSlot ?? 30;
  const o = p.opportunityUsd ?? 0.005;
  const threshold = p.threshold ?? 12;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const rng = mulberry32(p.seed ?? 1);
  const popTotal =
    p.population.backfill + p.population.jump + p.population.threshold;
  const fracB = p.population.backfill / popTotal;
  const fracJ = p.population.jump / popTotal;
  const frac: Record<PacingStrategy, number> = {
    backfill: fracB,
    jump: fracJ,
    threshold: 1 - fracB - fracJ,
  };

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
  let premiumSum = 0;
  let maxPremium = 0;
  const profit = zeroStrategies();
  const wins = zeroStrategies();

  for (let slot = 1; slot <= p.slots; slot++) {
    const latest = slot;
    const backlogStart = latest - tip;
    if (backlogStart > maxBacklog) maxBacklog = backlogStart;
    const R = p.demandUsd(slot);
    const design = p.designUsd ?? 1;
    const F = feeUsd(feeSats, p.xecUsd(slot));
    const wcSlot = energyPerEntrant(share, o, genesis, target);
    const mStarSlot =
      R - F > 0 ? Math.min(popTotal, Math.floor((R - F) / (wcSlot + o))) : 0;
    if (backlogStart > 1 && mStarSlot > 0) recoverySlots++;
    let rounds = 0;
    let minedThisSlot = false;
    while (tip < latest && rounds < roundsPerSlot) {
      rounds++;
      const wc = energyPerEntrant(share, o, genesis, target);
      const mStar =
        R - F > 0 ? Math.min(popTotal, Math.floor((R - F) / (wc + o))) : 0;
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
      energyUsd += mStar * wc;
      const premium = R / design;
      premiumSum += premium;
      if (premium > maxPremium) maxPremium = premium;
      profit[w] += R - F - wc;
      for (const s of ['backfill', 'jump', 'threshold'] as const) {
        profit[s] -= wc * (mStar * frac[s] - (s === w ? 1 : 0));
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
    meanPremium: roundCount > 0 ? premiumSum / roundCount : 0,
    maxPremium,
  };
}
