/**
 * Pacing-econ simulator tests — pure, seeded, deterministic.
 */
import {
  expectedAttempts,
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
    expect(feeUsd(1750, 0.03)).toBeCloseTo(0.525, 10);
    expect(feeUsd(1750, 0.12)).toBeCloseTo(2.1, 10);
  });

  test('expectedAttempts scales inversely with target', () => {
    expect(expectedAttempts(2 ** 24)).toBe(128);
    expect(expectedAttempts(2 ** 23)).toBe(256);
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
  const trio = [
    { strategy: 'backfill' as const, costMult: 1 },
    { strategy: 'jump' as const, costMult: 1 },
    { strategy: 'threshold' as const, costMult: 1 },
  ];

  test('profitable constant reward fills every slot, destroys nothing', () => {
    const r = runSim({
      slots: 5,
      rewardUsd: () => 100,
      xecUsd: () => 0.03,
      miners: trio,
      seed: 3,
    });
    expect(r.blocks).toBe(5);
    expect(r.filled).toBe(5);
    expect(r.destroyed).toBe(0);
    expect(r.utilization).toBe(1);
    expect(r.issuance).toBe(500);
    expect(r.idleSlots).toBe(0);
  });

  test('reward below cost idles every slot, backlog grows', () => {
    const r = runSim({
      slots: 5,
      rewardUsd: () => 0.01,
      xecUsd: () => 0.03,
      miners: trio,
      seed: 3,
    });
    expect(r.blocks).toBe(0);
    expect(r.idleSlots).toBe(5);
    expect(r.maxBacklog).toBe(5);
    expect(r.utilization).toBe(0);
  });

  test('entry obeys the R - F.mult > o boundary exactly', () => {
    const mk = (reward: number) =>
      runSim({
        slots: 1,
        rewardUsd: () => reward,
        xecUsd: () => 0.03,
        miners: [{ strategy: 'backfill', costMult: 1 }],
        opportunityUsd: 0.1,
        seed: 3,
      });
    // F = 0.525: 0.63-0.525=0.105>0.1 enters; 0.62-0.525=0.095 idles.
    expect(mk(0.63).blocks).toBe(1);
    expect(mk(0.62).blocks).toBe(0);
  });

  test('conservation: filled + destroyed + backlog = elapsed; steps = blocks', () => {
    const r = runSim({
      slots: 9,
      rewardUsd: slot => (slot <= 4 ? 0.01 : 100),
      xecUsd: () => 0.03,
      miners: trio,
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
        rewardUsd: slot => (slot % 20 < 10 ? 100 : 0.01),
        xecUsd: () => 0.03,
        miners: trio,
        seed: 42,
      });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  });
});
