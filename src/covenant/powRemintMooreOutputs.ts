import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wldfPushdata, type MooreBitsState } from './wldf.js';

/** Dual-push EMPP: WLDF + ALP MINT (Agora pattern). */
export function expectedMooreMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: MooreBitsState,
): Script {
  return emppScript([
    wldfPushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}
