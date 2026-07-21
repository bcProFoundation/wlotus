/** Miner share of each wLotus remint (covenant-hardcoded). */
export const WLOTUS_MINER_ATOMS = 1n;
/**
 * Temple share — one mala round is 108 beads: 1 presence + 107 dana/temple.
 * (ALP amounts are also hardcoded in WlotusPowRemintMooreTipTemple.spedn.)
 */
export const WLOTUS_TEMPLE_ATOMS = 107n;
export const WLOTUS_MINT_ATOMS = WLOTUS_MINER_ATOMS + WLOTUS_TEMPLE_ATOMS;
/** Full mala / remint size (1 + 107). */
export const WLOTUS_MALA_ATOMS = WLOTUS_MINT_ATOMS;
