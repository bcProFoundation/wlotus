/**
 * Grand-econ simulator tests — pure, deterministic (no RNG).
 */
import { runGrandSim } from '../src/sim/grandEcon.js';

const DAY = 144;
const POPS = { smallMiners: 15000, largeMiners: 2000 };

describe('grand-econ calm and standby', () => {
  test('calm clears at par; grand standby-idle, $5 whale flow spills (G1)', () => {
    const r = runGrandSim({
      slots: 30 * DAY,
      demandUsd: () => 100,
      whaleShare: () => 0.05,
      genesisBatons: { base: 1, grand: 1 },
      ...POPS,
    });
    expect(r.meanPremium).toBeLessThan(1.01);
    expect(r.meanPremium).toBeGreaterThan(0.99);
    expect(r.byTier.grand.blocks).toBe(0);
    expect(r.byTier.base.avgEntrants).toBeGreaterThan(135);
    expect(r.byTier.base.avgEntrants).toBeLessThan(142);
    // $5/slot whale flow can't cover a solo grand race ($7.14): spills.
    expect(r.spillUsd).toBeGreaterThan(20000);
    expect(r.unfilledD).toBeLessThan(100);
  });

  test('whaleShare 0 keeps grand idle at any demand (demand-gated)', () => {
    const r = runGrandSim({
      slots: 100,
      demandUsd: () => 500,
      whaleShare: () => 0,
      genesisBatons: { base: 1, grand: 1 },
      ...POPS,
    });
    expect(r.byTier.grand.blocks).toBe(0);
    expect(r.byTier.base.blocks).toBe(100 * 500);
  });
});

describe('grand-econ instant deployment and reaction wedge', () => {
  const surgePath = {
    slots: 30 * DAY,
    demandUsd: (slot: number) => (slot > 5 * DAY ? 10000 : 100),
    whaleShare: (slot: number) => (slot > 5 * DAY ? 0.8 : 0.05),
    genesisBatons: { base: 1, grand: 1 },
    ...POPS,
  };

  test('capacity meets need same-slot (no deployment lag)', () => {
    const r = runGrandSim({ ...surgePath, tauReact: 0 });
    expect(r.byTier.base.endActive).toBe(r.byTier.base.endNeed);
    expect(r.byTier.grand.endActive).toBe(r.byTier.grand.endNeed);
    expect(r.premiumSlots15).toBeLessThan(30);
  });

  test('reaction wedge scales with tauReact (F6 reborn)', () => {
    const u0 = runGrandSim({ ...surgePath, tauReact: 0 }).unfilledD;
    const u3 = runGrandSim({ ...surgePath, tauReact: 3 }).unfilledD;
    const u12 = runGrandSim({ ...surgePath, tauReact: 12 }).unfilledD;
    expect(u0).toBeLessThan(5000);
    expect(u3).toBeGreaterThan(u0);
    expect(u12).toBeGreaterThan(u3);
  });

  test('flash whale with instant reaction: pop-wall premium ~need/pop', () => {
    const r = runGrandSim({
      slots: 10 * DAY,
      demandUsd: slot => (slot === 5 * DAY ? 5000000 : 100),
      whaleShare: slot => (slot === 5 * DAY ? 0.99 : 0.05),
      genesisBatons: { base: 1, grand: 1 },
      tauReact: 0,
      ...POPS,
    });
    // Need 4950 grand races, 2000 large miners: P ≈ 4950/2000 ≈ 2.5x.
    expect(r.maxPremium).toBeGreaterThan(2);
    expect(r.maxPremium).toBeLessThan(3.5);
    expect(r.byTier.grand.blocks).toBeGreaterThan(1900);
    expect(r.byTier.grand.blocks).toBeLessThan(2100);
  });

  test('flash whale with 3-slot reaction: missed (needs standing allocation)', () => {
    const r = runGrandSim({
      slots: 10 * DAY,
      demandUsd: slot => (slot === 5 * DAY ? 5000000 : 100),
      whaleShare: slot => (slot === 5 * DAY ? 0.99 : 0.05),
      genesisBatons: { base: 1, grand: 1 },
      tauReact: 3,
      ...POPS,
    });
    // Flash is over before large miners redirect: ~$5M unfilled.
    expect(r.byTier.grand.blocks).toBeLessThan(100);
    expect(r.unfilledD).toBeGreaterThan(4000000);
  });
});

