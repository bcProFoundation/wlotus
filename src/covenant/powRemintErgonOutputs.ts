import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wldfErgonPushdata, type ErgonState } from './ergon.js';

/** Dual-push EMPP: WLDF v2 (Ergon target) + ALP MINT. */
export function expectedErgonMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: ErgonState,
): Script {
  return emppScript([
    wldfErgonPushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}
