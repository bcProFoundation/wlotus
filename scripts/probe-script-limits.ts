#!/usr/bin/env tsx
/**
 * Platform probe: 8-byte script-int arithmetic on libauth's XEC VM.
 *
 * Decides the v5 covenant implementation: single-int 64-bit math (if
 * ADD/SUB/DIV/LESSTHAN work on 8-byte numbers) vs 31-bit limb-wise
 * multi-precision (if 4-byte-capped). Also documents sign-bit behavior
 * (critical for hash limbs) and confirms OP_MUL stays disabled.
 *
 * Offline. Each probe is one bare-script input; failures are per-probe.
 *
 *   npx tsx scripts/probe-script-limits.ts
 */
import { randomBytes } from 'node:crypto';
import {
  createVirtualMachineXEC,
  encodeTransaction,
} from '@bitauth/libauth';

const OP = {
  AND: 0x84,
  EQUAL: 0x87,
  ADD: 0x93,
  SUB: 0x94,
  MUL: 0x95,
  DIV: 0x96,
  MOD: 0x97,
  LESSTHAN: 0x9f,
  NUM2BIN: 0x80,
  BIN2NUM: 0x81,
} as const;

/** Minimal script-number LE encoding (bigint, signed). */
function numEnc(v: bigint): Uint8Array {
  if (v === 0n) return new Uint8Array(0);
  const neg = v < 0n;
  let m = neg ? -v : v;
  const out: number[] = [];
  while (m > 0n) {
    out.push(Number(m & 0xffn));
    m >>= 8n;
  }
  if (out[out.length - 1]! & 0x80) out.push(neg ? 0x80 : 0x00);
  else if (neg) out[out.length - 1]! |= 0x80;
  return new Uint8Array(out);
}

/** Fixed-width LE bytes (unsigned, for hash-like pushes). */
function bytesLe(v: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let m = v;
  for (let i = 0; i < len; i++) {
    out[i] = Number(m & 0xffn);
    m >>= 8n;
  }
  return out;
}

function push(data: Uint8Array): number[] {
  if (data.length === 0) return [0x00];
  // Minimal push: OP_1..OP_16 for single bytes 0x01..0x10.
  if (data.length === 1 && data[0]! >= 0x01 && data[0]! <= 0x10)
    return [0x50 + data[0]!];
  if (data.length === 1 && data[0] === 0x81) return [0x01, 0x81]; // -1
  if (data.length <= 75) return [data.length, ...data];
  throw new Error('push too long for probe');
}

interface Probe {
  name: string;
  script: number[];
  /** 'pass' = script must succeed; 'disabled' = script must ERROR. */
  want: 'pass' | 'disabled';
}

const T56 = 2n ** 56n;
const K10 = 551469n; // exact 10.00%/yr DIV-δ constant
const MAX31 = 2n ** 31n - 1n;

