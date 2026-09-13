/**
 * Single-shard δ v4 (ELOTUS — miner-paced slots, k>=1, one micro-step per
 * block) pure tests — jest-safe (no ecash-lib: the math module imports
 * only the pure twoShardMath, since jest cannot load ecash-lib's WASM).
 *
 * Covers: push encoders (incl. the sign byte on 14400000), the depth
 * simulator (green path + each rejection mode), the v3 policy (kept for
 * VLOTUS history), the v4 policy (deriveUdeltaV4: k=1/k=7 ok with the
 * SAME single step, k=0/negative rejected), WLDF v5 layout, and op-list
 * invariants (no MUL, exactly one CODESEPARATOR, no introspection, no
 * branch, exactly two GTEs). Consensus semantics (execution) are covered
 * by scripts/verify-singleshard-vm.ts (libauth XEC VM, offline).
 */
import {
  assemble,
  deriveUdeltaV3,
  deriveUdeltaV4,
  encodeNum,
  encodePush,
  OP,
  simulateUdeltaCode,
  udeltaCodeUnits,
  UDELTA_DENOMINATOR,
  UDELTA_ECON_LEN,
  UDELTA_HEAD_LEN,
  UDELTA_K,
  UDELTA_NUMERATOR,
  UDELTA_SLOT_SECONDS,
  wldfUdeltaPushdata,
  WLDF_VERSION_UDELTA_V4,
  WLDF_VERSION_UDELTA_V5,
  type AsmUnit,
} from '../src/covenant/singleShardDeltaMath.js';

describe('single-shard δ push encoders', () => {
  test('encodeNum minimal forms', () => {
    expect(encodeNum(0)).toEqual(new Uint8Array([OP.OP_0]));
    expect(encodeNum(1)).toEqual(new Uint8Array([OP.OP_1]));
    expect(encodeNum(16)).toEqual(new Uint8Array([OP.OP_16]));
    expect(encodeNum(40)).toEqual(new Uint8Array([0x01, 0x28]));
    expect(encodeNum(100000)).toEqual(new Uint8Array([0x03, 0xa0, 0x86, 0x01]));
    expect(() => encodeNum(-1)).toThrow();
  });

  test('encodeNum appends a sign byte when the high bit is set', () => {
    // v4 denominator 14400000 = 0xDBBA00 → LE 00 BA DB + 00 sign byte.
    expect([...encodeNum(14400000)]).toEqual([0x04, 0x00, 0xba, 0xdb, 0x00]);
  });

  test('encodePush sizes', () => {
    expect(encodePush(new Uint8Array([0x00]))).toEqual(
      new Uint8Array([0x01, 0x00]),
    );
    const b75 = encodePush(new Uint8Array(75));
    expect(b75[0]).toBe(75);
    const b76 = encodePush(new Uint8Array(76));
    expect([...b76.slice(0, 2)]).toEqual([OP.OP_PUSHDATA1, 76]);
    const b421 = encodePush(new Uint8Array(421));
    expect([...b421.slice(0, 3)]).toEqual([OP.OP_PUSHDATA2, 421 & 0xff, 1]);
    expect(() => encodePush(new Uint8Array(70000))).toThrow();
  });

  test('ALP version byte is a real 0x00 push, never bare OP_0', () => {
    // Genesis 1–3 lesson: bare 0x00 in the mint section silently drops the
    // ALP version byte. The op list must carry it as 1-byte data.
    const units = udeltaCodeUnits();
    const zeroPushes = units.filter(
      u => 'data' in u && u.data.length === 1 && u.data[0] === 0x00,
    );
    expect(zeroPushes.length).toBe(1);
  });
});

