#!/usr/bin/env tsx
/** Smoke: compile MooreTipTemple and report redeem size / op count. */
import { readFileSync } from 'node:fs';
import { Spedn } from '@spedn/sdk';
import { ModuleFactory } from '@spedn/rts';
import { BchJsRts } from '@spedn/rts-bchjs';
import { fromHexRev } from 'ecash-lib';

function countOps(script: Buffer) {
  let ops = 0;
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0x60) ops++;
    if (op > 0 && op < 0x4c) i += 1 + op;
    else if (op === 0x4c) {
      const n = script[i + 1]!;
      i += 2 + n;
    } else if (op === 0x4d) {
      const n = script[i + 1]! | (script[i + 2]! << 8);
      i += 3 + n;
    } else i += 1;
  }
  return ops;
}

function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

async function main() {
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      'contracts/WlotusPowRemintMooreTipTemple.spedn',
      'utf8',
    );
    const portable = await spedn.compileCode('xec', code);
    const factory = new ModuleFactory(new BchJsRts('mainnet'));
    const Ctor = factory.make(portable).WlotusPowRemintMooreTipTemple;
    const z = Buffer.alloc(32, 0);
    const templeScriptHash = Buffer.alloc(20, 0x11);
    const inst = new Ctor({
      tokenIdRev: Buffer.from(
        fromHexRev(
          'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
        ),
      ),
      templeScriptHash,
      genesisUnixLe: u32(1000),
      baseZeroBitsBin: Buffer.from([24]),
      secondsPerExtraBitLe: u32(72576000),
      codeHash: z,
      prefixHash: z,
      tipLocktimeLe: u32(1000),
    });
    const redeem = Buffer.from(inst.redeemScript as Buffer);
    const ops = countOps(redeem);
    console.log(
      JSON.stringify(
        {
          redeemLen: redeem.length,
          ops,
          under201: ops <= 201,
          under520: redeem.length <= 520,
          headroomOps: 201 - ops,
          headroomBytes: 520 - redeem.length,
        },
        null,
        2,
      ),
    );
    if (ops > 201) throw new Error(`ops ${ops} > 201`);
    if (redeem.length > 520) throw new Error(`redeem ${redeem.length} > 520`);
    console.log('smoke ok');
  } finally {
    spedn.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
