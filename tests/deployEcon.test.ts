import { runDeploySim } from '../src/sim/deployEcon.js';

const DAY = 144;
const flat =
  (v: number): ((slot: number) => number) =>
  () =>
    v;
// Lottery solo cost: E0 + o + F = 0.25 + 0.005 + 1750*1e-8/… (fee dust).
const SOLO = 0.25 + 0.005 + 0.0001225;
const POPS = { smallMiners: 15000, largeMiners: 2000 };

describe('theorem terminal (lottery: slide to solo-cost $0.2551)', () => {
  it('pins P at E+o+F with large-only solos + corpse overhang', () => {
    const r = runDeploySim({
      slots: 30 * DAY,
      demandUsd: flat(100),
      foresight: 'myopic-flow',
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(SOLO, 3);
    expect(r.activeEnd).toBe(392); // n* = D/MC
    expect(r.deployed).toBeGreaterThan(1500); // G-overshoot corpses
    expect(r.deployed).toBeLessThan(2000);
    expect(r.dormantEnd).toBeGreaterThan(1000);
    expect(r.idleSlots).toBeGreaterThan(0); // crash-settle idles
    expect(r.endSmallM).toBe(0); // smalls locked out below $0.375
    expect(r.endLargeM).toBe(1); // large-only solos
    expect(r.slideSlots).toBeLessThan(50); // 0.2d slide
    // Flat pin: last-12-sample path constant at SOLO.
    const tail = r.pricePath.filter((_, i) => i % 360 === 0).slice(-6);
    for (const p of tail) expect(p).toBeCloseTo(SOLO, 3);
  });
});

describe('coarse quantization chatters (G/n* ~ 1 never settles)', () => {
  it('D=$10/G=10 chatters sub-MC instead of pinning', () => {
    const r = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      ...POPS,
    });
    expect(r.meanPrice).toBeLessThan(SOLO); // chatter-discount
    expect(r.idleSlots).toBeGreaterThan(0);
    expect(r.dormantEnd).toBeGreaterThan(0);
    expect(r.deployed).toBeGreaterThan(100);
  });
});

describe('forward self-arrest ($1 fee, D=$10)', () => {
  it('pins at $0.333 marginal (no boundary, large-only)', () => {
    const r = runDeploySim({
      slots: 600,
      demandUsd: flat(10),
      foresight: 'forward',
      cloneCostUsd: 1,
      batonCostUsd: 1,
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(1 / 3, 2);
    expect(r.deployed).toBeGreaterThanOrEqual(28);
    expect(r.deployed).toBeLessThanOrEqual(32);
    expect(r.dormantEnd).toBe(0);
    expect(r.endSmallM).toBe(0); // E/16 > small float: gated
    expect(r.windowEnd).toBeGreaterThan(7);
    expect(r.windowEnd).toBeLessThan(14);
  });
});

describe('forward with default fee = myopic (self-arrest invisible)', () => {
  it('matches the myopic chatter exactly (c/L negligible vs $0.255)', () => {
    const a = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      ...POPS,
    });
    const b = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'forward',
      ...POPS,
    });
    expect(b.deployed).toBe(a.deployed);
    expect(b.priceEnd).toBeCloseTo(a.priceEnd, 6);
  });
});

describe('creation-fee pin, fine-G (D=$10, $0.50 uniform, L=10)', () => {
  it('pins at baton-marginal $0.303 (G=1 settles, no corpses)', () => {
    const r = runDeploySim({
      slots: 600,
      demandUsd: flat(10),
      foresight: 'forward',
      cloneCostUsd: 0.5,
      batonCostUsd: 0.5,
      obscurityWindow: 10,
      deploysPerSlot: 1,
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(0.303, 2);
    expect(r.deployed).toBeGreaterThanOrEqual(30);
    expect(r.deployed).toBeLessThanOrEqual(36);
    expect(r.dormantEnd).toBe(0);
    expect(r.endSmallM).toBe(0);
  });
});

describe('fee pin, full scale (V2d: $1 adaptive -> $0.3247 boundary)', () => {
  it('pins at the 11-token boundary (forward, baton-marginal)', () => {
    const r = runDeploySim({
      slots: 30 * DAY,
      demandUsd: flat(100),
      foresight: 'forward',
      cloneCostUsd: 0.5,
      batonCostUsd: 0.5,
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(0.3247, 3);
    expect(r.deployed).toBeGreaterThanOrEqual(300);
    expect(r.deployed).toBeLessThanOrEqual(320);
    expect(r.dormantEnd).toBe(0);
  });
});

describe('myopic ignores fees (uniform $5, D=$10)', () => {
  it('chatters identically to no-fee while burning $2.3K', () => {
    const free = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      ...POPS,
    });
    const fee = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      cloneCostUsd: 5,
      batonCostUsd: 5,
      ...POPS,
    });
    expect(fee.priceEnd).toBeCloseTo(free.priceEnd, 6);
    expect(fee.deployed).toBe(free.deployed);
    expect(fee.deployCostUsd).toBeGreaterThan(2000);
  });
});

