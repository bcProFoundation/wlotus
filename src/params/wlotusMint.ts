/** Miner share of each wLotus remint (covenant-hardcoded). */
export const WLOTUS_MINER_ATOMS = 102n;
/**
 * Temple / issuer tax per remint (covenant-hardcoded).
 * One mala = 108 beads: 102 to miner + 6 temple.
 *
 * Sponsored desk path (wlotus.org as fee sponsor):
 *   covenant pays 102 → desk miner key; desk burns 1 for the flower
 *   offering and retains 101 inventory; temple still receives 6.
 *
 * ALP amounts are also hardcoded in WlotusPowRemintMooreTipTemple.spedn.
 */
export const WLOTUS_TEMPLE_ATOMS = 6n;
export const WLOTUS_MINT_ATOMS = WLOTUS_MINER_ATOMS + WLOTUS_TEMPLE_ATOMS;
/** Full mala / remint size (102 + 6 = 108). */
export const WLOTUS_MALA_ATOMS = WLOTUS_MINT_ATOMS;
/** After a memorial burn of 1, desk inventory retained from a sponsored remint. */
export const WLOTUS_DESK_KEEP_AFTER_BURN = WLOTUS_MINER_ATOMS - 1n;
