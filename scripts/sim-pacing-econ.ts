#!/usr/bin/env tsx
/**
 * Miner-paced issuance scenarios: $1 vs $100 block rewards, flat vs
 * XEC-shock fee pressure, backfill/jump/threshold strategy mixes.
 *
 *   npm run sim-pacing-econ
 *
 * R1/R2: constant reward, calm XEC — does reward size change pace?
 * R3/R4: constant reward, 20-day XEC x4 shock mid-run — who idles?
 * R5-*: R3 price path x strategy mix — which behavior wins?
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
const XEC_CALM = 0.03;
const XEC_SHOCK = 0.12; // x4 fee pressure: $0.525 -> $2.10/block cost base

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

function shockXec(slot: number): number {
  if (slot <= 20 * DAY) return XEC_CALM;
  if (slot <= 40 * DAY) return XEC_SHOCK;
  return XEC_CALM;
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
    name: 'R1 $1/blk, calm XEC, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 1,
    xecUsd: () => XEC_CALM,
    mix: THIRDS,
  },
  {
    name: 'R2 $100/blk, calm XEC, thirds',
    slots: 30 * DAY,
    rewardUsd: () => 100,
    xecUsd: () => XEC_CALM,
    mix: THIRDS,
  },
  {
    name: 'R3 $1/blk, XEC x4 shock d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: () => 1,
    xecUsd: shockXec,
    mix: THIRDS,
  },
  {
    name: 'R4 $100/blk, XEC x4 shock d20-40, thirds',
    slots: 60 * DAY,
    rewardUsd: () => 100,
    xecUsd: shockXec,
    mix: THIRDS,
  },
  {
    name: 'R5a R3-path, all backfill',
    slots: 60 * DAY,
    rewardUsd: () => 1,
    xecUsd: shockXec,
    mix: [1, 0, 0],
  },
  {
    name: 'R5b R3-path, all jump',
    slots: 60 * DAY,
    rewardUsd: () => 1,
    xecUsd: shockXec,
    mix: [0, 1, 0],
  },
  {
    name: 'R5c R3-path, all threshold',
    slots: 60 * DAY,
    rewardUsd: () => 1,
    xecUsd: shockXec,
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
        fmt(r.feesUsd, 0),
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
