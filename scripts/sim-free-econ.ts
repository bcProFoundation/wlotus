#!/usr/bin/env tsx
/**
 * Free-competition scenarios (ELOTUS v5) — ELOTUS + GLOTUS, no peg.
 *
 *   npm run sim-free-econ
 *
 * Independent PoW tiers ($0.25 / $250 energy at design, 25% share),
 * floating GLOTUS/ELOTUS ratio, free $/miner routing, reservation
 * R=3x with pent-up patience 0.9, rotation per tier.
 *
 * C1: calm ($100 base + $1K grand) — both tiers at cost, ratio ~1000x.
 * C2: grand whale surge 10x d5+ — grand rents; base held by captive
 *     small bench (float firewall); ratio stable (elasticity works).
 * C3: grand collapse to $10 d5-8 — solo mines at $10 (1% of design),
 *     ratio crashes to ~10x, V-shaped recovery (price absorbs).
 * C4: base collapse to $0.05 d5-8 — thin M~=7, price $0.05, small idle,
 *     V-shaped recovery (mirror resilience, no lower rail).
 * C5a/b/c: $1M base flash x patience {0.5, 0.9, 0.99} — reservation
 *     binds ($0.02 cap), pent-up flood drains over days/weeks
 *     (patience = flood duration; the well-posed cobweb).
 * C6: sustained 10x base surge 30d — thin rents, large stay grand
 *     (absolute-$ defense), stable segmentation (not homogenizing).
 * C7: 18y calm — anchor holds both tiers, inclusion preserved.
 * C8: C7 rotation BANNED (capacity-sufficient genesis) — base
 *     concentrates (large-only, $1 holds: treadmill = concentration,
 *     not inflation) while grand DIES (mid-teens at 12%/yr δ, Wc crosses
 *     large float: rotation = float relief; static-float caveat).
 *
 * Pure simulation (deterministic, no RNG). No chain, no sats.
 */
import {
  runFreeSim,
  type FreeParams,
  type FreeResult,
} from '../src/sim/freeEcon.js';

const DAY = 144;
const YEAR = 365 * DAY;

const flat =
  (v: number): ((slot: number) => number) =>
  () =>
    v;

const sustain = (
  base: number,
  hi: number,
  dStart: number,
): ((slot: number) => number) => {
  const a = dStart * DAY;
  return slot => (slot > a ? hi : base);
};

const surge = (
  base: number,
  hi: number,
  dStart: number,
  dEnd: number,
): ((slot: number) => number) => {
  const a = dStart * DAY;
  const b = dEnd * DAY;
  return slot => (slot > a && slot <= b ? hi : base);
};

interface Scenario extends Omit<FreeParams, 'slots'> {
  name: string;
  slots: number;
}

const POPS = { smallMiners: 15000, largeMiners: 2000 };
const GENESIS = { base: 1, grand: 1 };

const SCENARIOS: Scenario[] = [
  {
    name: 'C1 calm ($100 + $1K) — cost anchor, ratio 1000x',
    slots: 30 * DAY,
    demandUsd: { base: flat(100), grand: flat(1000) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C2 grand 10x surge d5+ (float firewall)',
    slots: 30 * DAY,
    demandUsd: { base: flat(100), grand: sustain(1000, 10000, 5) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C3 grand collapse to $10 d5-8 (thin solo, V-shape)',
    slots: 30 * DAY,
    demandUsd: { base: flat(100), grand: surge(1000, 10, 5, 8) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C4 base collapse to $0.05 d5-8 (mirror resilience)',
    slots: 30 * DAY,
    demandUsd: { base: surge(100, 0.05, 5, 8), grand: flat(1000) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C5a $1M base flash, patience 0.5 (fast drain)',
    slots: 30 * DAY,
    demandUsd: {
      base: slot => (slot === 5 * DAY ? 1000000 : 100),
      grand: flat(1000),
    },
    genesisBatons: GENESIS,
    patience: 0.5,
    ...POPS,
  },
  {
    name: 'C5b $1M base flash, patience 0.9 (slow drain)',
    slots: 30 * DAY,
    demandUsd: {
      base: slot => (slot === 5 * DAY ? 1000000 : 100),
      grand: flat(1000),
    },
    genesisBatons: GENESIS,
    patience: 0.9,
    ...POPS,
  },
  {
    name: 'C5c $1M base flash, patience 0.99 (flood persists)',
    slots: 30 * DAY,
    demandUsd: {
      base: slot => (slot === 5 * DAY ? 1000000 : 100),
      grand: flat(1000),
    },
    genesisBatons: GENESIS,
    patience: 0.99,
    ...POPS,
  },
  {
    name: 'C6 10x base surge 30d (segmentation holds)',
    slots: 30 * DAY,
    demandUsd: { base: flat(1000), grand: flat(1000) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C7 18y calm (anchor holds, inclusion kept)',
    slots: 18 * YEAR,
    demandUsd: { base: flat(100), grand: flat(1000) },
    genesisBatons: GENESIS,
    ...POPS,
  },
  {
    name: 'C8 C7 rotation BANNED (base concentrates, grand dies)',
    slots: 18 * YEAR,
    demandUsd: { base: flat(100), grand: flat(1000) },
    genesisBatons: { base: 112, grand: 1 },
    allowFreshClones: false,
    ...POPS,
  },
];

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

async function main(): Promise<void> {
  for (const s of SCENARIOS) {
    const { name, ...params } = s;
    const r: FreeResult = runFreeSim(params);
    console.log(
      [
        name,
        `blocks=${fmt(r.blocksTotal)}`,
        `ratio=${r.meanRatio.toFixed(1)}x/${r.minRatio.toFixed(1)}-${r.maxRatio.toFixed(1)}x`,
        `unfilled$=${fmt(r.unfilledUsd, 0)}`,
        `nrg$=${fmt(r.energyUsd, 0)}`,
        `profit$=${fmt(r.profitUsd, 0)}`,
        `tokB/G=${fmt(r.tokensBase)}/${fmt(r.tokensGrand)}`,
        `idleB/G=${fmt(r.baseIdleSlots)}/${fmt(r.grandIdleSlots)}`,
      ].join(' | '),
    );
    for (const t of ['base', 'grand'] as const) {
      const x = r.byTier[t];
      if (x.races === 0 && x.blocks === 0) continue;
      const perMiner =
        x.blocks > 0 && x.avgEntrants > 0
          ? x.profitUsd / (x.blocks * x.avgEntrants)
          : 0;
      console.log(
        [
          `  ${t}`,
          `blocks=${fmt(x.blocks)}`,
          `endPx$=${fmt(x.endPrice, 4)}`,
          `avgM=${x.avgEntrants.toFixed(1)}`,
          `avgS/L=${x.avgSmallM.toFixed(1)}/${x.avgLargeM.toFixed(1)}`,
          `endS/L=${x.endSmallM.toFixed(1)}/${x.endLargeM.toFixed(1)}`,
          `endAct/Need=${fmt(x.endActive)}/${fmt(x.endNeed)}`,
          `unfilledR=${fmt(x.unfilledRaces)}`,
          `$/miner=${fmt(perMiner, 4)}`,
        ].join(' | '),
      );
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