describe('single-shard δ layout constants', () => {
  test('econ/prefix/state geometry', () => {
    expect(UDELTA_ECON_LEN).toBe(83);
    expect(UDELTA_HEAD_LEN).toBe(83 + 33 + 9);
    expect(UDELTA_K).toBe(1);
    expect(UDELTA_NUMERATOR).toBe(82);
    expect(UDELTA_DENOMINATOR).toBe(14400000);
    expect(UDELTA_SLOT_SECONDS).toBe(600);
  });

  test('SUB-form micro-δ matches the covenant arithmetic (t − t·82/14400000)', () => {
    const t = 2 ** 24;
    expect(t - Math.floor((t * 82) / 14400000)).toBe(16777121);
  });
});

describe('single-shard δ depth simulator', () => {
  test('green path: 12 entry items → main=1/alt=0, within budget', () => {
    const sim = simulateUdeltaCode(udeltaCodeUnits(), 12);
    expect(sim.ops).toBeLessThanOrEqual(201);
    expect(sim.maxMain).toBeLessThan(100);
    expect(sim.maxAlt).toBeLessThan(100);
  });

  test('rejects out-of-range ROLL', () => {
    const bad: AsmUnit[] = [{ num: 5 }, { op: OP.OP_ROLL }];
    expect(() => simulateUdeltaCode(bad, 1)).toThrow(/out of range/);
  });

  test('rejects ROLL without a num push', () => {
    const bad: AsmUnit[] = [{ op: OP.OP_ROLL }];
    expect(() => simulateUdeltaCode(bad, 2)).toThrow(/num push/);
  });

  test('rejects main-stack underflow', () => {
    const bad: AsmUnit[] = [{ op: OP.OP_DROP }];
    expect(() => simulateUdeltaCode(bad, 0)).toThrow(/underflow/);
  });

  test('rejects divergent IF arms', () => {
    const bad: AsmUnit[] = [
      { num: 1 },
      { op: OP.OP_IF },
      { op: OP.OP_DROP },
      { op: OP.OP_ELSE },
      { op: OP.OP_DUP },
      { op: OP.OP_ENDIF },
    ];
    expect(() => simulateUdeltaCode(bad, 1)).toThrow(/diverge/);
  });

  test('rejects missing CODESEPARATOR', () => {
    const units = udeltaCodeUnits().filter(
      u => !('op' in u) || u.op !== OP.OP_CODESEPARATOR,
    );
    expect(() => simulateUdeltaCode(units, 12)).toThrow(/CODESEPARATOR/);
  });

  test('rejects wrong entry depth', () => {
    expect(() => simulateUdeltaCode(udeltaCodeUnits(), 11)).toThrow();
  });
});

describe('single-shard δ v3 policy (k==1-only)', () => {
  const genesis = {
    genesisUnix: 1_784_300_000,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
  };
  const tip = { tipDay: 0, target: 2 ** 24 };

  test('deriveUdeltaV3 accepts exactly k=1', () => {
    const d = deriveUdeltaV3(genesis, tip, 1_784_300_000 + 86_400);
    expect(d.steps).toBe(1);
    expect(d.newDay).toBe(1);
    expect(d.newTarget).toBe(16763459);
  });

  test('deriveUdeltaV3 rejects k=0 (same-day farming forbidden)', () => {
    expect(() => deriveUdeltaV3(genesis, tip, 1_784_300_000)).toThrow(/k=1/);
  });

  test('deriveUdeltaV3 rejects k=2 (no multi-day jumps)', () => {
    expect(() =>
      deriveUdeltaV3(genesis, tip, 1_784_300_000 + 2 * 86_400),
    ).toThrow(/k=1|stale baton/);
  });

  test('WLDF v4 pushdata layout (VLOTUS history)', () => {
    const w = wldfUdeltaPushdata(
      {
        newDay: 1,
        newTarget: 16763459,
        locktime: 1_784_300_000 + 86_400,
      },
      4,
    );
    expect(w.length).toBe(17);
    expect([...w.slice(0, 4)]).toEqual([0x57, 0x4c, 0x44, 0x46]);
    expect(w[4]).toBe(4);
    expect(WLDF_VERSION_UDELTA_V4).toBe(4);
  });
});

