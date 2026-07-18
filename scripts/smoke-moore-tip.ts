#!/usr/bin/env tsx
import {
  createPowRemintMooreTipContract,
  reconstructNextRedeem,
  MOORE_TIP_VALUE_OFFSET,
} from '../src/covenant/powRemintMooreTipScript.js';
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';

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

async function main(): Promise<void> {
  const c = await createPowRemintMooreTipContract({
    tokenId: 'de6c61d6665a342aeb0e24983625ceb3a1b1d603b415eb67b03d61274f479a03',
    mintAtoms: 1n,
    genesisUnix: 1_784_343_925,
    baseZeroBits: 24,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: 1_784_343_925,
  });
  const ops = countOps(c.codeBytes);
  console.log(
    JSON.stringify(
      {
        redeemLen: c.redeemScriptBuf.length,
        codeLen: c.codeBytes.length,
        tipValueOffset: c.tipValueOffset,
        nonPushOps: ops,
        under201: ops <= 201,
        under520: c.redeemScriptBuf.length <= 520,
      },
      null,
      2,
    ),
  );
  const nextTip = c.params.tipLocktime + 60;
  const next = reconstructNextRedeem(
    c.params,
    c.codeHash,
    c.prefixHash,
    c.codeBytes,
    nextTip,
  );
  const c2 = await createPowRemintMooreTipContract({
    ...c.params,
    tipLocktime: nextTip,
  });
  if (!next.equals(c2.redeemScriptBuf)) throw new Error('reconstruct mismatch');
  if (c.tipValueOffset !== MOORE_TIP_VALUE_OFFSET) {
    throw new Error('tip offset drift');
  }
  if (c.redeemScriptBuf.length > 520) {
    throw new Error(`redeem ${c.redeemScriptBuf.length} > 520`);
  }
  if (ops > 201) throw new Error(`ops ${ops} > 201`);
  console.log('smoke ok');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
