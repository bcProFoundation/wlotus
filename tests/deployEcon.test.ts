/**
 * Baton-deployment game tests (ELOTUS v6) — fast, small-bench configs.
 *
 * Base MC = Wc0 + o = $0.006667/entrant (+$0.0001225 fee); solo-viable
 * P = MC + F = $0.006789. D=$10 runs slide n0=10 -> ~1,470 in ~150
 * slots (G=10) — full theorem dynamics in <1s each.
 */
import { runDeploySim } from '../src/sim/deployEcon.js';

const MC = 0.25 * 0.005 / 0.75 + 0.005; // $0.006667
const FEE = (1750 / 100) * 0.000007; // $0.0001225
const SOLO = MC + FEE; // $0.006789
const POPS = { smallMiners: 1500, largeMiners: 500 }; // bench 2000
const flat = (v: number) => () => v;

describe('theorem terminal (myopic, D=$10)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'myopic-flow',
    ...POPS,
  });
  it('slides to MC+F and pins (all-solo, no dormant)', () => {
    expect(r.priceEnd).toBeCloseTo(SOLO, 4);
    expect(r.minPrice).toBeCloseTo(SOLO, 4);
    expect(r.endSmallM + r.endLargeM).toBeCloseTo(1, 1);
    expect(r.dormantEnd).toBe(0);
    expect(r.idleSlots).toBe(0);
  });
  it('freezes n at D/MC (deployment stops, flow <= 0)', () => {
    expect(r.deployed).toBeGreaterThan(1300);
    expect(r.deployed).toBeLessThan(1650); // D/MC = 1500
    expect(r.activeEnd).toBe(r.deployed);
    // Pinned: last 100 slots within 1% of SOLO (G-batch quantization:
    // profitable slots deploy all G=10 (0.7% of n*), then knife-edge
    // stop — pins quantize to G-batches, like V2b/c token-overrun).
    const tail = r.pricePath.slice(-100);
    for (const p of tail) expect(Math.abs(p - SOLO) / SOLO).toBeLessThan(0.01);
  });
  it('never exceeds 28 batons per token', () => {
    expect(r.maxBatons).toBeLessThanOrEqual(28);
    expect(r.tokens).toBeGreaterThanOrEqual(Math.ceil(r.deployed / 28));
  });
});

describe('bench-bound (shallow bench pins above MC)', () => {
  const r = runDeploySim({
    slots: 2000,
    demandUsd: flat(100),
    foresight: 'myopic-flow',
    smallMiners: 500,
    largeMiners: 100, // bench 600 < D/MC
  });
  it('holds P at D/bench (anchor survives while bench shallow)', () => {
    expect(r.priceEnd).toBeCloseTo(100 / 600, 1); // $0.167
    expect(r.activeEnd).toBeLessThanOrEqual(600);
    expect(r.activeEnd).toBeGreaterThan(500);
  });
  it('keeps deploying (flow > 0 forever above MC)', () => {
    expect(r.deployed).toBeGreaterThan(15000); // G-capped, never stops
    expect(r.dormantEnd).toBeGreaterThan(14000); // swap corpses pile
  });
});

describe('forward self-arrest (adaptive window)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'forward',
    ...POPS,
  });
  it('arrests ABOVE MC (short windows demand high flow)', () => {
    expect(r.priceEnd).toBeGreaterThan(SOLO * 1.2);
    expect(r.priceEnd).toBeLessThan(0.05); // but it did slide from $1
    expect(r.deployed).toBeLessThan(1300); // stopped early
    expect(r.windowEnd).toBeLessThan(6); // thin races staff fast
  });
});

describe('creation-fee pin (forward, fixed L=10)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'forward',
    cloneCostUsd: 5,
    batonCostUsd: 5,
    obscurityWindow: 10,
    ...POPS,
  });
  it('pins at MC + c/L (marginal deployment)', () => {
    expect(r.priceEnd).toBeCloseTo(SOLO + 0.5, 1); // $0.507
    expect(r.deployed).toBeGreaterThan(10);
    expect(r.deployed).toBeLessThan(40); // n* = D/0.51 = 20
  });
});

describe('myopic ignores fees (capital destruction)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'myopic-flow',
    cloneCostUsd: 5,
    batonCostUsd: 5,
    ...POPS,
  });
  it('slides to MC anyway, burning fees', () => {
    expect(r.priceEnd).toBeCloseTo(SOLO, 4);
    expect(r.deployCostUsd).toBeGreaterThan(1000); // ~1470 x $5
  });
});

