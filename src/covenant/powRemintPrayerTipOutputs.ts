import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';
import { wlptPushdata, type PrayerTipState } from './wlpt.js';

/** Dual-push EMPP: WLPT + ALP MINT (Agora pattern). */
export function expectedPrayerTipMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: PrayerTipState,
): Script {
  return emppScript([
    wlptPushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}
