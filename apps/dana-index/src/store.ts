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
      const burns = [...members].sort(byActivityDesc);
      const latest = burns[0]!;
      const original =
        this.byTxid.get(rootId) ??
        [...members].sort(byActivityAsc)[0]!;
      groups.push({
        originalBurnTxid: original.burnTxid,
        originalNote: (original.note || '').trim(),
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
    const members = [...this.byTxid.values()].filter(
      b => b.originalBurnTxid === rootId,
    );
    if (!members.length) return null;
    const burns = members.sort(byActivityDesc);
    const latest = burns[0]!;
    const original = this.byTxid.get(rootId) ?? [...members].sort(byActivityAsc)[0]!;
    return {
      originalBurnTxid: original.burnTxid,
      originalNote: (original.note || '').trim(),
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
    originalBurnTxid: (b.originalBurnTxid || parent || burnTxid).toLowerCase(),
    note: b.note ?? '',
    offeringId: b.offeringId ?? '',
  };
}

function resolveOriginal(
  burn: IndexedBurn,
  byTxid: Map<string, IndexedBurn>,
): string {
  let cur = burn;
  const seen = new Set<string>();
  while (
    cur.parentBurnTxid &&
    byTxid.has(cur.parentBurnTxid) &&
    !seen.has(cur.burnTxid)
  ) {
    seen.add(cur.burnTxid);
    cur = byTxid.get(cur.parentBurnTxid)!;
  }
  // Star topology: parent may not be indexed yet — still treat parent as root.
  if (burn.parentBurnTxid && !byTxid.has(burn.parentBurnTxid)) {
    return burn.parentBurnTxid;
  }
  return cur.parentBurnTxid && !byTxid.has(cur.parentBurnTxid)
    ? cur.parentBurnTxid
    : cur.burnTxid;
}

function byActivityDesc(a: IndexedBurn, b: IndexedBurn): number {
  return activityMs(b) - activityMs(a);
}

function byActivityAsc(a: IndexedBurn, b: IndexedBurn): number {
  return activityMs(a) - activityMs(b);
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
