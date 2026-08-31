/**
 * Plan a token-recut offering migration (star topology).
 *
 * Roots (no parent) first, then re-offers / fragments. Parent txids on
 * children are rewritten through the mapping after each root burns.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

/**
 * Atoms the tip must hold: 1 memorial burn per offering, plus optional
 * leftover sent to the temple with that burn (felt soft tax).
 */
export function migrationNeedAtoms(
  burns: readonly MigratableBurn[],
  inventoryPerOffering = 0n,
): bigint {
  const n = BigInt(orderBurnsForMigration(burns).length);
  if (inventoryPerOffering < 0n) {
    throw new Error('inventoryPerOffering must be ≥ 0');
  }
  return n * (1n + inventoryPerOffering);
}

const TXID_RE = /^[0-9a-f]{64}$/;

/**
 * Destination txids from a bulk copy whose source is the dryrun token.
 * Used so the public index does not mix dWLOTUS history into a WLOTUS desk.
 */
export function txidsCopiedFromDryrunToken(
  fromTokenId: string | undefined,
  mapping: Record<string, string> | undefined,
  dryrunTokenId: string | undefined,
): Set<string> {
  const from = (fromTokenId || '').trim().toLowerCase();
  const dry = (dryrunTokenId || '').trim().toLowerCase();
  const out = new Set<string>();
  if (!from || !dry || from !== dry || !mapping) return out;
  for (const v of Object.values(mapping)) {
    const id = String(v || '')
      .trim()
      .toLowerCase();
    if (TXID_RE.test(id)) out.add(id);
  }
  return out;
}

export function loadDryrunCopiedTxids(cwd = process.cwd()): Set<string> {
  const dryPath = resolve(cwd, 'deployments/mainnet-dryrun-wlotus.json');
  const migPath = resolve(cwd, 'deployments/offering-migration.json');
  if (!existsSync(dryPath) || !existsSync(migPath)) return new Set();
  try {
    const dry = JSON.parse(readFileSync(dryPath, 'utf8')) as {
      tokenId?: string;
    };
    const mig = JSON.parse(readFileSync(migPath, 'utf8')) as {
      fromTokenId?: string;
      mapping?: Record<string, string>;
    };
    return txidsCopiedFromDryrunToken(
      mig.fromTokenId,
      mig.mapping,
      dry.tokenId,
    );
  } catch {
    return new Set();
  }
}
