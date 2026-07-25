/**
 * Durable JSON store for indexed DANA memorial burns.
 * Single-node Contabo friendly — no native SQLite required.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface IndexedBurn {
  burnTxid: string;
  tokenId: string;
  note: string;
  offeringId: string;
  version: number;
  parentBurnTxid?: string;
  /** Star-root dedication burn (self if original). */
  originalBurnTxid: string;
  blockHeight: number | null;
  /** Unix seconds when confirmed; null if mempool. */
  blockTimestamp: number | null;
  timeFirstSeen: string;
}

export interface MemorialGroup {
  originalBurnTxid: string;
  originalNote: string;
  latestBurnTxid: string;
  latestNote: string;
  totalBurns: number;
  at: string;
  burns: IndexedBurn[];
}

interface StoreFile {
  version: 1;
  burns: IndexedBurn[];
}

export class BurnStore {
  private readonly path: string;
  private byTxid = new Map<string, IndexedBurn>();

  constructor(path: string) {
    this.path = resolve(path);
    this.load();
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8')) as StoreFile;
      if (!raw?.burns || !Array.isArray(raw.burns)) return;
      for (const b of raw.burns) {
        if (b?.burnTxid) this.byTxid.set(b.burnTxid.toLowerCase(), normalizeBurn(b));
      }
      this.recomputeOriginals();
    } catch (err) {
      console.error('dana-index store load failed', err);
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const body: StoreFile = {
      version: 1,
      burns: [...this.byTxid.values()],
    };
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(body));
    renameSync(tmp, this.path);
  }

  /** After inserts, ensure originalBurnTxid follows parent when present. */
  private recomputeOriginals(): void {
    for (const b of this.byTxid.values()) {
      b.originalBurnTxid = resolveOriginal(b, this.byTxid);
    }
  }

  upsert(burn: IndexedBurn): boolean {
    const id = burn.burnTxid.toLowerCase();
    const next = normalizeBurn({ ...burn, burnTxid: id });
    const prev = this.byTxid.get(id);
    if (prev && sameBurn(prev, next)) return false;
    this.byTxid.set(id, next);
    this.recomputeOriginals();
    this.persist();
    return true;
  }

  get(txid: string): IndexedBurn | undefined {
    return this.byTxid.get(txid.trim().toLowerCase());
  }

  size(): number {
    return this.byTxid.size;
  }

  recentGroups(limit: number): MemorialGroup[] {
    const buckets = new Map<string, IndexedBurn[]>();
    for (const b of this.byTxid.values()) {
      const root = b.originalBurnTxid;
      const list = buckets.get(root);
      if (list) list.push(b);
      else buckets.set(root, [b]);
    }

    const groups: MemorialGroup[] = [];
    for (const [rootId, members] of buckets) {
      const original = this.byTxid.get(rootId);
      // Skip orphan stars (parent not ingested) and empty-name roots.
      if (!original || original.parentBurnTxid) continue;
      const originalNote = (original.note || '').trim();
      if (!originalNote) continue;

      const burns = [...members].sort(byActivityDesc);
      const latest = burns[0]!;
      groups.push({
        originalBurnTxid: original.burnTxid,
        originalNote,
        latestBurnTxid: latest.burnTxid,
        latestNote: (latest.note || '').trim(),
        totalBurns: burns.length,
        at: isoFromBurn(latest),
        burns,
      });
    }

    groups.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return groups.slice(0, Math.max(1, Math.min(200, limit)));
  }

  memorial(txid: string): MemorialGroup | null {
    const seed = this.get(txid);
    if (!seed) return null;
    const rootId = seed.originalBurnTxid;
    const original = this.byTxid.get(rootId);
    if (!original || original.parentBurnTxid) return null;
    const originalNote = (original.note || '').trim();
    if (!originalNote) return null;

    const members = [...this.byTxid.values()].filter(
      b => b.originalBurnTxid === rootId,
    );
    if (!members.length) return null;
    const burns = members.sort(byActivityDesc);
    const latest = burns[0]!;
    return {
      originalBurnTxid: original.burnTxid,
      originalNote,
      latestBurnTxid: latest.burnTxid,
      latestNote: (latest.note || '').trim(),
      totalBurns: burns.length,
      at: isoFromBurn(latest),
      burns,
    };
  }
}

function normalizeBurn(b: IndexedBurn): IndexedBurn {
  const burnTxid = b.burnTxid.toLowerCase();
  const parent = b.parentBurnTxid?.toLowerCase() || undefined;
  return {
    ...b,
    burnTxid,
    parentBurnTxid: parent,
    // Star only: parent field is the original; no tip-chain walk.
    originalBurnTxid: (parent || burnTxid).toLowerCase(),
    note: b.note ?? '',
    offeringId: b.offeringId ?? '',
  };
}

/** Star topology: parentBurnTxid = original, else self. */
function resolveOriginal(
  burn: IndexedBurn,
  _byTxid: Map<string, IndexedBurn>,
): string {
  return (burn.parentBurnTxid || burn.burnTxid).toLowerCase();
}

function byActivityDesc(a: IndexedBurn, b: IndexedBurn): number {
  return activityMs(b) - activityMs(a);
}

function activityMs(b: IndexedBurn): number {
  if (b.blockTimestamp != null && b.blockTimestamp > 0) {
    return b.blockTimestamp * 1000;
  }
  return Date.parse(b.timeFirstSeen) || 0;
}

function isoFromBurn(b: IndexedBurn): string {
  if (b.blockTimestamp != null && b.blockTimestamp > 0) {
    return new Date(b.blockTimestamp * 1000).toISOString();
  }
  return b.timeFirstSeen;
}

function sameBurn(a: IndexedBurn, b: IndexedBurn): boolean {
  return (
    a.note === b.note &&
    a.parentBurnTxid === b.parentBurnTxid &&
    a.blockHeight === b.blockHeight &&
    a.blockTimestamp === b.blockTimestamp &&
    a.version === b.version &&
    a.offeringId === b.offeringId
  );
}
