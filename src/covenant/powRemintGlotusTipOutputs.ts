import { ALP_STANDARD, alpMint, emppScript, Script } from 'ecash-lib';

/** Single-push EMPP: ALP MINT only (no DANA tip — needed to fit felt +1 bit). */
export function expectedGlotusMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
): Script {
  return emppScript([
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}