describe('royalty bypass, full scale (V4b: 90% -> $0.2545)', () => {
  it('H-holds at MC while the issuer extracts $389K', () => {
    const r = runDeploySim({
      slots: 30 * DAY,
      demandUsd: flat(100),
      foresight: 'myopic-flow',
      royaltyRate: 0.9,
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(0.2545, 2);
    expect(r.issuerProfitUsd).toBeGreaterThan(300000);
    expect(r.idleSlots).toBeLessThan(50);
  });
});

describe('royalty chatter, coarse (25%, D=$10)', () => {
  it('bypasses into sub-MC chatter (issuer still extracts)', () => {
    const r = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      royaltyRate: 0.25,
      ...POPS,
    });
    expect(r.meanPrice).toBeLessThan(SOLO);
    expect(r.issuerProfitUsd).toBeGreaterThan(0);
    expect(r.idleSlots).toBeGreaterThan(0);
  });
});

describe('bench-bound swap-freeze (200 bodies, D=$100)', () => {
  it('freezes early at $0.66 (path-dependent, NOT D/bench)', () => {
    const r = runDeploySim({
      slots: 600,
      demandUsd: flat(100),
      foresight: 'myopic-flow',
      smallMiners: 150,
      largeMiners: 50,
    });
    expect(r.priceEnd).toBeCloseTo(0.6623, 1);
    expect(r.activeEnd).toBeGreaterThanOrEqual(140);
    expect(r.activeEnd).toBeLessThanOrEqual(160);
    // n runs away G-capped (swap-churn piles treadmill-drained corpses).
    expect(r.deployed).toBeGreaterThan(5000);
    expect(r.endSmallM).toBeGreaterThan(0); // gated-in but thin-stuck
    expect(r.slideSlots).toBe(-1); // never nears MC
  });
});

describe('dormant overhang (G=0: crash, idle, V-recovery)', () => {
  it('idles through the crash and refills to M*=149 within 10 slots', () => {
    const r = runDeploySim({
      slots: 400,
      demandUsd: s => (s <= 100 ? 10 : s <= 200 ? 0.01 : 10),
      foresight: 'myopic-flow',
      deploysPerSlot: 0,
      patience: 0,
      ...POPS,
    });
    expect(r.deployed).toBe(10);
    expect(r.minPrice).toBeLessThan(0.01);
    expect(r.idleSlots).toBeGreaterThan(80);
    expect(r.activePath[209]).toBe(10); // refilled by slot 210
    expect(r.activeEnd).toBe(10);
    expect(r.priceEnd).toBeCloseTo(1, 6);
    expect(r.endSmallM + r.endLargeM).toBeCloseTo(149, 0);
  });
});

describe('no-deploy into nothing (D=0)', () => {
  it('never deploys (flow deeply negative)', () => {
    const r = runDeploySim({
      slots: 100,
      demandUsd: flat(0),
      foresight: 'myopic-flow',
      ...POPS,
    });
    expect(r.deployed).toBe(1);
    expect(r.idleSlots).toBe(100);
    expect(r.priceEnd).toBe(0);
  });
});

describe('conservation + determinism', () => {
  it('blocks/issuance consistent and runs bit-identical', () => {
    const mk = () =>
      runDeploySim({
        slots: 400,
        demandUsd: flat(10),
        foresight: 'myopic-flow',
        ...POPS,
      });
    const a = mk();
    const b = mk();
    expect(a.blocks).toBe(a.issuanceNative / 100);
    expect(b.priceEnd).toBe(a.priceEnd);
    expect(b.deployed).toBe(a.deployed);
    expect(b.energyUsd).toBe(a.energyUsd);
  });
});

describe('stickiness (deployed never falls)', () => {
  it('deployedPath monotone non-decreasing through chatter', () => {
    const r = runDeploySim({
      slots: 400,
      demandUsd: flat(10),
      foresight: 'myopic-flow',
      ...POPS,
    });
    for (let i = 1; i < r.deployedPath.length; i++)
      expect(r.deployedPath[i]).toBeGreaterThanOrEqual(r.deployedPath[i - 1]);
  });
});

describe('V7 small (E0=$0.99: blockade with breach-episodes)', () => {
  it('re-forms the $1 blockade, excludes smalls, banks corpses', () => {
    const r = runDeploySim({
      slots: 600,
      demandUsd: flat(10),
      foresight: 'forward',
      blockEnergyUsd: 0.99,
      opportunityUsd: 0.01,
      ...POPS,
    });
    expect(r.priceEnd).toBeCloseTo(1, 6);
    expect(r.endSmallM).toBe(0);
    expect(r.idleSlots).toBeGreaterThan(0); // breach-episodes happened
    expect(r.dormantEnd).toBeGreaterThan(r.activeEnd);
  });
});

describe('grand thin-chop (V8 15d: n*~=4 never settles)', () => {
  it('churns sub-MC (thin-discount, no full idle, corpse pile)', () => {
    const r = runDeploySim({
      slots: 15 * DAY,
      demandUsd: flat(1000),
      foresight: 'myopic-flow',
      scale: 1000,
      ...POPS,
    });
    expect(r.meanPrice).toBeLessThan(255); // thin-discount
    expect(r.activeEnd).toBeLessThan(30);
    expect(r.deployed).toBeGreaterThan(1000);
    expect(r.idleSlots).toBe(0); // partial chop, overhang cushions
  });
});
