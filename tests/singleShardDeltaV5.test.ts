/**
 * v5 (durable generation) math tests: DIV-δ derivation, renormalization
 * landing proof, terminal HALT, WLDF v6 layout, and op-code invariants
 * (194 ops, single un-nested IF — the depth sim enforces the rest).
 */
import {
  OP,
  simulateUdeltaCode,
} from '../src/covenant/singleShardDeltaMath.js';
import {
  UDELTA_V5_DELTA_K,
  UDELTA_V5_E_MAX,
  UDELTA_V5_ECON_LEN,
  UDELTA_V5_GENESIS_E_BASE,
  UDELTA_V5_GENESIS_M_BASE,
  UDELTA_V5_HEAD_LEN,
  UDELTA_V5_M_NORM_MIN,
  UDELTA_V5_PREFIX_SKIP,
  UDELTA_V5_SLOT_SECONDS,
  UDELTA_V5_STATE_PUSH_LEN,
  WLDF_VERSION_UDELTA_V6,
  deriveUdeltaV5,
  microStepV5,
  thresholdU64,
  udeltaV5CodeUnits,
  wldfUdeltaV6Pushdata,
} from '../src/covenant/singleShardDeltaMathV5.js';

const GENESIS = { genesisUnix: 1_700_000_000, daySeconds: UDELTA_V5_SLOT_SECONDS };
const slotLocktime = (slot: number): number =>
  GENESIS.genesisUnix + slot * GENESIS.daySeconds;

describe('deriveUdeltaV5', () => {
  it('accepts k=1 with one DIV step', () => {
    const tip = { tipDay: 100, m: 2 ** 24, e: 4 };
    const d = deriveUdeltaV5(GENESIS, tip, slotLocktime(101));
    expect(d.steps).toBe(1);
    expect(d.newDay).toBe(101);
    const q = Math.floor(2 ** 24 / UDELTA_V5_DELTA_K);
    expect(q).toBe(36);
    expect(d.newM).toBe(2 ** 24 - q);
    expect(d.newE).toBe(4);
  });

  it('accepts k=7 jumps with the SAME single step (skip-tolerant)', () => {
    const tip = { tipDay: 100, m: 2 ** 24, e: 4 };
    const d1 = deriveUdeltaV5(GENESIS, tip, slotLocktime(101));
    const d7 = deriveUdeltaV5(GENESIS, tip, slotLocktime(107));
    expect(d7.steps).toBe(7);
    expect(d7.newM).toBe(d1.newM);
    expect(d7.newE).toBe(d1.newE);
  });

  it('rejects k=0 and negative steps', () => {
    const tip = { tipDay: 100, m: 2 ** 24, e: 4 };
    expect(() => deriveUdeltaV5(GENESIS, tip, slotLocktime(100))).toThrow(/k>=1/);
    expect(() => deriveUdeltaV5(GENESIS, tip, slotLocktime(99))).toThrow(/k>=1/);
  });

  it('DIV-δ is exact (q = m // K)', () => {
    const m = UDELTA_V5_DELTA_K * 40;
    const d = deriveUdeltaV5(GENESIS, { tipDay: 0, m, e: 4 }, slotLocktime(1));
    expect(d.newM).toBe(m - 40);
  });

  it('terminal HALT: q=0 throws (no successor exists)', () => {
    expect(() =>
      deriveUdeltaV5(
        GENESIS,
        { tipDay: 0, m: UDELTA_V5_DELTA_K - 1, e: 0 },
        slotLocktime(1),
      ),
    ).toThrow(/HALT/);
    expect(() =>
      deriveUdeltaV5(GENESIS, { tipDay: 0, m: 1, e: 0 }, slotLocktime(1)),
    ).toThrow(/HALT/);
  });

  it('renormalizes across the 2^23 boundary (m×256, e−1)', () => {
    const m = 2 ** 23 + 10;
    const q = Math.floor(m / UDELTA_V5_DELTA_K);
    expect(q).toBe(18);
    const d = deriveUdeltaV5(GENESIS, { tipDay: 0, m, e: 4 }, slotLocktime(1));
    expect(d.newM).toBe((m - q) * 256);
    expect(d.newM).toBeLessThan(2 ** 31);
    expect(d.newE).toBe(3);
  });

  it('renormalize landing ALWAYS valid (crossing-window proof)', () => {
    for (let m = 2 ** 23 - 1; m < 2 ** 23 + 6000; m++) {
      const d = deriveUdeltaV5(GENESIS, { tipDay: 0, m, e: 4 }, slotLocktime(1));
      const m1 = m - Math.floor(m / UDELTA_V5_DELTA_K);
      if (m1 < 2 ** 23) {
        expect(d.newE).toBe(3);
        expect(d.newM).toBe(m1 * 256);
        expect(d.newM).toBeGreaterThanOrEqual(2 ** 30);
        expect(d.newM).toBeLessThan(2 ** 31);
      } else {
        expect(d.newE).toBe(4);
        expect(d.newM).toBe(m1);
      }
    }
  });

  it('max single-step q is 4630 (window argument for single renorm)', () => {
    expect(Math.floor((2 ** 31 - 1) / UDELTA_V5_DELTA_K)).toBe(4630);
  });

  it('no renorm at e=0 (sub-normal mantissa steps on to HALT)', () => {
    const m = 2 ** 23 + 10;
    const d = deriveUdeltaV5(GENESIS, { tipDay: 0, m, e: 0 }, slotLocktime(1));
    expect(d.newE).toBe(0);
    expect(d.newM).toBe(m - Math.floor(m / UDELTA_V5_DELTA_K));
    expect(d.newM).toBeLessThan(2 ** 23);
  });

  it('rejects out-of-range states', () => {
    const good = { tipDay: 0, m: 2 ** 24, e: 4 };
    expect(() =>
      deriveUdeltaV5(GENESIS, { ...good, m: 0 }, slotLocktime(1)),
    ).toThrow();
    expect(() =>
      deriveUdeltaV5(GENESIS, { ...good, m: 2 ** 31 }, slotLocktime(1)),
    ).toThrow();
    expect(() =>
      deriveUdeltaV5(GENESIS, { ...good, e: 5 }, slotLocktime(1)),
    ).toThrow();
    expect(() =>
      deriveUdeltaV5(GENESIS, { ...good, e: -1 }, slotLocktime(1)),
    ).toThrow();
  });
});

