import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wlptV4Pushdata, type MooreTipState } from './mooreTip.js';

/** Dual-push EMPP: DANA tip v4 + ALP MINT. */
export function expectedMooreTipMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: MooreTipState,
): Script {
  return emppScript([
    wlptV4Pushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}
