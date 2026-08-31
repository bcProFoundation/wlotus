/**
 * Plan a token-recut offering migration (star topology).
 *
 * Roots (no parent) first, then re-offers / fragments. Parent txids on
 * children are rewritten through the mapping after each root burns.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAltarNote } from './altarFields.js';
import { findCatalogEntryByName } from '../params/templeSpecialCatalog.js';

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

const TXID_RE = /^[0-9a-f]{64}$/;

/**
 * Point special claims at reminted roots. Drop ids whose old txid was not
 * in the mapping — leaving a prod/test txid on the new token makes Events
 * look empty (bound profile, no burns in the new index).
 */
export function remapSpecialClaims(
  claims: Readonly<Record<string, string>>,
  mapping: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, txid] of Object.entries(claims)) {
    const old = txid.trim().toLowerCase();
    const next = mapping[old];
    if (next) out[id] = next;
  }
  return out;
}

export interface BindableBurn {
  burnTxid: string;
  note: string;
  parentBurnTxid?: string;
}

/** Catalog special id from a packed altar note or a plain name. */
export function catalogSpecialIdFromNote(
  note: string | undefined,
): string | undefined {
  const raw = (note ?? '').trim();
  if (!raw) return undefined;
  const packed = parseAltarNote(raw);
  const name = (packed?.name || '').trim();
  if (name) {
    const hit = findCatalogEntryByName(name);
    if (hit) return hit.id;
  }
  return findCatalogEntryByName(raw.replace(/\u001f/g, ' '))?.id;
}

/**
 * Bind catalog specials to migrated roots by altar name.
 *
 * Prod Nepal 26/8 is a visitor star (`Nepal 26/08`) that was never claimed as
 * `nepal-26-08`. Remapping the claims file alone leaves the event unbound.
 * Pick the largest matching star when several roots share a name.
 */
export function bindCatalogClaimsFromBurns(
  claims: Readonly<Record<string, string>>,
  burns: readonly BindableBurn[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, txid] of Object.entries(claims)) {
    const v = txid.trim().toLowerCase();
    if (TXID_RE.test(v)) out[id] = v;
  }

  const memberCount = new Map<string, number>();
  const roots: BindableBurn[] = [];
  for (const b of burns) {
    const id = b.burnTxid.trim().toLowerCase();
    if (!TXID_RE.test(id)) continue;
    const parent = b.parentBurnTxid?.trim().toLowerCase();
    if (parent) {
      memberCount.set(parent, (memberCount.get(parent) ?? 0) + 1);
    } else {
      roots.push({ ...b, burnTxid: id });
      memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
    }
  }

  const best = new Map<string, { txid: string; n: number }>();
  for (const r of roots) {
    const specialId = catalogSpecialIdFromNote(r.note);
    if (!specialId) continue;
    const n = memberCount.get(r.burnTxid) ?? 1;
    const prev = best.get(specialId);
    if (!prev || n > prev.n) best.set(specialId, { txid: r.burnTxid, n });
  }

  const live = new Set(memberCount.keys());
  for (const [specialId, hit] of best) {
    const existing = out[specialId];
    if (existing && live.has(existing)) continue;
    out[specialId] = hit.txid;
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
