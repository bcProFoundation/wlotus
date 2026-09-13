/**
 * Pacing-econ simulator tests — pure, seeded, deterministic.
 */
import {
  energyPerEntrant,
  feeUsd,
  microStep,
  mulberry32,
  runSim,
  strategyTarget,
} from '../src/sim/pacingEcon.js';

describe('pacing-econ kernels', () => {
  test('microStep matches the covenant SUB form (q=95 at genesis)', () => {
    expect(microStep(2 ** 24)).toBe(16777121);
  });

  test('feeUsd converts sats via XEC price (100 sats/XEC)', () => {
    // Real XEC ~$7e-6 (Sep 2026): single-shard remint fee ≈ $0.00012.
    expect(feeUsd(1750, 0.000007)).toBeCloseTo(0.0001225, 10);
  });

  test('energyPerEntrant derives Wc0 from share, scales with 1/target', () => {
    // share=30%, o=$0.005 → Wc0 = 0.3*0.005/0.7 ≈ $0.00214.
    expect(energyPerEntrant(0.3, 0.005, 2 ** 24, 2 ** 24)).toBeCloseTo(
      0.002142857,
      9,
    );
    expect(energyPerEntrant(0.3, 0.005, 2 ** 24, 2 ** 23)).toBeCloseTo(
      0.004285714,
      9,
    );
  });

  test('strategyTarget routes backfill/jump/threshold', () => {
    expect(strategyTarget('backfill', 5, 20, 12)).toBe(6);
    expect(strategyTarget('jump', 5, 20, 12)).toBe(20);
    expect(strategyTarget('threshold', 5, 20, 12)).toBe(20);
    expect(strategyTarget('threshold', 15, 20, 12)).toBe(16);
  });

  test('mulberry32 is deterministic per seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('pacing-econ runSim', () => {
  const trio = { backfill: 1, jump: 1, threshold: 1 };

  test('profitable constant demand fills every slot, destroys nothing', () => {
    const r = runSim({
      slots: 5,
      demandUsd: () => 100,
      xecUsd: () => 0.000007,
      population: trio,
      seed: 3,
    });
    expect(r.blocks).toBe(5);
    expect(r.filled).toBe(5);
    expect(r.destroyed).toBe(0);
    expect(r.utilization).toBe(1);
    expect(r.issuance).toBe(500);
    expect(r.idleSlots).toBe(0);
  });

  test('demand below Wc+o idles every slot, backlog grows', () => {
    const r = runSim({
      slots: 5,
      demandUsd: () => 0.001,
      xecUsd: () => 0.000007,
      population: trio,
      seed: 3,
    });
    expect(r.blocks).toBe(0);
    expect(r.idleSlots).toBe(5);
    expect(r.maxBacklog).toBe(5);
    expect(r.utilization).toBe(0);
  });

  test('entry obeys the M*=(D-F)/(Wc+o) boundary exactly', () => {
    const mk = (demand: number) =>
      runSim({
        slots: 1,
        demandUsd: () => demand,
        xecUsd: () => 0.000007,
        population: { backfill: 1, jump: 0, threshold: 0 },
        energyShare: 0.3,
        opportunityUsd: 0.005,
        seed: 3,
      });
    // F ≈ 0.0001225, Wc+o ≈ 0.007142857: D=0.0073 → M*=1 mines;
    // D=0.0072 → M*=0 idles.
    expect(mk(0.0073).blocks).toBe(1);
    expect(mk(0.0072).blocks).toBe(0);
  });

  test('premium tracks trade-price/design: 1x anchored, 100x over-cap', () => {
    const mk = (demand: number) =>
      runSim({
        slots: 3,
        demandUsd: () => demand,
        xecUsd: () => 0.000007,
        population: trio,
        designUsd: 1,
        seed: 3,
      });
    const anchored = mk(1);
    expect(anchored.meanPremium).toBeCloseTo(1, 10);
    expect(anchored.maxPremium).toBeCloseTo(1, 10);
    const overCap = mk(100);
    expect(overCap.meanPremium).toBeCloseTo(100, 10);
    expect(overCap.maxPremium).toBeCloseTo(100, 10);
  });

  test('conservation: filled + destroyed = elapsed; steps = blocks', () => {
    const r = runSim({
      slots: 9,
      demandUsd: slot => (slot <= 4 ? 0.001 : 100),
      xecUsd: () => 0.000007,
      population: trio,
      seed: 11,
    });
    // Bust slots 1-4 idle (backlog 4), recovery from slot 5; tip catches
    // up within the round budget regardless of who wins each race.
    expect(r.filled + r.destroyed).toBe(9);
    expect(r.utilization).toBe(r.filled / 9);
    let t = 2 ** 24;
    for (let i = 0; i < r.blocks; i++) t = microStep(t);
    expect(r.finalTarget).toBe(t);
  });

  test('same seed reproduces the identical trajectory', () => {
    const mk = () =>
      runSim({
        slots: 60,
        demandUsd: slot => (slot % 20 < 10 ? 100 : 0.001),
        xecUsd: () => 0.000007,
        population: trio,
        seed: 42,
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
