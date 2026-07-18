#!/usr/bin/env tsx
import {
  createPowRemintMooreTipContract,
  reconstructNextRedeem,
  MOORE_TIP_VALUE_OFFSET,
} from '../src/covenant/powRemintMooreTipScript.js';
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';

async function main(): Promise<void> {
  const c = await createPowRemintMooreTipContract({
    tokenId: 'f6d21bc68dc36b132a76868f5a0485a1db800efbc3def64ec1b5e1c418c19d46',
    mintAtoms: 1n,
    genesisUnix: 1_784_343_175,
    baseZeroBits: 22,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: 1_784_343_175,
  });
  const cats = [...c.codeBytes].filter(b => b === 0x7e).length;
  const splits = [...c.codeBytes].filter(b => b === 0x7f).length;
  let i = c.codeBytes.length - 1;
  while (i >= 0 && c.codeBytes[i] === 0x77) i--;
  const drops = c.codeBytes.length - 1 - i;
  console.log(
    JSON.stringify(
      {
        redeemLen: c.redeemScriptBuf.length,
        codeLen: c.codeBytes.length,
        tipValueOffset: c.tipValueOffset,
        OP_CAT: cats,
        OP_SPLIT: splits,
        trailingDrops: drops,
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
  console.log('smoke ok');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