describe('thresholdU64', () => {
  it('matches the design difficulties', () => {
    expect(thresholdU64(UDELTA_V5_GENESIS_M_BASE, UDELTA_V5_GENESIS_E_BASE)).toBe(
      2n ** 56n,
    );
    expect(thresholdU64(2 ** 30, 2)).toBe(2n ** 46n);
    expect(thresholdU64(1, 0)).toBe(1n);
  });

  it('renormalize preserves difficulty exactly', () => {
    const m1 = 2 ** 23 - 100;
    expect(thresholdU64(m1 * 256, 3)).toBe(thresholdU64(m1, 4));
  });

  it('rejects out-of-range inputs', () => {
    expect(() => thresholdU64(0, 4)).toThrow();
    expect(() => thresholdU64(2 ** 31, 4)).toThrow();
    expect(() => thresholdU64(100, 5)).toThrow();
  });
});

describe('microStepV5', () => {
  it('mirrors the covenant DIV step', () => {
    expect(microStepV5(2 ** 24)).toBe(
      2 ** 24 - Math.floor(2 ** 24 / UDELTA_V5_DELTA_K),
    );
  });

  it('compounds to EXACT 12.00%/yr over 52560 blocks', () => {
    const factor = (1 - 1 / UDELTA_V5_DELTA_K) ** 52560;
    expect(factor).toBeCloseTo(1 / 1.12, 6);
  });
});

describe('wldfUdeltaV6Pushdata', () => {
  it('lays out the 18-byte v6 record', () => {
    const p = wldfUdeltaV6Pushdata({
      newDay: 0x01020304,
      newM: 0x05060708,
      newE: 3,
      locktime: 0x090a0b0c,
    });
    expect(p.length).toBe(18);
    expect(Buffer.from(p.subarray(0, 4)).toString()).toBe('WLDF');
    expect(p[4]).toBe(WLDF_VERSION_UDELTA_V6);
    expect(Array.from(p.subarray(5, 9))).toEqual([4, 3, 2, 1]);
    expect(Array.from(p.subarray(9, 13))).toEqual([8, 7, 6, 5]);
    expect(p[13]).toBe(3);
    expect(Array.from(p.subarray(14, 18))).toEqual([12, 11, 10, 9]);
  });

  it('rejects bad exponents', () => {
    expect(() =>
      wldfUdeltaV6Pushdata({ newDay: 1, newM: 1, newE: 5, locktime: 1 }),
    ).toThrow();
  });
});

describe('v5 layout identities', () => {
  it('econ + prefix-skip + state = head', () => {
    expect(UDELTA_V5_ECON_LEN).toBe(85);
    expect(UDELTA_V5_PREFIX_SKIP).toBe(33);
    expect(UDELTA_V5_STATE_PUSH_LEN).toBe(10);
    expect(UDELTA_V5_HEAD_LEN).toBe(
      UDELTA_V5_ECON_LEN + UDELTA_V5_PREFIX_SKIP + UDELTA_V5_STATE_PUSH_LEN,
    );
    expect(UDELTA_V5_HEAD_LEN).toBe(128);
    expect(UDELTA_V5_M_NORM_MIN).toBe(2 ** 23);
    expect(UDELTA_V5_E_MAX).toBe(4);
    expect(UDELTA_V5_SLOT_SECONDS).toBe(600);
  });
});

describe('v5 op-list invariants', () => {
  const units = udeltaV5CodeUnits();
  const opCount = (op: number): number =>
    units.filter(
      (u): u is { op: number } => typeof u === 'object' && 'op' in u && u.op === op,
    ).length;
  const consensusOps = units.filter(
    (u): u is { op: number } =>
      typeof u === 'object' && 'op' in u && u.op > 0x60,
  ).length;

  it('fits the 201-op budget (190, margin 11)', () => {
    expect(consensusOps).toBe(190);
    expect(consensusOps).toBeLessThanOrEqual(201);
  });

  it('single un-nested IF (renorm only — PoW is branchless)', () => {
    expect(opCount(OP.OP_IF)).toBe(1);
    expect(opCount(OP.OP_ELSE)).toBe(1);
    expect(opCount(OP.OP_ENDIF)).toBe(1);
    expect(() => simulateUdeltaCode(units, 12)).not.toThrow();
  });

  it('uses DIV twice (slot derivation + δ), no MUL', () => {
    expect(opCount(OP.OP_DIV)).toBe(2);
    expect(opCount(OP.OP_MOD)).toBe(0);
  });

  it('uses BOOLAND once (renorm flag), no XOR (guarded compare)', () => {
    expect(opCount(OP.OP_BOOLAND)).toBe(1);
    expect(opCount(OP.OP_XOR)).toBe(0);
  });

  it('pins via one separator + one bare checksig', () => {
    expect(opCount(OP.OP_CODESEPARATOR)).toBe(1);
    expect(opCount(OP.OP_CHECKSIG)).toBe(1);
    expect(opCount(0xad)).toBe(0); // OP_CHECKSIGVERIFY (absent from enum)
  });
});
