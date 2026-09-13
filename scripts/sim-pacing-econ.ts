#!/usr/bin/env tsx
/**
 * Miner-paced issuance scenarios: $1 vs $100 block rewards, token-crash
 * shocks, XEC fee-side (non-)shocks, backfill/jump/threshold mixes.
 *
 *   npm run sim-pacing-econ
 *
 * Calibration (Sep 2026): XEC ≈ $7e-6 → 1750-sat remint fee ≈ $0.00012.
 * Fees NEVER bind at $1/$100 rewards — the idle driver is the REWARD
 * side (token crashes vs ~$0.005/race opportunity cost ≈ $21/mo infra).
 *
 * R1/R2: constant reward, calm — does reward size change pace?
 * R3/R4: 99.9% token crash d20-40 — who survives ($100→$0.10 vs $1→$0.001)?
 * R5: $1 + XEC x10 d20-40 — fee-side shock binds nothing (control).
 * R6-*: R3 price path x strategy mix — which behavior wins?
 *
 * Pure simulation (seeded, reproducible). No chain, no sats.
 */
import {
  mulberry32,
  runSim,
  type PacingStrategy,
  type SimMiner,
  type SimResult,
} from '../src/sim/pacingEcon.js';

const DAY = 144; // 10-min slots per day
const XEC_REAL = 0.000007;
const XEC_X10 = 0.00007; // fee $0.00012 -> $0.0012: still dust vs $1

function population(
  mix: [number, number, number],
  n: number,
  seed: number,
): SimMiner[] {
  const rng = mulberry32(seed);
  const out: SimMiner[] = [];
  const strategies: PacingStrategy[] = ['backfill', 'jump', 'threshold'];
  const total = mix[0]! + mix[1]! + mix[2]!;
  for (let i = 0; i < n; i++) {
    const r = rng() * total;
    const strategy =
      r < mix[0]!
        ? strategies[0]!
        : r < mix[0]! + mix[1]!
          ? strategies[1]!
          : strategies[2]!;
    out.push({ strategy, costMult: 0.5 + rng() * 2.0 });
  }
  return out;
}

/** 99.9% token crash during days 20-40 of a 60-day run. */
function tokenCrash(base: number): (slot: number) => number {
  return slot =>
    slot <= 20 * DAY || slot > 40 * DAY ? base : base * 0.001;
}

function xecShock(slot: number): number {
  if (slot <= 20 * DAY) return XEC_REAL;
  if (slot <= 40 * DAY) return XEC_X10;
  return XEC_REAL;
}

interface Scenario {
  name: string;
  slots: number;
  rewardUsd: (slot: number) => number;
  xecUsd: (slot: number) => number;
  mix: [number, number, number];
}

const THIRDS: [number, number, number] = [1, 1, 1];
const SCENARIOS: Scenario[] = [
  {
    name: 'R1 $1/blk, calm, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 1,
    xecUsd: () => XEC_REAL,
    mix: THIRDS,
  },
  {
    name: 'R2 $100/blk, calm, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 100,
    xecUsd: () => XEC_REAL,
    mix: THIRDS,
  },
  {
    name: 'R3 $1/blk, 99.9% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    mix: THIRDS,
  },
  {
    name: 'R4 $100/blk, 99.9% crash d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(100),
    xecUsd: () => XEC_REAL,
    mix: THIRDS,
  },
  {
    name: 'R5 $1/blk, XEC x10 d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: () => 1,
    xecUsd: xecShock,
    mix: THIRDS,
  },
  {
    name: 'R6a R3-path, all backfill',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    mix: [1, 0, 0],
  },
  {
    name: 'R6b R3-path, all jump',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    mix: [0, 1, 0],
  },
  {
    name: 'R6c R3-path, all threshold',
    slots: 60 * DAY,
    rewardUsd: tokenCrash(1),
    xecUsd: () => XEC_REAL,
    mix: [0, 0, 1],
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
  const rows: { name: string; r: SimResult }[] = SCENARIOS.map(s => ({
    name: s.name,
    r: runSim({
      slots: s.slots,
      rewardUsd: s.rewardUsd,
      xecUsd: s.xecUsd,
      miners: population(s.mix, 500, 777),
      seed,
    }),
  }));

  const header = [
    'run',
    'blocks',
    'U%',
    'destroyed',
    'issuance',
    'lag%',
    'fees$',
    'profit$ B/J/T',
    'avgN',
    'idle',
    'recov',
    'maxBack',
  ];
  console.log(header.join(' | '));
  for (const { name, r } of rows) {
    const p = r.profitByStrategy;
    console.log(
      [
        name,
        fmt(r.blocks),
        (r.utilization * 100).toFixed(1),
        fmt(r.destroyed),
        fmt(r.issuance),
        (r.lagShare * 100).toFixed(1),
        fmt(r.feesUsd, 2),
        `${fmt(p.backfill, 0)}/${fmt(p.jump, 0)}/${fmt(p.threshold, 0)}`,
        r.avgEntrants.toFixed(1),
        fmt(r.idleSlots),
        fmt(r.recoverySlots),
        fmt(r.maxBacklog),
      ].join(' | '),
    );
  }

  if (process.env.SIM_JSON === '1') {
    console.log(JSON.stringify(rows, null, 2));
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
