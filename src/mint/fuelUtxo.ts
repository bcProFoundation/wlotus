/**
 * Remint fuel and memorial-burn postage sizing.
 *
 * Remint has no change output: any sats on the fuel UTXO above the dust outs
 * are burned as miner fee. Always attach a small, pre-sized pure-XEC coin —
 * never a large treasury UTXO.
 *
 * Desk holds treasury. Each offering, desk sends **two** sized coins to the
 * mint/tip in one tx (remint fuel + burn postage; desk change stays on desk).
 * Burn leftover XEC returns to the desk. Chunking a large balance onto the
 * mint does not save a hop — remint still needs a sized coin.
 */
export const REMINT_FUEL_SATS = 4_000n;
/** Prefer remint coins in [REMINT_FUEL_SATS, REMINT_FUEL_MAX_SATS]. */
export const REMINT_FUEL_MAX_SATS = REMINT_FUEL_SATS + 1_000n;

/**
 * Burn postage: covers ~6–9 XEC miner fee plus a dust change out back to desk.
 * Kept **below** remint fuel min so pickers cannot steal each other's coins.
 * 546-sat leftover dust is **not** enough — ecash-wallet then pulls the next
 * UTXO, which on a funded tip may be the oversized reserve.
 */
export const BURN_POSTAGE_SATS = 2_500n;
export const BURN_POSTAGE_MIN_SATS = 1_500n;
export const BURN_POSTAGE_MAX_SATS = 3_500n;

/** Desk → tip pair: remint fuel + burn postage (one tx). */
export const OFFERING_PAIR_SATS = REMINT_FUEL_SATS + BURN_POSTAGE_SATS;

/** Need this much headroom above the pair to split (pair + network fee). */
export const REMINT_FUEL_SPLIT_MIN_SATS = OFFERING_PAIR_SATS + 2_000n;

/** Keep at least this much pure XEC on the desk when auto-funding mint fuel. */
export const DESK_TOPUP_RESERVE_SATS = 10_000n;

export interface PureUtxoLike {
  outpoint: { txid: string; outIdx: number };
  sats: bigint;
  token?: unknown;
}

export function isSizedFuelSats(sats: bigint): boolean {
  return sats >= REMINT_FUEL_SATS && sats <= REMINT_FUEL_MAX_SATS;
}

export function isBurnPostageSats(sats: bigint): boolean {
  return sats >= BURN_POSTAGE_MIN_SATS && sats <= BURN_POSTAGE_MAX_SATS;
}

export function isOversizedFuelSats(sats: bigint): boolean {
  return sats > REMINT_FUEL_MAX_SATS;
}

function utxoKey(u: PureUtxoLike): string {
  return `${u.outpoint.txid}:${u.outpoint.outIdx}`;
}

/**
 * Smallest pure-XEC coin that can pay a memorial burn **without** attaching
 * an oversized reserve or a remint fuel.
 */
export function pickBurnPostageUtxo<T extends PureUtxoLike>(
  utxos: T[],
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const postage = utxos
    .filter(
      u => !u.token && isBurnPostageSats(u.sats) && !blocked.has(utxoKey(u)),
    )
    .sort((a, b) => (a.sats < b.sats ? -1 : a.sats > b.sats ? 1 : 0));
  return postage[0] ?? null;
}

/** Smallest sized remint-fuel coin not in `blocked`, or null. */
export function pickSizedFuelUtxo<T extends PureUtxoLike>(
  utxos: T[],
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const sized = utxos
    .filter(
      u => !u.token && isSizedFuelSats(u.sats) && !blocked.has(utxoKey(u)),
    )
    .sort((a, b) => (a.sats < b.sats ? -1 : a.sats > b.sats ? 1 : 0));
  return sized[0] ?? null;
}

/** Largest pure-XEC coin big enough to split a remint+postage pair. */
export function pickSplitSourceUtxo<T extends PureUtxoLike>(
  utxos: T[],
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const big = utxos
    .filter(
      u =>
        !u.token &&
        u.sats >= REMINT_FUEL_SPLIT_MIN_SATS &&
        !blocked.has(utxoKey(u)),
    )
    .sort((a, b) => (a.sats < b.sats ? 1 : a.sats > b.sats ? -1 : 0));
  return big[0] ?? null;
}

export function pureXecBalance(utxos: PureUtxoLike[]): bigint {
  return utxos
    .filter(u => !u.token)
    .reduce((sum, u) => sum + u.sats, 0n);
}

/** BIP44 account number for tip fee wallet (1-based; desk is non-HD). */
export function tipFeeAccountNumber(tipIndex: number): number {
  if (!Number.isInteger(tipIndex) || tipIndex < 0) {
    throw new Error(`tipIndex must be a non-negative integer (got ${tipIndex})`);
  }
  return tipIndex + 1;
}