const PROBES: Probe[] = [
  {
    name: 'BOUNDARY-4B ADD (2^31-1)+1 == 2^31 (5-byte result)',
    want: 'pass',
    script: [
      ...push(numEnc(MAX31)),
      ...push(numEnc(1n)),
      OP.ADD,
      ...push(numEnc(MAX31 + 1n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'BOUNDARY-5B ADD (2^31)+1 must ERROR (5-byte operand)',
    want: 'disabled',
    script: [
      ...push(numEnc(MAX31 + 1n)),
      ...push(numEnc(1n)),
      OP.ADD,
      ...push(numEnc(MAX31 + 2n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'SMALL-XOR 0xFF ^ 0x0F == 0xF0 (XOR availability)',
    want: 'pass',
    script: [
      ...push(numEnc(0xffn)),
      ...push(numEnc(0x0fn)),
      0x86,
      ...push(numEnc(0xf0n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'SMALL-MOD 7 % 3 == 1 (MOD availability)',
    want: 'pass',
    script: [
      ...push(numEnc(7n)),
      ...push(numEnc(3n)),
      OP.MOD,
      ...push(numEnc(1n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'ADD8 (2^56+1)+1 == 2^56+2',
    want: 'pass',
    script: [
      ...push(numEnc(T56 + 1n)),
      ...push(numEnc(1n)),
      OP.ADD,
      ...push(numEnc(T56 + 2n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'SUB8 (2^56+2)-2 == 2^56',
    want: 'pass',
    script: [
      ...push(numEnc(T56 + 2n)),
      ...push(numEnc(2n)),
      OP.SUB,
      ...push(numEnc(T56)),
      OP.EQUAL,
    ],
  },
  {
    name: 'DIV8 2^56 // 551469 (the v5 δ quotient)',
    want: 'pass',
    script: [
      ...push(numEnc(T56)),
      ...push(numEnc(K10)),
      OP.DIV,
      ...push(numEnc(T56 / K10)),
      OP.EQUAL,
    ],
  },
  {
    name: 'DIV8-exact 551469000 // 551469 == 1000',
    want: 'pass',
    script: [
      ...push(numEnc(K10 * 1000n)),
      ...push(numEnc(K10)),
      OP.DIV,
      ...push(numEnc(1000n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'LT8-true (2^56-1) < 2^56',
    want: 'pass',
    script: [
      ...push(numEnc(T56 - 1n)),
      ...push(numEnc(T56)),
      OP.LESSTHAN,
    ],
  },
  {
    name: 'LT8-false NOT(2^56 < 2^56-1)',
    want: 'pass',
    script: [
      ...push(numEnc(T56)),
      ...push(numEnc(T56 - 1n)),
      OP.LESSTHAN,
      ...push(numEnc(0n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'NEG-doc BIN2NUM(8xFF) < 0 (top bit = sign)',
    want: 'pass',
    script: [
      ...push(bytesLe((2n ** 64n - 1n) & ((2n ** 64n - 1n)), 8)),
      OP.BIN2NUM,
      ...push(numEnc(0n)),
      OP.LESSTHAN,
    ],
  },
  {
    name: 'N2B8 NUM2BIN(1,8) == 0100000000000000',
    want: 'pass',
    script: [
      ...push(numEnc(1n)),
      ...push(numEnc(8n)),
      OP.NUM2BIN,
      ...push(bytesLe(1n, 8)),
      OP.EQUAL,
    ],
  },
  {
    name: 'B2N8 BIN2NUM(8-byte 2^56+5) == number',
    want: 'pass',
    script: [
      ...push(bytesLe(T56 + 5n, 8)),
      OP.BIN2NUM,
      ...push(numEnc(T56 + 5n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'MOD8 (2^56+5) % 7 (availability only)',
    want: 'pass',
    script: [
      ...push(numEnc(T56 + 5n)),
      ...push(numEnc(7n)),
      OP.MOD,
      ...push(numEnc((T56 + 5n) % 7n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'MUL-disabled 2*3 must ERROR (else redesign!)',
    want: 'disabled',
    script: [
      ...push(numEnc(2n)),
      ...push(numEnc(3n)),
      OP.MUL,
      ...push(numEnc(6n)),
      OP.EQUAL,
    ],
  },
  {
    name: 'AND8 availability (limb-mask fallback)',
    want: 'pass',
    script: [
      ...push(bytesLe(2n ** 64n - 1n, 8)),
      ...push(bytesLe(0x0f0f0f0f0f0f0f0fn, 8)),
      OP.AND,
      ...push(bytesLe(0x0f0f0f0f0f0f0f0fn, 8)),
      OP.EQUAL,
    ],
  },
];

async function main(): Promise<void> {
  const vm = createVirtualMachineXEC() as unknown as {
    evaluate(p: unknown): { error?: string };
  };
  const inputs = PROBES.map(() => ({
    outpointTransactionHash: new Uint8Array(randomBytes(32)),
    outpointIndex: 0,
    unlockingBytecode: new Uint8Array(0),
    sequenceNumber: 0xffffffff,
  }));
  const tx = {
    version: 2,
    inputs,
    outputs: [
      { valueSatoshis: 1000n, lockingBytecode: new Uint8Array([0x51]) },
    ],
    locktime: 0,
  };
  const txBin = encodeTransaction(tx);
  // Re-decode through the same path the gates use (shape check).
  const { decodeTransaction, hexToBin, binToHex } = await import(
    '@bitauth/libauth'
  );
  const decoded = decodeTransaction(hexToBin(binToHex(txBin)));
  if (typeof decoded === 'string') throw new Error(decoded);

  let fails = 0;
  PROBES.forEach((probe, i) => {
    const sourceOutputs = PROBES.map((p, j) => ({
      lockingBytecode: new Uint8Array(
        j === i ? probe.script : [0x51],
      ),
      valueSatoshis: 1000n,
    }));
    const st = vm.evaluate({
      transaction: decoded,
      sourceOutputs,
      inputIndex: i,
    });
    const ok =
      probe.want === 'pass' ? st.error === undefined : st.error !== undefined;
    if (!ok) fails++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}: ${probe.name}` +
        (st.error !== undefined ? ` — ${st.error.slice(0, 120)}` : ''),
    );
  });
  if (fails > 0) {
    console.error(`${fails}/${PROBES.length} probes failed`);
    process.exit(1);
  }
  console.log(`ALL ${PROBES.length} PROBES GREEN`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
