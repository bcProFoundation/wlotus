/**
 * Family-econ simulator tests — pure, deterministic (no RNG).
 */
import { runFamilySim } from '../src/sim/familyEcon.js';

const DAY = 144;
const ZERO = () => 0;

describe('family-econ entry and scale freedom', () => {
  test('denominations are scale-free replicas (milli fee-dragged)', () => {
    const mk = (denom: 'milli' | 'base' | 'mega', d: number) =>
      runFamilySim({
        slots: 3,
        demandUsd: {
          milli: denom === 'milli' ? () => d : ZERO,
          base: denom === 'base' ? () => d : ZERO,
          mega: denom === 'mega' ? () => d : ZERO,
        },
        genesisBatons: { [denom]: 1 } as Record<typeof denom, number>,
        smallMiners: 10000,
        largeMiners: 1000,
      });
    const base = mk('base', 1).byDenom.base;
    const mega = mk('mega', 1000).byDenom.mega;
    const milli = mk('milli', 0.001).byDenom.milli;
    // Fee costs one entrant off the frictionless 140.
    expect(base.avgEntrants).toBeGreaterThan(135);
    expect(base.avgEntrants).toBeLessThan(142);
    expect(mega.avgEntrants).toBeCloseTo(base.avgEntrants, 6);
    expect(milli.avgEntrants).toBeLessThan(130);
    expect(milli.avgEntrants).toBeGreaterThan(115);
  });

  test('small miners cannot float mega (capital barrier), base fills', () => {
    const r = runFamilySim({
      slots: 2,
      demandUsd: { milli: ZERO, base: () => 1, mega: () => 1000 },
      genesisBatons: { base: 1, mega: 1 },
      smallMiners: 10000,
      largeMiners: 0,
    });
    expect(r.byDenom.mega.blocks).toBe(0);
    expect(r.byDenom.mega.unfilledRaces).toBe(2);
    expect(r.byDenom.base.blocks).toBe(2);
  });

  test('thin mega races pay capital-moat rents to large miners', () => {
    const r = runFamilySim({
      slots: 2,
      demandUsd: { milli: ZERO, base: ZERO, mega: () => 1000 },
      genesisBatons: { mega: 1 },
      smallMiners: 10000,
      largeMiners: 100,
    });
    const t = r.byDenom.mega;
    expect(t.blocks).toBe(2);
    expect(t.avgEntrants).toBeLessThan(139);
    const perMiner = t.profitUsd / (t.blocks * t.avgEntrants);
    // (1000 - F - 100 x $2.14) / 100 ≈ $7.86/miner/race.
    expect(perMiner).toBeGreaterThan(7);
    expect(perMiner).toBeLessThan(9);
  });
});

describe('family-econ activation and premium', () => {
  test('cold start consolidates into 28-baton tokens', () => {
    const r = runFamilySim({
      slots: 160,
      demandUsd: { milli: ZERO, base: () => 30, mega: ZERO },
      genesisBatons: { base: 0 },
      tauBaton: 6,
      tauClone: 144,
    });
    // 30 batons of need -> 2 clones (28 + 2), not 30 clones.
    expect(r.byDenom.base.tokensDeployed).toBe(2);
    expect(r.byDenom.base.blocks).toBeGreaterThan(300);
    expect(r.byDenom.base.unfilledDemandUsd).toBeGreaterThan(0);
  });

  test('surge premium peaks at D/active, then decays to par', () => {
    const r = runFamilySim({
      slots: 30 * DAY,
      demandUsd: {
        milli: ZERO,
        base: slot => (slot > 5 * DAY ? 100 : 10),
        mega: ZERO,
      },
      genesisBatons: { base: 10 },
    });
    // Surge hits 10 active batons: P = 100/10 = $10 (10x peak).
    expect(r.maxPremium).toBeCloseTo(10, 6);
    expect(r.meanPremium).toBeLessThan(3);
    expect(r.byDenom.base.endNeed).toBe(100);
    expect(r.byDenom.base.endActive).toBeGreaterThanOrEqual(100);
  });

  test('post-collapse clone overhang idles harmlessly (overdamped)', () => {
    const r = runFamilySim({
      slots: 30 * DAY,
      demandUsd: {
        milli: ZERO,
        base: slot => (slot > 5 * DAY && slot <= 8 * DAY ? 100 : 10),
        mega: ZERO,
      },
      genesisBatons: { base: 10 },
    });
    expect(r.clonesDeployed).toBeLessThanOrEqual(5);
    expect(r.meanPremium).toBeLessThan(2);
    // Pre (5d x 10) + post (22d x 10) minimum, surge adds on top.
    expect(r.blocksTotal).toBeGreaterThanOrEqual(27 * DAY * 10);
  });

  test('peg-deviation duration scales with clone lag', () => {
    const mk = (tauClone: number) =>
      runFamilySim({
        slots: 30 * DAY,
        demandUsd: {
          milli: ZERO,
          base: slot => (slot > 5 * DAY ? 100 : 10),
          mega: ZERO,
        },
        genesisBatons: { base: 10 },
        tauClone,
      });
    const fast = mk(36).premiumSlots15;
    const mid = mk(144).premiumSlots15;
    const slow = mk(1008).premiumSlots15;
    expect(fast).toBeLessThan(mid);
    expect(mid).toBeLessThan(slow);
  });
});

