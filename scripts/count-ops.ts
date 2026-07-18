#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { createPowRemintMooreTipContract } from '../src/covenant/powRemintMooreTipScript.js';
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';

/** Count non-push ops the way Bitcoin does: opcode > OP_16. */
function countOps(script: Buffer) {
  let ops = 0;
  let cats = 0;
  let splits = 0;
  let hashes = 0;
  let drops = 0;
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0x60) {
      ops++;
      if (op === 0x7e) cats++;
      if (op === 0x7f) splits++;
      if (op === 0xa8 || op === 0xa9 || op === 0xaa) hashes++;
      if (op === 0x77) drops++;
    }
    if (op > 0 && op < 0x4c) {
      i += 1 + op;
    } else if (op === 0x4c) {
      const n = script[i + 1]!;
      i += 2 + n;
    } else if (op === 0x4d) {
      const n = script[i + 1]! | (script[i + 2]! << 8);
      i += 3 + n;
    } else {
      i += 1;
    }
  }
  return { ops, cats, splits, hashes, drops, len: script.length };
}

async function main() {
  const tip = JSON.parse(
    readFileSync('deployments/mainnet-prayer-tip-test.json', 'utf8'),
  );
  console.log(
    'prayerTip redeem',
    countOps(Buffer.from(tip.redeemScriptHex, 'hex')),
  );

  const c = await createPowRemintMooreTipContract({
    tokenId: 'de6c61d6665a342aeb0e24983625ceb3a1b1d603b415eb67b03d61274f479a03',
    mintAtoms: 1n,
    genesisUnix: 1_784_343_925,
    baseZeroBits: 22,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: 1_784_343_925,
  });
  console.log('mooreTip code', countOps(c.codeBytes));
  console.log('mooreTip redeem', countOps(c.redeemScriptBuf));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
