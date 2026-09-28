/**
 * Two-shard OP_RETURN builder (ecash-lib-backed).
 *
 * Split from twoShardMath.ts (pure) because jest cannot load ecash-lib's
 * WASM glue. Re-exports the math for single-import convenience in scripts.
 */
import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wldfTwoShardPushdata } from './twoShardMath.js';

export * from './twoShardMath.js';

/** eMPP OP_RETURN: WLDF v3 state + ALP MINT (atoms → out1, 2 batons → out2/3). */
export function expectedTwoShardMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: { newDay: number; newTarget: number; locktime: number },
): Script {
  return emppScript([
    wldfTwoShardPushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 2,
    }),
  ]);
}
