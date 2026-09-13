/**
 * Single-shard δ (ULOTUS) pure tests — jest-safe (no ecash-lib: the math
 * module imports nothing, since jest cannot load ecash-lib's WASM glue).
 *
 * Covers: push encoders, the depth simulator (green path + each rejection
 * mode), and op-list invariants (no MUL, exactly one CODESEPARATOR, no
 * introspection, IF-arm convergence). Consensus semantics (execution) are
 * covered by scripts/verify-singleshard-vm.ts (libauth XEC VM, offline).
 */
import {
  assemble,
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
    expect(UDELTA_DENOMINATOR).toBe(100000);
  });

  test('SUB-form δ matches the covenant arithmetic (t − t·82/100000)', () => {
    const t = 2 ** 24;
    expect(t - Math.floor((t * 82) / 100000)).toBe(16763459);
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

  test('single IF/ELSE/ENDIF (simulator supports no nesting)', () => {
    expect(scan(op => op === OP.OP_IF)).toBe(1);
    expect(scan(op => op === OP.OP_ELSE)).toBe(1);
    expect(scan(op => op === OP.OP_ENDIF)).toBe(1);
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
