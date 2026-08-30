/** Miner share of each live (102/6) wLotus remint (covenant-hardcoded). */
export const WLOTUS_MINER_ATOMS = 102n;
/**
 * Temple / issuer tax per remint on the **live 102/6** genesis.
 * Retired by the felt no-tax recut (`WlotusPowRemintMooreTip` / GLotus shape):
 * changing the split requires a new tokenId — see ECONOMICS.md.
 *
 * Sponsored desk path on 102/6:
 *   covenant pays 102 → desk miner key; desk burns 1 for the flower
 *   offering and retains 101 inventory; temple still receives 6.
 *
 * ALP amounts are hardcoded in WlotusPowRemintMooreTipTemple.spedn.
 */
export const WLOTUS_TEMPLE_ATOMS = 6n;
export const WLOTUS_MINT_ATOMS = WLOTUS_MINER_ATOMS + WLOTUS_TEMPLE_ATOMS;
/** Full mala / remint size (102 + 6 = 108). */
export const WLOTUS_MALA_ATOMS = WLOTUS_MINT_ATOMS;
/** After a memorial burn of 1, desk inventory retained from a sponsored 102/6 remint. */
export const WLOTUS_DESK_KEEP_AFTER_BURN = WLOTUS_MINER_ATOMS - 1n;

/** Felt no-tax recut: same redeem shape as dGLOTUS (`GlotusPowRemintMooreTip`). */
export const WLOTUS_FELT_COVENANT = 'GlotusPowRemintMooreTip';
export const WLOTUS_FELT_MODE = 'wlotus-moore-felt-bit';
/** One mala, all to miner. */
export const WLOTUS_FELT_MINER_ATOMS = 108n;
export const WLOTUS_FELT_TEMPLE_ATOMS = 0n;
/** After a memorial burn of 1 on the felt recut. */
export const WLOTUS_FELT_DESK_KEEP_AFTER_BURN = WLOTUS_FELT_MINER_ATOMS - 1n;

export function isWlotusFeltCovenant(
  dep: { covenant?: string; mode?: string } | null | undefined,
): boolean {
  if (!dep) return false;
  return (
    dep.covenant === WLOTUS_FELT_COVENANT ||
    dep.mode === WLOTUS_FELT_MODE ||
    dep.mode === 'glotus-moore-felt-bit'
  );
}

export function isWlotusTempleCovenant(
  dep: { covenant?: string; mode?: string } | null | undefined,
): boolean {
  if (!dep) return false;
  return (
    dep.covenant === 'WlotusPowRemintMooreTipTemple' ||
    dep.mode === 'moore-tip-temple-hard-bind'
  );
}

/** Desk memorial-on-burn path (temple 102/6 or felt no-tax). */
export function isWlotusDeskCovenant(
  dep: { covenant?: string; mode?: string; tier?: string } | null | undefined,
): boolean {
  if (!dep) return false;
  return (
    isWlotusTempleCovenant(dep) ||
    isWlotusFeltCovenant(dep) ||
    dep.tier === 'wlotus'
  );
}
