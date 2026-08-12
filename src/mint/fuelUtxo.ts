/**
 * Remint fuel sizing.
 *
 * Remint has no change output: any sats on the fuel UTXO above the dust outs
 * are burned as miner fee. Always attach a small, pre-sized pure-XEC coin —
 * never a large treasury UTXO.
 *
 * Desk holds treasury. Each offering, desk sends one REMINT_FUEL_SATS coin to
 * the mint/tip address (change stays on desk). Chunking a large balance onto
 * the mint does not save a hop — remint still needs a sized coin.
 */
export const REMINT_FUEL_SATS = 4_000n;
/** Prefer coins in [REMINT_FUEL_SATS, REMINT_FUEL_MAX_SATS]. */
export const REMINT_FUEL_MAX_SATS = REMINT_FUEL_SATS + 1_000n;
/** Need this much headroom above target to split (target + network fee). */
export const REMINT_FUEL_SPLIT_MIN_SATS = REMINT_FUEL_SATS + 2_000n;

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

export function isOversizedFuelSats(sats: bigint): boolean {
  return sats > REMINT_FUEL_MAX_SATS;
}

/** Smallest sized pure-XEC coin not in `blocked`, or null. */
export function pickSizedFuelUtxo<T extends PureUtxoLike>(
  utxos: T[],
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const key = (u: T) => `${u.outpoint.txid}:${u.outpoint.outIdx}`;
  const sized = utxos
    .filter(
      u =>
        !u.token &&
        isSizedFuelSats(u.sats) &&
        !blocked.has(key(u)),
    )
    .sort((a, b) => (a.sats < b.sats ? -1 : a.sats > b.sats ? 1 : 0));
  return sized[0] ?? null;
}

/** Largest pure-XEC coin big enough to split a sized fuel output. */
export function pickSplitSourceUtxo<T extends PureUtxoLike>(
  utxos: T[],
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const key = (u: T) => `${u.outpoint.txid}:${u.outpoint.outIdx}`;
  const big = utxos
    .filter(
      u =>
        !u.token &&
        u.sats >= REMINT_FUEL_SPLIT_MIN_SATS &&
        !blocked.has(key(u)),
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
