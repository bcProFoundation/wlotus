import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wlptV4Pushdata, type MooreTipState } from './mooreTip.js';

/** Triple-push EMPP: DANA tip v4 + ALP MINT + memorial (DANA v1/v2). */
export function expectedMooreTipMemoMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: MooreTipState,
  memorial: Uint8Array,
): Script {
  if (memorial.length < 1 || memorial.length > 100) {
    throw new Error(`memorial length ${memorial.length} out of 1..100`);
  }
  return emppScript([
    wlptV4Pushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
    memorial,
  ]);
}
