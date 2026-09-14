#!/usr/bin/env tsx
/**
 * Baton-deployment scenarios (ELOTUS v6) — endogenous race formation.
 *
 *   npm run sim-deploy-econ
 *
 * Single tier per run (base $1 design unless scaled). v5 ASSUMED need =
 * D/design; v6 deploys races via profit-seeking deployers (clone vs
 * same-token baton, 28/token), staffs the bench with λ-lag, clears at
 * P = D/active (R-capped, pent-up patience), steps active races 1 δ
 * per block (dormant frozen). MC = $0.00667/entrant (+$0.00012 fee).
 *
 * V1a: myopic slide - THE THEOREM ($1 -> MC+F in 9.4d, n -> D/MC,
 *     all-solo, dor=0, pinned flat). V1b: forward self-arrests $0.019
 *     (thin races staff fast - short W demands high flow). V1c: sticky
 *     identical (birth-activation bypasses fill order).
 * V2a: myopic + $5 fee - slides anyway, burns $2.6K (naive).
 * V2b/c: forward clone-walls $1.01/$0.51 (L=10) - pins quantize to
 *     $0.89/$0.45 (batons fill the open token past the wall: <=28
 *     token-overrun; marginal-baton correct). V2d: $0.50 adaptive
 *     pins $0.20 (W=2 marginal). THE $1 PIN = fee c with c/L ~ $1.
 * V3a/b: $1 fee, lam 0.9 vs 0.1 - blockade $0.91 vs pin $0.14 (W 1.0
 *     vs 14.4: PERVERSE - slow entry lengthens obscurity 14x).
 * V4a/b: myopic royalty 25%/90% - bypassed (both -> MC exactly;
 *     issuers collect $108K/$389K without pinning).
 * V5: 28-cap + $5/$0.05 - 8 full tokens, clone-wall pin $0.45.
 * V6: G=1 + Dx8/yr - P bottoms then RISES (growth outruns G).
 * V7: Wc0=$1 - $1-pin HOLDS 15d then treadmill-breach collapses to
 *     large-bench-bound $0.05 + idle (solo-pin REFUTED; trilemma).
 * V8: grand x1000 - $1000 -> $6.62 solo (scale-invariant).
 * V9a: uniform 45d - freeze $0.0331 FLAT (coordination failure pins
 *     ABOVE MC (thin-spread starvation); n -> 65K corpses).
 * V9b: H=0 - violent slide (idle 119, mean $0.20) but MC late (H =
 *     slide-smoothness + n-finiteness, not terminal selection).
 *
 * Pure simulation (deterministic, no RNG). No chain, no sats.
 */
import {
  runDeploySim,
  type DeployParams,
  type DeployResult,
} from '../src/sim/deployEcon.js';

const DAY = 144;
const YEAR = 365 * DAY;

const flat =
  (v: number): ((slot: number) => number) =>
  () =>
    v;

interface Scenario extends Omit<DeployParams, 'slots' | 'demandUsd'> {
  name: string;
  slots: number;
  demandUsd: (slot: number) => number;
}

const POPS = { smallMiners: 15000, largeMiners: 2000 };

const SCENARIOS: Scenario[] = [
  { name: 'V1a myopic slide (theorem demo)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', ...POPS },
  { name: 'V1b forward slide (adaptive W)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', ...POPS },
  { name: 'V1c sticky entry (order-robust)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', entryMode: 'sticky', ...POPS },
  { name: 'V2a myopic + $5 fee (naive burns)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', cloneCostUsd: 5, ...POPS },
  { name: 'V2b clone-wall $1.01 (quantized $0.89)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 5, batonCostUsd: 5, obscurityWindow: 10, initialRaces: 56, deploysPerSlot: 2, ...POPS },
  { name: 'V2c clone-wall $0.51 (quantized $0.45)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 2.5, batonCostUsd: 2.5, obscurityWindow: 10, initialRaces: 56, deploysPerSlot: 2, ...POPS },
  { name: 'V2d uniform $0.50 fee adaptive (marginal pin?)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 0.5, batonCostUsd: 0.5, ...POPS },
  { name: 'V3a fast entry λ=0.9 + $1 fee', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 1, batonCostUsd: 1, entryLag: 0.9, ...POPS },
  { name: 'V3b slow entry λ=0.1 + $1 fee', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 1, batonCostUsd: 1, entryLag: 0.1, ...POPS },
  { name: 'V4a myopic royalty 25% (bypass?)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', royaltyRate: 0.25, ...POPS },
  { name: 'V4b myopic royalty 90% (absurd)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', royaltyRate: 0.9, ...POPS },
  { name: 'V5 28-cap + $5 clone/$0.05 baton', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 5, batonCostUsd: 0.05, ...POPS },
  { name: 'V6 G=1 + Dx8/yr 120d (growth wins?)', slots: 120 * DAY, demandUsd: slot => 100 * 8 ** (slot / YEAR), foresight: 'myopic-flow', deploysPerSlot: 1, ...POPS },
  { name: 'V7 Wc0=$1 solo-pin (trilemma)', slots: 90 * DAY, demandUsd: flat(100), foresight: 'forward', energyShare: 0.99, opportunityUsd: 0.01, ...POPS },
  { name: 'V8 grand scale (x1000 invariance)', slots: 60 * DAY, demandUsd: flat(1000), foresight: 'myopic-flow', scale: 1000, ...POPS },
  { name: 'V9a uniform 45d (freeze stable?)', slots: 45 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', entryMode: 'uniform', ...POPS },
  { name: 'V9b H=0 knife-edge (violent slide?)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', exitHysteresis: 0, ...POPS },
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
    const t0 = Date.now();
    const r: DeployResult = runDeploySim(params);
    const ms = Date.now() - t0;
    const slideDays = r.slideSlots < 0 ? 'never' : (r.slideSlots / DAY).toFixed(1) + 'd';
    console.log(
      [
        name,
        `n=${fmt(r.deployed)} act=${fmt(r.activeEnd)} dor=${fmt(r.dormantEnd)}`,
        `endPx$=${fmt(r.priceEnd, 4)} meanPx$=${fmt(r.meanPrice, 4)} minPx$=${fmt(r.minPrice, 5)}`,
        `slide=${slideDays} endM=${(r.endSmallM + r.endLargeM).toFixed(2)} bench=${r.benchUseEnd.toFixed(2)}`,
        `feeCost$=${fmt(r.deployCostUsd, 0)} W=${r.windowEnd.toFixed(1)} rate=${r.deployRate.toFixed(2)}/slot`,
        `idle=${fmt(r.idleSlots)} tok=${fmt(r.tokens)} issuer$=${fmt(r.issuerProfitUsd, 0)}`,
        `${fmt(ms)}ms`,
      ].join(' | '),
    );
    const step = Math.max(1, Math.floor(r.pricePath.length / 12));
    const spark = r.pricePath
      .filter((_, i) => i % step === 0)
      .map(v => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(4)))
      .join(' ');
    console.log(`  path: ${spark}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
