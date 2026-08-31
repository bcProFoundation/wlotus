/**
 * Plan a token-recut offering migration (star topology).
 *
 * Roots (no parent) first, then re-offers / fragments. Parent txids on
 * children are rewritten through the mapping after each root burns.
 */

export interface MigratableBurn {
  burnTxid: string;
  note: string;
  parentBurnTxid?: string;
  offeringId: string;
  version: number;
}

export function orderBurnsForMigration(
  burns: readonly MigratableBurn[],
): MigratableBurn[] {
  const seen = new Set<string>();
  const out: MigratableBurn[] = [];
  const roots: MigratableBurn[] = [];
  const kids: MigratableBurn[] = [];
  for (const b of burns) {
    const id = b.burnTxid.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const parent = b.parentBurnTxid?.trim().toLowerCase() || undefined;
    const row = { ...b, burnTxid: id, parentBurnTxid: parent };
    if (parent) kids.push(row);
    else roots.push(row);
  }
  out.push(...roots, ...kids);
  return out;
}

/** Rewrite a txid through old→new map. Unmapped ids stay. */
export function remapTxid(
  txid: string | undefined,
  mapping: Readonly<Record<string, string>>,
): string | undefined {
  if (!txid) return undefined;
  const old = txid.trim().toLowerCase();
  if (!old) return undefined;
  return mapping[old] ?? old;
}

/** Rewrite a child's parent through old→new txid map. Unmapped parents stay. */
export function remapParentTxid(
  parentBurnTxid: string | undefined,
  mapping: Readonly<Record<string, string>>,
): string | undefined {
  return remapTxid(parentBurnTxid, mapping);
}

/** Point special claims at reminted roots when the old txid was migrated. */
export function remapSpecialClaims(
  claims: Readonly<Record<string, string>>,
  mapping: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, txid] of Object.entries(claims)) {
    const old = txid.trim().toLowerCase();
    out[id] = mapping[old] ?? old;
  }
  return out;
}

export function migrationNeedAtoms(burns: readonly MigratableBurn[]): bigint {
  return BigInt(orderBurnsForMigration(burns).length);
}