describe('royalty bypass (myopic + 25% royalty)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'myopic-flow',
    royaltyRate: 0.25,
    ...POPS,
  });
  it('royalty does not pin (self-miners pay themselves)', () => {
    expect(r.priceEnd).toBeCloseTo(SOLO, 4);
    expect(r.issuerProfitUsd).toBeGreaterThan(0); // transfer happened
  });
});

describe('stickiness (deployed never falls)', () => {
  const r = runDeploySim({
    slots: 400,
    demandUsd: flat(10),
    foresight: 'myopic-flow',
    ...POPS,
  });
  it('deployedPath is monotone non-decreasing', () => {
    for (let i = 1; i < r.deployedPath.length; i++)
      expect(r.deployedPath[i]).toBeGreaterThanOrEqual(r.deployedPath[i - 1]);
  });
});

describe('dormant overhang (G=0 crash + recovery, no deployment)', () => {
  const r = runDeploySim({
    slots: 300,
    demandUsd: slot => (slot <= 100 ? 10 : slot <= 200 ? 0.01 : 10),
    foresight: 'myopic-flow',
    deploysPerSlot: 0, // re-entry only
    patience: 0, // no pent-up backstop (clean crash)
    ...POPS,
  });
  it('crashes dormant then reactivates without deploying', () => {
    expect(r.deployed).toBe(10); // n0 frozen (G=0)
    const crash = r.activePath.slice(100, 200);
    expect(Math.min(...crash)).toBeLessThan(5); // evacuated
    expect(r.activeEnd).toBe(10); // full reactivation
    expect(r.priceEnd).toBeCloseTo(1, 1); // P = D/n back at $1
    // Fast: back to full active within 30 slots of demand return.
    expect(r.activePath[229]).toBe(10);
  });
});

describe('no-deploy into nothing (D=0)', () => {
  const r = runDeploySim({
    slots: 100,
    demandUsd: flat(0),
    foresight: 'myopic-flow',
    ...POPS,
  });
  it('never deploys into zero demand', () => {
    expect(r.deployed).toBe(1);
    expect(r.idleSlots).toBe(100);
  });
});

describe('conservation + determinism', () => {
  const params = {
    slots: 200,
    demandUsd: flat(10),
    foresight: 'myopic-flow' as const,
    ...POPS,
  };
  it('blocks == sum(activePath), issuance == 100x', () => {
    const r = runDeploySim(params);
    const sumActive = r.activePath.reduce((a, b) => a + b, 0);
    expect(r.blocks).toBe(sumActive);
    expect(r.issuanceNative).toBe(r.blocks * 100);
  });
  it('two runs are bit-identical', () => {
    const a = runDeploySim(params);
    const b = runDeploySim(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('Wc0=$1 solo-pin (trilemma, D=$10 small)', () => {
  const r = runDeploySim({
    slots: 30 * 144,
    demandUsd: flat(10),
    foresight: 'forward',
    energyShare: 0.99,
    opportunityUsd: 0.01,
    ...POPS,
  });
  it('holds $1 ~15d (H-stickiness), excludes smalls', () => {
    const early = r.pricePath.slice(0, 2000);
    const mean = early.reduce((a, b) => a + b, 0) / early.length;
    expect(mean).toBeCloseTo(1, 1);
    expect(r.endSmallM).toBe(0); // float-locked out
  });
  it('treadmill-breach collapses it (idle + corpses)', () => {
    expect(r.idleSlots).toBeGreaterThan(0);
    expect(r.dormantEnd).toBeGreaterThan(r.activeEnd);
  });
});

describe('grand scale-invariance (x1000)', () => {
  const r = runDeploySim({
    slots: 60 * 144,
    demandUsd: flat(1000),
    foresight: 'myopic-flow',
    scale: 1000,
    smallMiners: 15000,
    largeMiners: 2000,
  });
  it('slides $1000 -> MCx1000, solo', () => {
    expect(r.priceEnd).toBeCloseTo(MC * 1000, 0); // $6.62-6.67
    expect(r.endSmallM + r.endLargeM).toBeCloseTo(1, 1);
    expect(r.deployed).toBeGreaterThan(100);
    expect(r.deployed).toBeLessThan(200); // n* = 1000/6.67 = 150
  });
});
