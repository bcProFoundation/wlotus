import {
  BASE_MINT_ATOMS,
  MOORE_DAY_BLOCKS,
  MOORE_DAY_SECONDS,
  MOORE_DAYS_PER_EXTRA_BIT,
  MOORE_DEN,
  MOORE_NUM,
  MOORE_NUM_OBSOLETE,
  POW_BASE_ZERO_BITS,
  POW_LEADING_ZERO_BYTES,
} from '../params/consensus.js';

/**
 * Apply one Moore day-step to a positive integer work/ease value:
 * x ← floor(x * 99918 / 100000).
 *
 * Ergon applies this to work-credit in subsidy. With **fixed** 100 tokens/mint,
 * the dual schedule raises required hashes over time (see requiredZeroBits).
 */
export function mooreStep(x: bigint, num: bigint = MOORE_NUM): bigint {
  if (num === MOORE_NUM_OBSOLETE) {
    throw new Error('Obsolete Moore factor 99826/100000 is forbidden for WLOTUS');
  }
  return (x * num) / MOORE_DEN;
}

/**
 * After k wall-day steps: x₀ · δ^k (integer iterated).
 */
export function mooreAfterDays(
  days: number,
  base: bigint,
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
 * @deprecated Mint atoms are fixed at BASE_MINT_ATOMS. Kept for tests / old docs.
 * Prefer requiredZeroBits / mooreAfterDays on a work scale.
 */
export function mintAtomsAfterDays(
  days: number,
  base: bigint = BASE_MINT_ATOMS,
  num: bigint = MOORE_NUM,
): bigint {
  return mooreAfterDays(days, base, num);
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

export function mooreDaysFromUnix(
  genesisUnix: number,
  nowUnix: number,
  daySeconds: number = MOORE_DAY_SECONDS,
): number {
  if (nowUnix < genesisUnix) {
    throw new Error('nowUnix < genesisUnix');
  }
  return Math.floor((nowUnix - genesisUnix) / daySeconds);
}

/**
 * Required leading zero *bits* after `days` (Koomey-style schedule).
 * +1 bit ≈ 2× hashes every MOORE_DAYS_PER_EXTRA_BIT (~840d ≈ 2.3y).
 */
export function requiredZeroBits(
  days: number,
  baseBits: number = POW_BASE_ZERO_BITS,
  daysPerExtraBit: number = MOORE_DAYS_PER_EXTRA_BIT,
): number {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('days must be a non-negative integer');
  }
  return baseBits + Math.floor(days / daysPerExtraBit);
}

/** Whole leading zero bytes implied by bit requirement (floor). */
export function requiredZeroBytes(days: number): number {
  return Math.floor(requiredZeroBits(days) / 8);
}

/**
 * Fixed mint atoms (always 100.00 @ 2 decimals) — Moore does not change this.
 */
export function mintAtomsAtHostHeight(
  _genesisHeight: number,
  _currentHeight: number,
  base: bigint = BASE_MINT_ATOMS,
): bigint {
  return base;
}

/** Approximate half-life in years for δ = 99918/100000 (daily steps). */
export function approxHalfLifeYears(num: bigint = MOORE_NUM): number {
  const delta = Number(num) / Number(MOORE_DEN);
  return Math.LN2 / -Math.log(delta) / 365.25;
}

/** Genesis incubation difficulty in leading zero bytes. */
export function incubationZeroBytes(): number {
  return POW_LEADING_ZERO_BYTES;
}