describe('family-econ treadmill and ladder', () => {
  const SIX_YEARS = 6 * 365 * DAY;

  test('treadmill prices small miners out of base ~5y (F7)', () => {
    const r = runFamilySim({
      slots: SIX_YEARS,
      demandUsd: { milli: ZERO, base: () => 10, mega: ZERO },
      genesisBatons: { base: 10 },
      largeMiners: 2000,
    });
    const t = r.byDenom.base;
    expect(t.endSmallM).toBe(0);
    // Treadmill shrinks M* itself (139 -> ~56) while pricing small out;
    // large survivors fill every race and split ~$1 fewer ways (richer).
    // avgSmallM > 0 proves small mined early (crossover, not slot-1
    // crowding — pro-rata rationing within the tier).
    expect(t.avgSmallM).toBeGreaterThan(50);
    expect(t.endLargeM).toBeGreaterThan(40);
    expect(t.endLargeM).toBeLessThan(70);
    expect(r.meanPremium).toBeCloseTo(1, 2);
  });

  test('priced-out small miners descend to milli when demand exists (F8)', () => {
    const r = runFamilySim({
      slots: SIX_YEARS,
      demandUsd: { milli: () => 0.01, base: () => 10, mega: ZERO },
      genesisBatons: { base: 10, milli: 10 },
      largeMiners: 2000,
    });
    expect(r.byDenom.base.endSmallM).toBe(0);
    // Milli M* treadmills too (123 -> ~49); small miners dominate it —
    // small-majority refuge (rationed-out large cascade down-ladder).
    expect(r.byDenom.milli.endSmallM).toBeGreaterThan(40);
    expect(r.byDenom.milli.endSmallM).toBeGreaterThan(
      r.byDenom.milli.endLargeM,
    );
  });
});

describe('family-econ invariants', () => {
  test('conservation: issuanceBase = blocks x 100 x scale', () => {
    const r = runFamilySim({
      slots: 50,
      demandUsd: {
        milli: () => 0.01,
        base: slot => (slot % 2 === 0 ? 5 : 0.001),
        mega: () => 2000,
      },
      genesisBatons: { base: 5, milli: 10, mega: 2 },
      smallMiners: 20000,
      largeMiners: 500,
    });
    const t = r.byDenom;
    const expectBase =
      t.milli.blocks * 100 * 0.001 +
      t.base.blocks * 100 * 1 +
      t.mega.blocks * 100 * 1000;
    expect(r.issuanceBase).toBeCloseTo(expectBase, 6);
    expect(r.blocksTotal).toBe(
      t.milli.blocks + t.base.blocks + t.mega.blocks,
    );
  });

  test('no RNG: identical runs produce identical trajectories', () => {
    const mk = () =>
      runFamilySim({
        slots: 200,
        demandUsd: {
          milli: () => 0.005,
          base: slot => (slot % 20 < 10 ? 12 : 3),
          mega: () => 5000,
        },
        genesisBatons: { base: 12, milli: 5, mega: 5 },
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