describe('grand-econ rotation vs control (6y treadmill)', () => {
  const SIX_YEARS = 6 * 365 * DAY;
  const base = {
    slots: SIX_YEARS,
    demandUsd: () => 100,
    whaleShare: () => 0.1,
    genesisBatons: { base: 1, grand: 1 },
    ...POPS,
  };

  test('rotation ON: par holds, thin grand standby-idles + spills (G6)', () => {
    const r = runGrandSim(base);
    expect(r.meanPremium).toBeLessThan(1.01);
    expect(r.meanPremium).toBeGreaterThan(0.99);
    // Par-gating: $10 thin flow never mines grand (standby-binary);
    // it spills to base ($3.1M carried, no discount tier).
    expect(r.byTier.grand.blocks).toBe(0);
    expect(r.byTier.grand.endSmallM).toBe(0);
    expect(r.byTier.grand.endLargeM).toBe(0);
    expect(r.spillUsd).toBeGreaterThan(3000000);
    // Fresh Wc0 forever: small miners never priced out of base.
    expect(r.byTier.base.endSmallM).toBeGreaterThan(50);
  });

  test('rotation BANNED, 1 token: wall + standby + unfilled (G6b)', () => {
    const r = runGrandSim({ ...base, allowFreshClones: false });
    // Listed-only base caps at 28 batons vs need 90: 90/28 wall, every slot.
    expect(r.meanPremium).toBeCloseTo(90 / 28, 6);
    expect(r.premiumSlots15).toBe(6 * 365 * 144);
    expect(r.byTier.base.endNeed).toBe(28);
    // Thin grand flow never mines (par-gated standby from slot 1).
    expect(r.byTier.grand.endBlocks).toBe(0);
    expect(r.byTier.grand.endNeed).toBe(0);
    // No room to spill (base capped): $3.1M thin flow unfilled.
    expect(r.spillUsd).toBeLessThan(100000);
    expect(r.unfilledD).toBeGreaterThan(3000000);
    // Idle token stays deployed (persists as dust).
    expect(r.tokensGrand).toBe(1);
  });

  test('rotation BANNED, roomy base: spill rescue at par (G6c)', () => {
    const r = runGrandSim({
      ...base,
      allowFreshClones: false,
      genesisBatons: { base: 112, grand: 1 },
    });
    expect(r.meanPremium).toBeLessThan(1.01);
    expect(r.meanPremium).toBeGreaterThan(0.99);
    expect(r.byTier.grand.endBlocks).toBe(0);
    // Thin $10 flow spills while small miners supply slack (~$2.7M);
    // late small-exclusion starves spill (cascade pinned: $0.3-0.5M).
    expect(r.spillUsd).toBeGreaterThan(2500000);
    expect(r.unfilledD).toBeGreaterThan(300000);
    expect(r.unfilledD).toBeLessThan(500000);
    expect(r.byTier.base.endNeed).toBe(90);
  });
});

describe('grand-econ collapse and invariants', () => {
  test('collapse idles the family, resumes at par (G5)', () => {
    const r = runGrandSim({
      slots: 30 * DAY,
      demandUsd: slot =>
        slot > 5 * DAY && slot <= 8 * DAY ? 0.001 : 100,
      whaleShare: () => 0.05,
      genesisBatons: { base: 1, grand: 1 },
      ...POPS,
    });
    // Base serves $100/slot ($95 native + $5 spilled whale flow), minus
    // 2 boundary gaps (1-slot spill info lag at start + resume).
    expect(r.blocksTotal).toBeGreaterThan(388700);
    expect(r.blocksTotal).toBeLessThanOrEqual(27 * DAY * 100);
    expect(r.meanPremium).toBeLessThan(1.01);
    expect(r.meanPremium).toBeGreaterThan(0.99);
    // Collapse dust $0.43 + 2 x $5 boundary gaps (1-slot spill info lag
    // at start + resume; real mempools leak demand early — v5 info).
    expect(r.unfilledD).toBeGreaterThan(10);
    expect(r.unfilledD).toBeLessThan(11);
  });

  test('conservation: issuanceBase = blocks x 100 x scale', () => {
    const r = runGrandSim({
      slots: 200,
      demandUsd: slot => (slot % 20 < 10 ? 300 : 40),
      whaleShare: slot => (slot % 40 < 20 ? 0.3 : 0.02),
      genesisBatons: { base: 1, grand: 1 },
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
      runGrandSim({
        slots: 200,
        demandUsd: slot => (slot % 20 < 10 ? 300 : 40),
        whaleShare: slot => (slot % 40 < 20 ? 0.3 : 0.02),
        genesisBatons: { base: 1, grand: 1 },
        ...POPS,
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
