import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wlptV4Pushdata, type MooreTipState } from './mooreTip.js';
import {
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../params/wlotusMint.js';

export {
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
  WLOTUS_MINT_ATOMS,
} from '../params/wlotusMint.js';

/** Dual-push EMPP: WLPT v4 + ALP MINT [1, 99] + 1 baton. */
export function expectedMooreTipTempleMintOpReturnScript(
  tokenId: string,
  state: MooreTipState,
): Script {
  return emppScript([
    wlptV4Pushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [WLOTUS_MINER_ATOMS, WLOTUS_TEMPLE_ATOMS],
      numBatons: 1,
    }),
  ]);
}
