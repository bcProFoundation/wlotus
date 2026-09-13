#!/usr/bin/env tsx
/**
 * Miner-paced issuance scenarios — ELASTIC-CASH framing.
 *
 * Demand D ($/slot) is exogenous; the block trades at P=D and fills iff
 * D covers production cost (~$1 design: Wc+o per entrant, M*=140,
 * $0.30/block total energy). Premium P/P_design ~ 1 = ANCHORED (elastic
 * regime); sustained premium >> 1 = ABOVE-CAP (Bitcoin-like regime:
 * premium burned as entry-race energy waste).
 *
 *   npm run sim-pacing-econ
 *
 * R1: D=$1 flat, calm — anchored, zero premium, U=100%.
 * R2: D=$100 SUSTAINED on the $1 design (100x over-cap demand) —
 *     persistent 100x premium, M*=14K, $30/block energy waste.
 * R3: demand collapse ($1 -> $0.001, d20-40) — bids below cost idle
 *     2,880 slots; backlog + recovery dynamics.
 * R4: D=$100 -> $0.10 (premium compression, still 14x over marginal
 *     cost) — mines straight through, U=100%.
 * R6-*: R3 demand path x all-sustain / all-drain / all-threshold —
 *     sustain grinds the backlog (U=100%, +49.6% richer miners),
 *     drain recovers instantly at U=66.7%; symmetric races -> NORMS
 *     decide the mix.
 * R7a/R7b: 25y flat D=$1/$100 — treadmill eats margin (M* 140->4 /
 *     14K->477), then the q=0 quantization floor (~15y) FREEZES
 *     difficulty (~95x genesis): perpetual thin-margin mining, never
 *     death-by-schedule. Premium stays 1x/100x (sticky demand).
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

/** 99.9% demand collapse during days 20-40 of a 60-day run. */
function demandCrash(base: number): (slot: number) => number {
  return slot =>
    slot <= 20 * DAY || slot > 40 * DAY ? base : base * 0.001;
}

interface Scenario {
  name: string;
  slots: number;
  demandUsd: (slot: number) => number;
  xecUsd: (slot: number) => number;
  population: SimPopulation;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'R1 D=$1, calm, thirds (anchored)',
    slots: 30 * DAY,
    demandUsd: () => 1,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R2 D=$100 sustained = 100x over-cap (premium regime)',
    slots: 30 * DAY,
    demandUsd: () => 100,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R3 D=$1 -> $0.001 d20-40 (demand collapse)',
    slots: 60 * DAY,
    demandUsd: demandCrash(1),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R4 D=$100 -> $0.10 d20-40 (premium compression)',
    slots: 60 * DAY,
    demandUsd: demandCrash(100),
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R6a R3-path, all sustain',
    slots: 60 * DAY,
    demandUsd: demandCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_BACKFILL,
  },
  {
    name: 'R6b R3-path, all drain',
    slots: 60 * DAY,
    demandUsd: demandCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_JUMP,
  },
  {
    name: 'R6c R3-path, all threshold',
    slots: 60 * DAY,
    demandUsd: demandCrash(1),
    xecUsd: () => XEC_REAL,
    population: ALL_THRESHOLD,
  },
  {
    name: 'R7a 25y flat D=$1 (treadmill -> floor)',
    slots: 25 * YEAR,
    demandUsd: () => 1,
    xecUsd: () => XEC_REAL,
    population: THIRDS,
  },
  {
    name: 'R7b 25y flat D=$100 (treadmill -> floor, premium regime)',
    slots: 25 * YEAR,
    demandUsd: () => 100,
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
      demandUsd: s.demandUsd,
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
        `prem=${r.meanPremium.toFixed(2)}x/${r.maxPremium.toFixed(1)}x`,
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
