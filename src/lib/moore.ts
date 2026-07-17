import {
  BASE_MINT_ATOMS,
  MOORE_DAY_BLOCKS,
  MOORE_DEN,
  MOORE_NUM,
  MOORE_NUM_OBSOLETE,
} from '../params/consensus.js';

/**
 * Apply one Moore day-step: x ← floor(x * 99918 / 100000).
 */
export function mooreStep(atoms: bigint, num: bigint = MOORE_NUM): bigint {
  if (num === MOORE_NUM_OBSOLETE) {
    throw new Error('Obsolete Moore factor 99826/100000 is forbidden for WLOTUS');
  }
  return (atoms * num) / MOORE_DEN;
}

/**
 * M(k) after k wall-day steps from genesis.
 * Matches Ergon's repeated daily correction with δ = 99918/100000.
 */
export function mintAtomsAfterDays(
  days: number,
  base: bigint = BASE_MINT_ATOMS,
  num: bigint = MOORE_NUM,
): bigint {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('days must be a non-negative integer');
  }
  let x = base;
  for (let i = 0; i < days; i++) {
    x = mooreStep(x, num);
  }
  return x;
}

/**
 * Day index k from host chain heights (Ergon-style day divisions).
 */
export function mooreDaysFromHeights(
  genesisHeight: number,
  currentHeight: number,
  dayBlocks: number = MOORE_DAY_BLOCKS,
): number {
  if (currentHeight < genesisHeight) {
    throw new Error('currentHeight < genesisHeight');
  }
  return Math.floor((currentHeight - genesisHeight) / dayBlocks);
}

/**
 * Expected mint atoms at a host height.
 */
export function mintAtomsAtHostHeight(
  genesisHeight: number,
  currentHeight: number,
  base: bigint = BASE_MINT_ATOMS,
): bigint {
  const k = mooreDaysFromHeights(genesisHeight, currentHeight);
  return mintAtomsAfterDays(k, base);
}

/** Approximate half-life in years for δ = 99918/100000 (daily steps). */
export function approxHalfLifeYears(num: bigint = MOORE_NUM): number {
  const delta = Number(num) / Number(MOORE_DEN);
  // H = ln(2) / -ln(delta) days, / 365.25 → years
  return Math.LN2 / -Math.log(delta) / 365.25;
}
