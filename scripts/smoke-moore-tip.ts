#!/usr/bin/env tsx
import {
  createPowRemintMooreTipContract,
  reconstructNextRedeem,
  MOORE_TIP_VALUE_OFFSET,
} from '../src/covenant/powRemintMooreTipScript.js';
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';

async function main(): Promise<void> {
  const tokenId =
    '243fbdee07ef94c2d3bb7d0447a485be0df8ec12a0a750fb3c9835dd8e82a89e';
  const genesis = 1_784_342_327;
  const c = await createPowRemintMooreTipContract({
    tokenId,
    mintAtoms: 1n,
    genesisUnix: genesis,
    baseZeroBits: 22,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: genesis,
  });
  const drops = (() => {
    const code = c.codeBytes;
    let i = code.length - 1;
    while (i >= 0 && code[i] === 0x77) i--;
    return code.length - 1 - i;
  })();
  console.log(
    JSON.stringify(
      {
        address: c.address,
        redeemLen: c.redeemScriptBuf.length,
        tipValueOffset: c.tipValueOffset,
        fixedOffset: MOORE_TIP_VALUE_OFFSET,
        codeLen: c.codeBytes.length,
        trailingDrops: drops,
        under520: c.redeemScriptBuf.length <= 520,
      },
      null,
      2,
    ),
  );
  const nextTip = genesis + 60;
  const next = reconstructNextRedeem(
    c.params,
    c.codeHash,
    c.codeBytes,
    nextTip,
  );
  const c2 = await createPowRemintMooreTipContract({
    ...c.params,
    tipLocktime: nextTip,
  });
  if (!next.equals(c2.redeemScriptBuf)) throw new Error('reconstruct mismatch');
  if (c.redeemScriptBuf.length > 520) {
    throw new Error(`redeem ${c.redeemScriptBuf.length} > 520`);
  }
  console.log('smoke ok');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
