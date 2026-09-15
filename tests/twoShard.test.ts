import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveTwoShardState,
  TWO_SHARD_K,
  twoShardAfterSteps,
  twoShardStep,
  wldfTwoShardPushdata,
  WLDF_VERSION_TWOSHARD,
} from '../src/covenant/twoShardMath.js';
import { mooreAfterDays } from '../src/lib/moore.js';

const GENESIS = 1_784_300_000;
const DAY = 86_400;
const T0 = 2 ** 24; // 16777216

describe('two-shard SUB-form δ math (off-chain)', () => {
  it('one step: 16777216 → 16763459', () => {
    // 16777216·82 = 1375731712; floor(/100000) = 13757; 16777216−13757.
    expect(twoShardStep(16777216n)).toBe(16763459n);
  });

  it('SUB form differs from MUL form (mooreAfterDays) by exactly 1', () => {
    // (t·82) mod 100000 = 31712 ≠ 0, so the forms disagree by one unit.
    // Both sides of the covenant use SUB form — this pins the difference.
    const sub = twoShardAfterSteps(1, BigInt(T0));
    const mul = mooreAfterDays(1, BigInt(T0));
    expect(sub).toBe(16763459n);
    expect(mul).toBe(16763458n);
    expect(sub - mul).toBe(1n);
  });

  it('derives k=0 same-day (no-op step)', () => {
    const d = deriveTwoShardState(
      { genesisUnix: GENESIS, daySeconds: DAY, genesisTarget: T0 },
      { tipDay: 0, target: T0 },
      GENESIS + 3600,
    );
    expect(d).toMatchObject({
      newDay: 0,
      steps: 0,
      newTarget: T0,
    });
  });

  it('derives k=1 next-day', () => {
    const d = deriveTwoShardState(
      { genesisUnix: GENESIS, daySeconds: DAY, genesisTarget: T0 },
      { tipDay: 0, target: T0 },
      GENESIS + DAY,
    );
    expect(d).toMatchObject({
      newDay: 1,
      steps: 1,
      newTarget: 16763459,
    });
  });

  it(`rejects k=2 stale batons (K=${TWO_SHARD_K})`, () => {
    expect(TWO_SHARD_K).toBe(1);
    expect(() =>
      deriveTwoShardState(
        { genesisUnix: GENESIS, daySeconds: DAY, genesisTarget: T0 },
        { tipDay: 0, target: T0 },
        GENESIS + 2 * DAY,
      ),
    ).toThrow(/stale baton/);
  });

  it('rejects locktime rewinds', () => {
    expect(() =>
      deriveTwoShardState(
        { genesisUnix: GENESIS, daySeconds: DAY, genesisTarget: T0 },
        { tipDay: 1, target: 16763459 },
        GENESIS,
      ),
    ).toThrow(/rewind/);
  });
});

describe('two-shard WLDF v3 pushdata', () => {
  it('is 17B with version 0x03', () => {
    const push = wldfTwoShardPushdata({
      newDay: 1,
      newTarget: 16763459,
      locktime: GENESIS + DAY,
    });
    expect(push.length).toBe(17);
    expect(Buffer.from(push.subarray(0, 4)).toString()).toBe('WLDF');
    expect(push[4]).toBe(WLDF_VERSION_TWOSHARD);
    expect(push[4]).toBe(0x03);
    expect(Buffer.from(push.subarray(5, 9)).readUInt32LE(0)).toBe(1);
    expect(Buffer.from(push.subarray(9, 13)).readUInt32LE(0)).toBe(16763459);
  });
});

describe('two-shard covenant sources', () => {
  const src = (f: string): string =>
    readFileSync(resolve(process.cwd(), `contracts/${f}`), 'utf8');

  it('C and M build byte-identical output blocks', () => {
    // Guards copy drift: the cross-shard soundness argument requires
    // both shards to pin the same out0..out3 bytes. The span covers the
    // wldf/mint/opReturn/out0..out3 construction only — separator and
    // pin placement legitimately differ (C separates late for a small
    // scriptCode, M separates after the pin).
    const span = (s: string): string => {
      const a = s.indexOf('[byte] wldf =');
      const b = s.indexOf('[byte] out3 =');
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(a);
      const end = s.indexOf(';', b);
      expect(end).toBeGreaterThan(b);
      return s.slice(a, end + 1);
    };
    expect(span(src('GlotusMintShard.spedn'))).toBe(
      span(src('GlotusComputeShard.spedn')),
    );
  });

  it('no bare 0x00 data literal (genesis 1–3 postmortem)', () => {
    // Spedn compiles a bare 0x00 to OP_0 (EMPTY push), silently dropping
    // the byte. The ALP version byte must use num2bin(0, 1) (live ergon
    // form); 0x01–0x04 are safe (OP_1..OP_4 push their byte). This test
    // fails loudly if anyone reintroduces a bare zero literal.
    for (const f of ['GlotusComputeShard.spedn', 'GlotusMintShard.spedn']) {
      const lines = src(f).split('\n');
      const bareZero = lines.filter(l => /^\s*0x00\s*\./.test(l));
      expect(bareZero).toEqual([]);
      expect(src(f)).toContain('num2bin(0, 1)');
    }
  });

  it('no introspection opcodes in shard sources', () => {
    // eCash never activated 0xc0–0xcd (BCH-only). The shards must be
    // pure pre-introspection Spedn; sibling binding is co-pinned outputs
    // + ALP batons + M window/cap (see contract headers). Scans code
    // lines only (headers document the 0xc0–0xcd absence in prose).
    for (const f of ['GlotusComputeShard.spedn', 'GlotusMintShard.spedn']) {
      const code = src(f)
        .split('\n')
        .filter(l => !l.trim().startsWith('//'))
        .join('\n');
      expect(code).not.toMatch(/0xc[0-9a-d]/i);
    }
  });

  it('C step-cap literal matches TS TWO_SHARD_K', () => {
    expect(src('GlotusComputeShard.spedn')).toContain(
      `verify k <= ${TWO_SHARD_K};`,
    );
  });

  it('no OP_MUL-able operator in shard sources', () => {
    // Belt-and-braces with the compile gate: the δ step must stay
    // explicit double-and-add. (Single `*` would need OP_MUL.)
    for (const f of ['GlotusComputeShard.spedn', 'GlotusMintShard.spedn']) {
      const lines = src(f).split('\n');
      const hits = lines.filter(
        l =>
          l.includes('*') &&
          !l.trim().startsWith('//') &&
          !l.includes('[byte') &&
          !l.includes('[byte;'),
      );
      expect(hits).toEqual([]);
    }
  });
});
