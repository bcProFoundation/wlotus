#!/usr/bin/env tsx
/**
 * Elastic family scenarios (ELOTUS v3) — the scaling stack in action.
 *
 *   npm run sim-family-econ
 *
 * 28 batons/token, denomination ladder (milli/base/mega), unbounded
 * clones, atomic-swap par. Pricing clears P_d = D_d/blocks: par when
 * capacity suffices, transient lag-wedge premium while batons/clones
 * spin up. Exit is free (excess idles) — no clone cobweb.
 *
 * F1: calm D=$10 base (steady state, premium 1.0x).
 * F2: 10x sustained surge day 5+ (batons 10->28, then clones;
 *     transient 10x->1x premium decay).
 * F3: surge-then-collapse d5-8 (clone overhang arrives post-surge,
 *     idles harmlessly — overdamped, premium back to 1x).
 * F4: demand collapse to $0.001 d5-8 (family idles, unfilled bids,
 *     resumes at par — per-baton backlog accrues per v2 R3).
 * F5: multi-tier steady state (base $10 + milli $0.10 + mega $10K):
 *     denominations serve their tiers in parallel; mega shows
 *     large-miner oligopoly rents (thin M, fat $/miner).
 * F6: F2 path x clone lag {6h, 1d, 1wk} — peg-deviation duration
 *     scales with deployment lag (policy: deploy faster, peg tighter).
 * F7: 6y base D=$10 (treadmill prices small miners out of base
 *     ~5y: endSmallM->0, large take over — centralization read).
 * F8: F7 + milli D=$0.01 (priced-out small miners DESCEND to milli:
 *     ladder preserves inclusion iff demand follows).
 *
 * Pure simulation (deterministic, no RNG). No chain, no sats.
 */
import {
  runFamilySim,
  type Denom,
  type FamilyParams,
  type FamilyResult,
} from '../src/sim/familyEcon.js';

const DAY = 144;
const YEAR = 365 * DAY;

const flat =
  (v: number): ((slot: number) => number) =>
  () =>
    v;

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

const sustain = (
  base: number,
  hi: number,
  dStart: number,
): ((slot: number) => number) => {
  const a = dStart * DAY;
  return slot => (slot > a ? hi : base);
};

interface Scenario extends Omit<FamilyParams, 'slots' | 'demandUsd'> {
  name: string;
  slots: number;
  demandUsd: Record<Denom, (slot: number) => number>;
}

const ZERO = flat(0);

const SCENARIOS: Scenario[] = [
  {
    name: 'F1 calm D=$10 base (steady)',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: flat(10), mega: ZERO },
    genesisBatons: { base: 10 },
  },
  {
    name: 'F2 10x sustained surge d5+ (batons then clones)',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: sustain(10, 100, 5), mega: ZERO },
    genesisBatons: { base: 10 },
    smallMiners: 20000,
  },
  {
    name: 'F3 surge d5-8 then collapse (overhang idles)',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: surge(10, 100, 5, 8), mega: ZERO },
    genesisBatons: { base: 10 },
    smallMiners: 20000,
  },
  {
    name: 'F4 collapse to $0.001 d5-8 (family idles)',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: surge(10, 0.001, 5, 8), mega: ZERO },
    genesisBatons: { base: 10 },
  },
  {
    name: 'F5 multi-tier steady (base+milli+mega)',
    slots: 30 * DAY,
    demandUsd: { milli: flat(0.1), base: flat(10), mega: flat(10000) },
    genesisBatons: { base: 10, milli: 100, mega: 10 },
    smallMiners: 50000,
    largeMiners: 500,
  },
  {
    name: 'F6a F2-path, clone lag 6h',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: sustain(10, 100, 5), mega: ZERO },
    genesisBatons: { base: 10 },
    smallMiners: 20000,
    tauClone: 36,
  },
  {
    name: 'F6b F2-path, clone lag 1d',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: sustain(10, 100, 5), mega: ZERO },
    genesisBatons: { base: 10 },
    smallMiners: 20000,
    tauClone: 144,
  },
  {
    name: 'F6c F2-path, clone lag 1wk',
    slots: 30 * DAY,
    demandUsd: { milli: ZERO, base: sustain(10, 100, 5), mega: ZERO },
    genesisBatons: { base: 10 },
    smallMiners: 20000,
    tauClone: 1008,
  },
  {
    name: 'F7 6y D=$10 (small priced out ~5y)',
    slots: 6 * YEAR,
    demandUsd: { milli: ZERO, base: flat(10), mega: ZERO },
    genesisBatons: { base: 10 },
    largeMiners: 2000,
  },
  {
    name: 'F8 F7 + milli D=$0.01 (ladder descent)',
    slots: 6 * YEAR,
    demandUsd: { milli: flat(0.01), base: flat(10), mega: ZERO },
    genesisBatons: { base: 10, milli: 10 },
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
    const r: FamilyResult = runFamilySim(params);
    const unf =
      r.byDenom.milli.unfilledDemandUsd +
      r.byDenom.base.unfilledDemandUsd +
      r.byDenom.mega.unfilledDemandUsd;
    console.log(
      [
        name,
        `blocks=${fmt(r.blocksTotal)}`,
        `prem=${r.meanPremium.toFixed(3)}x/${r.maxPremium.toFixed(1)}x`,
        `premSlots=${fmt(r.premiumSlots15)}`,
        `clones=${fmt(r.clonesDeployed)}`,
        `unfilledD$=${fmt(unf, 2)}`,
        `nrg$=${fmt(r.energyUsd, 0)}`,
        `profit$=${fmt(r.profitUsd, 0)}`,
      ].join(' | '),
    );
    for (const d of ['milli', 'base', 'mega'] as const) {
      const t = r.byDenom[d];
      if (t.races === 0 && t.tokensDeployed === 0) continue;
      const perMiner =
        t.blocks > 0 && t.avgEntrants > 0
          ? t.profitUsd / (t.blocks * t.avgEntrants)
          : 0;
      console.log(
        [
          `  ${d}`,
          `blocks=${fmt(t.blocks)}`,
          `avgM=${t.avgEntrants.toFixed(1)}`,
          `avgS/L=${t.avgSmallM.toFixed(1)}/${t.avgLargeM.toFixed(1)}`,
          `endS/L=${t.endSmallM.toFixed(1)}/${t.endLargeM.toFixed(1)}`,
          `endAct/Need=${fmt(t.endActive)}/${fmt(t.endNeed)}`,
          `tokens=${fmt(t.tokensDeployed)}`,
          `maxBat=${fmt(t.maxBatons)}`,
          `unfilledR=${fmt(t.unfilledRaces)}`,
          `$/miner/race=${fmt(perMiner, 6)}`,
        ].join(' | '),
      );
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