describe('single-shard δ v4 policy (miner-paced, k>=1)', () => {
  const genesis = {
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    genesisTarget: 2 ** 24,
  };
  const tip = { tipDay: 0, target: 2 ** 24 };

  test('deriveUdeltaV4 accepts k=1 with one micro-step', () => {
    const d = deriveUdeltaV4(genesis, tip, 1_784_300_000 + 600);
    expect(d.steps).toBe(1);
    expect(d.newDay).toBe(1);
    expect(d.newTarget).toBe(16777121);
  });

  test('deriveUdeltaV4 accepts k=7 with the SAME single step (one-step-per-block)', () => {
    const d = deriveUdeltaV4(genesis, tip, 1_784_300_000 + 7 * 600);
    expect(d.steps).toBe(7);
    expect(d.newDay).toBe(7);
    expect(d.newTarget).toBe(16777121);
  });

  test('deriveUdeltaV4 rejects k=0 (same-slot re-mine forbidden)', () => {
    expect(() => deriveUdeltaV4(genesis, tip, 1_784_300_000)).toThrow(/k>=1/);
  });

  test('deriveUdeltaV4 rejects negative k (past slots)', () => {
    expect(() =>
      deriveUdeltaV4(genesis, { tipDay: 5, target: 2 ** 24 }, 1_784_300_000),
    ).toThrow(/k>=1/);
  });

  test('WLDF v5 pushdata layout (v4 history intact)', () => {
    const w = wldfUdeltaPushdata(
      {
        newDay: 7,
        newTarget: 16777121,
        locktime: 1_784_300_000 + 7 * 600,
      },
      5,
    );
    expect(w.length).toBe(17);
    expect(w[4]).toBe(5);
    expect(WLDF_VERSION_UDELTA_V5).toBe(5);
    expect(WLDF_VERSION_UDELTA_V4).toBe(4);
    expect(() =>
      wldfUdeltaPushdata({ newDay: 1, newTarget: 1, locktime: 1 }, 9),
    ).toThrow(/unknown single-shard WLDF version/);
  });
});

describe('single-shard δ op-list invariants', () => {
  function scan(pred: (op: number) => boolean): number {
    let n = 0;
    for (const u of udeltaCodeUnits()) {
      if ('op' in u && pred(u.op)) n++;
    }
    return n;
  }

  test('no OP_MUL (consensus-disabled on eCash)', () => {
    expect(scan(op => op === OP.OP_MUL)).toBe(0);
  });

  test('exactly one CODESEPARATOR', () => {
    expect(scan(op => op === OP.OP_CODESEPARATOR)).toBe(1);
  });

  test('no introspection opcodes (BCH-only 0xc0–0xcd)', () => {
    expect(scan(op => op >= 0xc0 && op <= 0xcd)).toBe(0);
  });

  test('no branch at all (k>=1 floor needs no IF — stays deleted)', () => {
    expect(scan(op => op === OP.OP_IF)).toBe(0);
    expect(scan(op => op === OP.OP_ELSE)).toBe(0);
    expect(scan(op => op === OP.OP_ENDIF)).toBe(0);
  });

  test('exactly two GTEs (k-floor + PoW head>=0)', () => {
    expect(scan(op => op === OP.OP_GREATERTHANOREQUAL)).toBe(2);
  });

  test('ends with bare CHECKSIG (TRUE on top — no trailing VERIFY)', () => {
    const units = udeltaCodeUnits();
    const last = units[units.length - 1]!;
    expect('op' in last && last.op).toBe(OP.OP_CHECKSIG);
  });
});

describe('single-shard δ assembler', () => {
  test('assemble round-trips units to bytes', () => {
    const bytes = assemble([
      { num: 7 },
      { op: OP.OP_ROLL },
      { data: new Uint8Array([0xaa, 0xbb]) },
    ]);
    expect([...bytes]).toEqual([0x57, OP.OP_ROLL, 0x02, 0xaa, 0xbb]);
  });
});
