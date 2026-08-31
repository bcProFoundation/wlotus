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

/** WLotus no-temple remint (`WlotusPowRemintMooreTip`): 108 miner, DANA tip, whole-byte PoW. */
export const WLOTUS_MOORE_TIP_COVENANT = 'WlotusPowRemintMooreTip';
export const WLOTUS_MOORE_TIP_MODE = 'moore-tip-hard-bind';

/** Felt no-tax recut: GLotus redeem (`GlotusPowRemintMooreTip`) — opt-in via FELT=1. */
export const WLOTUS_FELT_COVENANT = 'GlotusPowRemintMooreTip';
export const WLOTUS_FELT_MODE = 'wlotus-moore-felt-bit';
/** One mala, all to miner. */
export const WLOTUS_FELT_MINER_ATOMS = 108n;
export const WLOTUS_FELT_TEMPLE_ATOMS = 0n;
/**
 * Soft temple tax on felt: leftover after the memorial burn must send at
 * least this many atoms to `TEMPLE_ADDRESS` (P2PKH or P2SH) or the offering
 * is not listed. Covenant still pays 108 to the miner.
 */
export const WLOTUS_SOFT_TEMPLE_ATOMS = 6n;
/** After a memorial burn of 1 on the felt recut (before soft temple send). */
export const WLOTUS_FELT_DESK_KEEP_AFTER_BURN = WLOTUS_FELT_MINER_ATOMS - 1n;

export type WlotusGenesisRegime = 'moore-tip' | 'felt' | 'temple';

/**
 * `create-wlotus-token` default is GLotus felt redeem + WLOTUS ticker
 * (`GlotusPowRemintMooreTip`: 108 miner, +1 bit / 500 days, no temple).
 * `COVENANT=moore-tip` → whole-byte `WlotusPowRemintMooreTip`.
 * `FELT=0` / `COVENANT=temple` → 102/6 temple (needs TEMPLE_ADDRESS).
 */
export function resolveWlotusGenesisRegime(
  env: Record<string, string | undefined> = process.env,
): WlotusGenesisRegime {
  const v = (env.FELT?.trim() || env.COVENANT?.trim() || '').toLowerCase();
  if (v === 'moore-tip' || v === 'whole-byte') {
    return 'moore-tip';
  }
  if (
    v === '0' ||
    v === 'false' ||
    v === 'no' ||
    v === 'temple' ||
    v === 'moore-tip-temple'
  ) {
    return 'temple';
  }
  return 'felt';
}

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

export function isWlotusMooreTipCovenant(
  dep: { covenant?: string; mode?: string } | null | undefined,
): boolean {
  if (!dep) return false;
  return (
    dep.covenant === WLOTUS_MOORE_TIP_COVENANT ||
    dep.mode === WLOTUS_MOORE_TIP_MODE
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

/** Desk memorial-on-burn path (temple 102/6, WLotus MooreTip, or felt). */
export function isWlotusDeskCovenant(
  dep: { covenant?: string; mode?: string; tier?: string } | null | undefined,
): boolean {
  if (!dep) return false;
  return (
    isWlotusTempleCovenant(dep) ||
    isWlotusFeltCovenant(dep) ||
    isWlotusMooreTipCovenant(dep) ||
    dep.tier === 'wlotus'
  );
}
