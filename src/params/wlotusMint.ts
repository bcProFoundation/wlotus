/** Miner share of each wLotus remint (covenant-hardcoded). */
export const WLOTUS_MINER_ATOMS = 1n;
/**
 * Temple / issuer share per remint.
 * Was 107 (one mala: 1 presence + 107 dana). Reduced to 6 so independent
 * miners keep a meaningful fraction under soft launch difficulty, while
 * still funding the desk. ALP amounts are also hardcoded in
 * WlotusPowRemintMooreTipTemple.spedn.
 */
export const WLOTUS_TEMPLE_ATOMS = 6n;
export const WLOTUS_MINT_ATOMS = WLOTUS_MINER_ATOMS + WLOTUS_TEMPLE_ATOMS;
/** Total atoms minted per successful remint (1 miner + 6 temple). */
export const WLOTUS_MALA_ATOMS = WLOTUS_MINT_ATOMS;
