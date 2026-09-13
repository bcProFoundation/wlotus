#!/usr/bin/env tsx
/**
 * Miner-paced issuance scenarios with REAL energy costs (E0=$0.30/block
 * at genesis = 30% of a $1 block — the unforgeable-costliness goal).
 *
 *   npm run sim-pacing-econ
 *
 * Calibration (Sep 2026): XEC ≈ $7e-6 → fee ≈ $0.00012 (dust); energy
 * dominates cost (2500x fees). Entry M* = (R−F−E)/o with E growing
 * 0.0815%/day (treadmill) and o = $0.005/race.
 *
 * R1/R2: $1/$100 constant, calm — cap binds?
 * R3/R4: 90% token crash d20-40 — $1→$0.10 idles (below ~$0.30 energy
 *   floor), $100→$10 mines on. Same depth, different fate.
 * R6-*: R3 path x all-backfill/all-jump/all-threshold — which norm wins?
 * R7a/R7b: 5 years flat $1/$100 — treadmill: $1 dies ~4y (margin
 *   exhausted, sudden full idle), $100 barely notices (dies ~20y).
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

/** 90% token crash during days 20-40 of a 60-day run. */
function tokenCrash(base: number): (slot: number) => number {
  return slot =>
    slot <= 20 * DAY || slot > 40 * DAY ? base : base * 0.1;
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
    name: 'R3 $1/blk, 90% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R4 $100/blk, 90% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(100),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R6a R3-path, all backfill',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_BACKFILL,
  },
  {
    name: 'R6b R3-path, all jump',
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
    name: 'R7a 5y flat $1, thirds (treadmill)',
    slots: 5 * YEAR,
    rewardUsd: () => 1,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R7b 5y flat $100, thirds (treadmill)',
    slots: 5 * YEAR,
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
