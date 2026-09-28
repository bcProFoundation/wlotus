#!/usr/bin/env tsx
/**
 * Two-tier elastic family scenarios (ELOTUS v4) — ELOTUS + Grand Lotus.
 *
 *   npm run sim-grand-econ
 *
 * Fungible demand pool, ticket-routed rails with spillover, instant
 * deployment (seconds), reaction-lagged large miners, emergent vintage
 * rotation (miners mine cheapest-Wc; fresh clones always available).
 *
 * G1: calm D=$100, 5% whale (base serves $95; grand standby-idle).
 * G2: whale surge d5+ (D=$10K, 80% whale) — grand spins up same-slot;
 *     premium only during the 3-slot reaction window (vs F6's 150).
 * G3: $5M single-slot flash whale — MISSED (3-slot reaction too slow;
 *     ~$5M unfilled: flashes need STANDING allocation (v5 game)).
 * G3b: G3 with instant reaction — pop-wall premium (~2.5x): tokens
 *     instant, miners aren't (standby HASH is the constraint).
 * G4a/b/c: G2 path x reaction lag {0, 3, 12} — wedge ∝ tauReact
 *     (F6 reborn with the honest friction).
 * G5: collapse to $0.001 d5-8 (family idles, resumes at par).
 * G6: 6y treadmill with rotation ON — family never treadmills
 *     (fresh Wc0 forever, thin grand standby-idles + spills $3.1M,
 *     base inclusion preserved, par-floor holds).
 * G6b: G6 with rotation BANNED (control) — permanent 3.21x base wall,
 *     thin grand standby-idles, ~$3.1M unfilled (no room: wall
 *     binds all; v2's premium regime as the no-deployment limit).
 * G6c: G6b with roomy listed base — spill rescue ($3.1M carried,
 *     par holds: standby spill by design).
 *
 * Pure simulation (deterministic, no RNG). No chain, no sats.
 */
import {
  runGrandSim,
  type GrandParams,
  type GrandResult,
} from '../src/sim/grandEcon.js';

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

interface Scenario extends Omit<GrandParams, 'slots'> {
  name: string;
  slots: number;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'G1 calm D=$100, 5% whale (grand standby)',
    slots: 30 * DAY,
    demandUsd: flat(100),
    whaleShare: flat(0.05),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G2 whale surge d5+ (D=$10K, 80% whale)',
    slots: 30 * DAY,
    demandUsd: sustain(100, 10000, 5),
    whaleShare: sustain(0.05, 0.8, 5),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G3 $5M flash whale d5, reaction 3 (MISSED)',
    slots: 10 * DAY,
    demandUsd: slot => (slot === 5 * DAY ? 5000000 : 100),
    whaleShare: slot => (slot === 5 * DAY ? 0.99 : 0.05),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G3b G3, reaction 0 (pop wall 2.5x)',
    slots: 10 * DAY,
    demandUsd: slot => (slot === 5 * DAY ? 5000000 : 100),
    whaleShare: slot => (slot === 5 * DAY ? 0.99 : 0.05),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
    tauReact: 0,
  },
  {
    name: 'G4a G2-path, reaction 0 slots',
    slots: 30 * DAY,
    demandUsd: sustain(100, 10000, 5),
    whaleShare: sustain(0.05, 0.8, 5),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
    tauReact: 0,
  },
  {
    name: 'G4b G2-path, reaction 3 slots',
    slots: 30 * DAY,
    demandUsd: sustain(100, 10000, 5),
    whaleShare: sustain(0.05, 0.8, 5),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
    tauReact: 3,
  },
  {
    name: 'G4c G2-path, reaction 12 slots',
    slots: 30 * DAY,
    demandUsd: sustain(100, 10000, 5),
    whaleShare: sustain(0.05, 0.8, 5),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
    tauReact: 12,
  },
  {
    name: 'G5 collapse to $0.001 d5-8 (family idles)',
    slots: 30 * DAY,
    demandUsd: surge(100, 0.001, 5, 8),
    whaleShare: flat(0.05),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G6 6y, rotation ON (family never treadmills)',
    slots: 6 * YEAR,
    demandUsd: flat(100),
    whaleShare: flat(0.1),
    genesisBatons: { base: 1, grand: 1 },
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G6b G6, rotation BANNED (wall + standby + unfilled)',
    slots: 6 * YEAR,
    demandUsd: flat(100),
    whaleShare: flat(0.1),
    genesisBatons: { base: 1, grand: 1 },
    allowFreshClones: false,
    smallMiners: 15000,
    largeMiners: 2000,
  },
  {
    name: 'G6c G6b, roomy listed base (spill rescue)',
    slots: 6 * YEAR,
    demandUsd: flat(100),
    whaleShare: flat(0.1),
    genesisBatons: { base: 112, grand: 1 },
    allowFreshClones: false,
    smallMiners: 15000,
    largeMiners: 2000,
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
    const r: GrandResult = runGrandSim(params);
    console.log(
      [
        name,
        `blocks=${fmt(r.blocksTotal)}`,
        `prem=${r.meanPremium.toFixed(3)}x/${r.maxPremium.toFixed(2)}x`,
        `premSlots=${fmt(r.premiumSlots15)}`,
        `unfilledD$=${fmt(r.unfilledD, 2)}`,
        `spill$=${fmt(r.spillUsd, 0)}`,
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
          `avgM=${x.avgEntrants.toFixed(1)}`,
          `avgS/L=${x.avgSmallM.toFixed(1)}/${x.avgLargeM.toFixed(1)}`,
          `endS/L=${x.endSmallM.toFixed(1)}/${x.endLargeM.toFixed(1)}`,
          `endAct/Need=${fmt(x.endActive)}/${fmt(x.endNeed)}`,
          `endBlk=${fmt(x.endBlocks)}`,
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
