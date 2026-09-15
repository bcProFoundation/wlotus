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
 * per block (dormant frozen). LOTTERY PoW: MC = E+o+F = $0.2551/solo
 * (solo burns the FULL $0.25 block energy - all-pay v6.0's $0.0067
 * terminal was the sequential-puzzle error; the covenant grinds
 * nonces = lottery). Smalls are pool-dependent (viable iff P>= $0.375).
 *
 * V1a: myopic slide - THE THEOREM ($1 -> $0.2551 in 0.2d, n*=392
 *     large-only solos, G-overshoot crash-settles (idle 13, 1.3K
 *     corpse-overhang), smalls excluded (endSmallM=0)). V1b: forward
 *     + $1 fee self-arrests $0.4464 (8-token boundary). V1c: sticky
 *     identical (order-robust).
 * V2a: myopic + $5 clone fee - slides anyway, burns $288 (57
 *     token-boundary walls; naive). V2b/c: $7.50/$3.75 walls (L=10)
 *     pin $0.89/$0.60 (token-boundary quantized, 4/6 full tokens).
 *     V2d: $1 adaptive pins $0.32 (11-token boundary, W=10).
 *     THE $1 PIN = fee c with c/L ~ $0.745.
 * V3a/b: $1 fee, lam 0.9 vs 0.1 - blockade $0.91 (W=1) vs pin $0.45
 *     (W=10: PERVERSE - slow entry lengthens obscurity 10x).
 * V4a/b: royalty 25%/90% - bypassed (E-floor churn-cycle $0.25, o
 *     squeezed to zero (25%); H-held $0.2545 (90%); issuers extract
 *     $107K/$389K without pinning).
 * V5: 28-cap + $5/$0.05 - 5 full tokens, clone-wall pin $0.71.
 * V6: G=1 + Dx8/yr - growth ABSORBED into chop around $0.255
 *     (deployment-elastic; n* too small to outrun).
 * V7: E0=$0.99 - NO pin (born-empty m0=0 + knife-edge band
 *     ($0.995,$1.00) births-only -> breach-cycles; trilemma).
 * V8: grand x1000 - permanent thin-chop (n*~=4, G-coarse,
 *     mean $186 sub-MC thin-discount; scale breaks smoothness).
 * V9a: uniform 45d - STARVATION-CYCLES ($0.007 <-> $0.45, idle 23%;
 *     lottery's 38x-wider E-breach-band evacuates (no freeze)).
 * V9b: H=0 - PERMANENT VIOLENCE (never settles; H NECESSARY for any
 *     pin (absorbs G-overshoot; without: evacuate-cycles forever)).
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
  { name: 'V1b forward + $1 fee (arrest $0.45)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 1, batonCostUsd: 1, ...POPS },
  { name: 'V1c sticky entry (order-robust)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', entryMode: 'sticky', ...POPS },
  { name: 'V2a myopic + $5 clone fee (burns $288)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', cloneCostUsd: 5, ...POPS },
  { name: 'V2b $7.50 wall (quantized $0.89)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 5, batonCostUsd: 2.5, obscurityWindow: 10, initialRaces: 50, deploysPerSlot: 2, ...POPS },
  { name: 'V2c $3.75 wall (quantized $0.60)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 2.5, batonCostUsd: 1.25, obscurityWindow: 10, initialRaces: 50, deploysPerSlot: 2, ...POPS },
  { name: 'V2d $1 adaptive (boundary $0.32)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 0.5, batonCostUsd: 0.5, ...POPS },
  { name: 'V3a fast λ=0.9 + $1 (blockade $0.91)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 1, batonCostUsd: 1, entryLag: 0.9, ...POPS },
  { name: 'V3b slow λ=0.1 + $1 (deep $0.45)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 1, batonCostUsd: 1, entryLag: 0.1, ...POPS },
  { name: 'V4a royalty 25% (E-floor cycle)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', royaltyRate: 0.25, ...POPS },
  { name: 'V4b royalty 90% (bypass $0.2545)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', royaltyRate: 0.9, ...POPS },
  { name: 'V5 28-cap + $5/$0.05 (pin $0.71)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'forward', cloneCostUsd: 5, batonCostUsd: 0.05, ...POPS },
  { name: 'V6 G=1 + Dx8/yr (absorbed)', slots: 120 * DAY, demandUsd: slot => 100 * 8 ** (slot / YEAR), foresight: 'myopic-flow', deploysPerSlot: 1, ...POPS },
  { name: 'V7 E0=$1 (knife-edge cycle)', slots: 90 * DAY, demandUsd: flat(100), foresight: 'forward', blockEnergyUsd: 0.99, opportunityUsd: 0.01, ...POPS },
  { name: 'V8 grand (thin-chop n*=4)', slots: 60 * DAY, demandUsd: flat(1000), foresight: 'myopic-flow', scale: 1000, ...POPS },
  { name: 'V9a uniform 45d (starvation cycles)', slots: 45 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', entryMode: 'uniform', ...POPS },
  { name: 'V9b H=0 (permanent violence)', slots: 30 * DAY, demandUsd: flat(100), foresight: 'myopic-flow', exitHysteresis: 0, ...POPS },
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
