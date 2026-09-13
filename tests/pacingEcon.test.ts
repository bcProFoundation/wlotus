/**
 * Pacing-econ simulator tests — pure, seeded, deterministic.
 */
import {
  energyPerBlock,
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

  test('energyPerBlock scales with 1/target (physics)', () => {
    expect(energyPerBlock(0.3, 2 ** 24, 2 ** 24)).toBeCloseTo(0.3, 10);
    expect(energyPerBlock(0.3, 2 ** 24, 2 ** 23)).toBeCloseTo(0.6, 10);
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

  test('profitable constant reward fills every slot, destroys nothing', () => {
    const r = runSim({
      slots: 5,
      rewardUsd: () => 100,
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

  test('reward below energy+fee idles every slot, backlog grows', () => {
    const r = runSim({
      slots: 5,
      rewardUsd: () => 0.001,
      xecUsd: () => 0.000007,
      population: trio,
      seed: 3,
    });
    expect(r.blocks).toBe(0);
    expect(r.idleSlots).toBe(5);
    expect(r.maxBacklog).toBe(5);
    expect(r.utilization).toBe(0);
  });

  test('entry obeys the M*=(R-F-E)/o boundary exactly', () => {
    const mk = (reward: number) =>
      runSim({
        slots: 1,
        rewardUsd: () => reward,
        xecUsd: () => 0.000007,
        population: { backfill: 1, jump: 0, threshold: 0 },
        energy0Usd: 0.3,
        opportunityUsd: 0.005,
        seed: 3,
      });
    // F ≈ 0.0001225, E = 0.30: (0.31-F-E)/0.005 = 1.97 → M*=1 mines;
    // (0.304-F-E)/0.005 = 0.77 → M*=0 idles.
    expect(mk(0.31).blocks).toBe(1);
    expect(mk(0.304).blocks).toBe(0);
  });

  test('conservation: filled + destroyed = elapsed; steps = blocks', () => {
    const r = runSim({
      slots: 9,
      rewardUsd: slot => (slot <= 4 ? 0.001 : 100),
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
        rewardUsd: slot => (slot % 20 < 10 ? 100 : 0.001),
        xecUsd: () => 0.000007,
        population: trio,
        seed: 42,
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
