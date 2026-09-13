#!/usr/bin/env tsx
/**
 * Miner-paced issuance scenarios with all-pay-full energy (30% of block
 * reward at ANY price: $0.30 @ $1, $30 @ $100 — miners scale hashpower
 * with the prize, dissipating a constant share).
 *
 *   npm run sim-pacing-econ
 *
 * Entry M*=(R−F)/(Wc+o); viability floor ≈ Wc+o ≈ $0.007 (marginal
 * single-miner cost — sequential degrades gracefully). Wc grows
 * 0.0815%/day (treadmill: flat $1 dies ~20y, flat $100 ~36y).
 *
 * R1/R2: $1/$100 constant, calm — cap binds? (140 vs 14K racers.)
 * R3/R4: 99.9% token crash d20-40 — $1→$0.001 idles, $100→$0.10 mines on.
 * R6-*: R3 path x all-sustain(all-backfill)/all-drain(all-jump)/
 *   all-threshold — sustain keeps schedule via grinding, drain recovers
 *   instantly at −33%; symmetric races → norms decide.
 * R7a/R7b: 25 years flat $1/$100 — treadmill death (~20y) vs durable
 *   squeeze ($100 centralizes 14K→~26 over 25y but survives).
 *
 * Pure simulation (seeded, reproducible). No chain, no sats.
 */
import {
  runSim,
  type SimPopulation,
  type SimResult,
} from '../src/sim/pacingEcon.js';

const DAY = 144; // 10-min slots per day
const YEAR = 365 * DAY;
const XEC_REAL = 0.000007;

const THIRDS: SimPopulation = {
  backfill: 33334,
  jump: 33333,
  threshold: 33333,
};
const ALL_BACKFILL: SimPopulation = {
  backfill: 100000,
  jump: 0,
  threshold: 0,
};
const ALL_JUMP: SimPopulation = { backfill: 0, jump: 100000, threshold: 0 };
const ALL_THRESHOLD: SimPopulation = {
  backfill: 0,
  jump: 0,
  threshold: 100000,
};

/** 99.9% token crash during days 20-40 of a 60-day run. */
function tokenCrash(base: number): (slot: number) => number {
  return slot =>
    slot <= 20 * DAY || slot > 40 * DAY ? base : base * 0.001;
}

interface Scenario {
  name: string;
  slots: number;
  rewardUsd: (slot: number) => number;
  xecUsd: (slot: number) => number;
  population: SimPopulation;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'R1 $1/blk, calm, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 1,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R2 $100/blk, calm, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 100,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R3 $1/blk, 99.9% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R4 $100/blk, 99.9% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(100),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R6a R3-path, all sustain',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_BACKFILL,
  },
  {
    name: 'R6b R3-path, all drain',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_JUMP,
  },
  {
    name: 'R6c R3-path, all threshold',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_THRESHOLD,
  },
  {
    name: 'R7a 25y flat $1, thirds (treadmill)',
    slots: 25 * YEAR,
    rewardUsd: () => 1,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R7b 25y flat $100, thirds (treadmill)',
    slots: 25 * YEAR,
    rewardUsd: () => 100,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
];

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

async function main(): Promise<void> {
  const seed = Number(process.env.SIM_SEED?.trim() || 1);
  for (const s of SCENARIOS) {
    const r: SimResult = runSim({
      slots: s.slots,
      rewardUsd: s.rewardUsd,
      xecUsd: s.xecUsd,
      population: s.population,
      seed,
    });
    const p = r.profitByStrategy;
    console.log(
      [
        s.name,
        `blocks=${fmt(r.blocks)}`,
        `U%=${(r.utilization * 100).toFixed(1)}`,
        `destroyed=${fmt(r.destroyed)}`,
        `issuance=${fmt(r.issuance)}`,
        `lag%=${(r.lagShare * 100).toFixed(1)}`,
        `nrg$=${fmt(r.energyUsd, 0)}`,
        `profitB/J/T=${fmt(p.backfill, 0)}/${fmt(p.jump, 0)}/${fmt(p.threshold, 0)}`,
        `avgN=${r.avgEntrants.toFixed(1)}`,
        `idle=${fmt(r.idleSlots)}`,
        `recov=${fmt(r.recoverySlots)}`,
        `maxBack=${fmt(r.maxBacklog)}`,
      ].join(' | '),
    );
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
