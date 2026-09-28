/**
 * Free-econ simulator tests — pure, deterministic (no RNG).
 */
import { runFreeSim } from '../src/sim/freeEcon.js';

const DAY = 144;
const POPS = { smallMiners: 15000, largeMiners: 2000 };
const GENESIS = { base: 1, grand: 1 };

describe('free-econ cost anchor and floating ratio', () => {
  test('calm clears at cost both tiers, ratio ~1000x (C1)', () => {
    const r = runFreeSim({
      slots: 30 * DAY,
      demandUsd: { base: () => 100, grand: () => 1000 },
      genesisBatons: GENESIS,
      ...POPS,
    });
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 6);
    expect(r.byTier.grand.endPrice).toBeCloseTo(1000, 3);
    expect(r.meanRatio).toBeCloseTo(1000, 0);
    expect(r.byTier.base.avgEntrants).toBeGreaterThan(145);
    expect(r.byTier.base.avgEntrants).toBeLessThan(155);
  });

  test('energy matches designer spec ($0.25 / $250 per block)', () => {
    const r = runFreeSim({
      slots: 10 * DAY,
      demandUsd: { base: () => 100, grand: () => 1000 },
      genesisBatons: GENESIS,
      ...POPS,
    });
    // 149 seats (the fee displaces one entrant): 149 x Wc0 per block.
    expect(r.byTier.base.energyUsd / r.byTier.base.blocks).toBeCloseTo(
      0.2483,
      3,
    );
    expect(r.byTier.grand.energyUsd / r.byTier.grand.blocks).toBeCloseTo(
      248.33,
      1,
    );
  });
});

describe('free-econ thin resilience and V-shapes', () => {
  test('grand collapse solo-mines cheap, ratio crashes, recovers (C3)', () => {
    const r = runFreeSim({
      slots: 30 * DAY,
      demandUsd: {
        base: () => 100,
        grand: slot => (slot > 5 * DAY && slot <= 8 * DAY ? 10 : 1000),
      },
      genesisBatons: GENESIS,
      ...POPS,
    });
    // Thin $10 flow: solo mines (no death), ratio craters, V recovers.
    expect(r.minRatio).toBeLessThan(50);
    expect(r.byTier.grand.endPrice).toBeCloseTo(1000, 0);
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 6);
    expect(r.byTier.grand.blocks).toBeGreaterThan(0);
  });

  test('base collapse thins to M~=7 at $0.05, recovers (C4)', () => {
    const r = runFreeSim({
      slots: 30 * DAY,
      demandUsd: {
        base: slot => (slot > 5 * DAY && slot <= 8 * DAY ? 0.05 : 100),
        grand: () => 1000,
      },
      genesisBatons: GENESIS,
      ...POPS,
    });
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 6);
    expect(r.maxRatio).toBeGreaterThan(5000);
    expect(r.byTier.base.blocks).toBeGreaterThan(0);
  });
});

describe('free-econ reservation and patience (cobweb)', () => {
  const flash = {
    slots: 30 * DAY,
    demandUsd: {
      base: (slot: number) => (slot === 5 * DAY ? 1000000 : 100),
      grand: () => 1000,
    },
    genesisBatons: GENESIS,
    ...POPS,
  };

  test('flash binds reservation (3x design cap), floods pent-up', () => {
    const r = runFreeSim({ ...flash, patience: 0.9 });
    // Design $1: price pinned near the $3 cap mid-flood, $1M mostly
    // unfilled; the 25-day tail drains the flood (endPrice ~ design).
    expect(r.byTier.base.unfilledUsd).toBeGreaterThan(500000);
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 0);
  });

  test('drain time scales with patience (0.5 < 0.9 < 0.99)', () => {
    const u05 = runFreeSim({ ...flash, patience: 0.5 }).unfilledUsd;
    const u09 = runFreeSim({ ...flash, patience: 0.9 }).unfilledUsd;
    const u099 = runFreeSim({ ...flash, patience: 0.99 }).unfilledUsd;
    expect(u05).toBeLessThan(u09);
    expect(u09).toBeLessThan(u099);
  });
});

describe('free-econ segmentation and treadmill', () => {
  test('sustained base surge: large stay grand, small hold base (C6)', () => {
    const r = runFreeSim({
      slots: 30 * DAY,
      demandUsd: { base: () => 1000, grand: () => 1000 },
      genesisBatons: GENESIS,
      ...POPS,
    });
    // Grand absolute-$ retains large (majority grand); small all base.
    expect(r.byTier.grand.avgLargeM).toBeGreaterThan(100);
    expect(r.byTier.base.avgSmallM).toBeGreaterThan(10);
    expect(r.byTier.grand.avgSmallM).toBe(0);
  });

  test('18y rotation ON: anchor holds, inclusion kept (C7)', () => {
    const r = runFreeSim({
      slots: 18 * 365 * DAY,
      demandUsd: { base: () => 100, grand: () => 1000 },
      genesisBatons: GENESIS,
      ...POPS,
    });
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 2);
    expect(r.byTier.grand.endPrice).toBeCloseTo(1000, 0);
    expect(r.byTier.base.endSmallM).toBeGreaterThan(50);
  });

  test('18y rotation OFF: prices flat, small priced out (C8)', () => {
    const r = runFreeSim({
      slots: 18 * 365 * DAY,
      demandUsd: { base: () => 100, grand: () => 1000 },
      genesisBatons: { base: 112, grand: 1 },
      allowFreshClones: false,
      ...POPS,
    });
    // Treadmill = concentration, not inflation: base price holds...
    expect(r.byTier.base.endPrice).toBeCloseTo(1, 1);
    // ...while M thins and small miners exit base.
    expect(r.byTier.base.endSmallM).toBe(0);
    expect(r.byTier.base.avgEntrants).toBeLessThan(140);
    // Grand DIES rotation-off: Wc crosses large float (mid-teens at 12%/yr
    // delta), nobody can float the races — no market, no price.
    // Rotation = float relief (contrast C7 alive). Static-float
    // caveat: real floats grow with reinvestment (deferred).
    expect(r.byTier.grand.endBlocks).toBe(0);
    expect(r.byTier.grand.endPrice).toBe(0);
  });
});

describe('free-econ invariants', () => {
  test('conservation: issuanceBase = blocks x 100 x scale', () => {
    const r = runFreeSim({
      slots: 200,
      demandUsd: {
        base: slot => (slot % 20 < 10 ? 300 : 40),
        grand: slot => (slot % 40 < 20 ? 3000 : 500),
      },
      genesisBatons: GENESIS,
      ...POPS,
    });
    const t = r.byTier;
    expect(r.issuanceBase).toBeCloseTo(
      t.base.blocks * 100 * 1 + t.grand.blocks * 100 * 1000,
      6,
    );
    expect(r.blocksTotal).toBe(t.base.blocks + t.grand.blocks);
  });

  test('no RNG: identical runs produce identical trajectories', () => {
    const mk = () =>
      runFreeSim({
        slots: 200,
        demandUsd: {
          base: slot => (slot % 20 < 10 ? 300 : 40),
          grand: slot => (slot % 40 < 20 ? 3000 : 500),
        },
        genesisBatons: GENESIS,
        ...POPS,
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
