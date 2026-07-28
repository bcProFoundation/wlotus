/**
 * Merge global dana-index groups with this device's localStorage burns.
 */

import type { IndexBurn, IndexMemorialGroup } from './danaIndexApi.js';
import type { LocalOffer, OfferGroup } from './groupOffers.js';
import {
  groupOffersByOriginal,
  isNamedRootOffer,
  resolveOriginalTxid,
} from './groupOffers.js';

function indexBurnToLocal(b: IndexBurn): LocalOffer {
  const burnTxid = b.burnTxid.trim().toLowerCase();
  const parent = b.parentBurnTxid?.trim().toLowerCase();
  return {
    remintTxid: '',
    burnTxid,
    note: (b.note || '').trim(),
    at:
      b.blockTimestamp != null && b.blockTimestamp > 0
        ? new Date(b.blockTimestamp * 1000).toISOString()
        : b.timeFirstSeen,
    parentBurnTxid: parent || undefined,
  };
}

function indexGroupToOfferGroup(g: IndexMemorialGroup): OfferGroup | null {
  const burns: LocalOffer[] = g.burns.map(indexBurnToLocal);
  const byTxid = new Map(
    burns.map(b => [b.burnTxid.trim().toLowerCase(), b] as const),
  );
  const rootId = g.originalBurnTxid.trim().toLowerCase();
  const original = byTxid.get(rootId);
  if (!original || !isNamedRootOffer(original)) return null;

  const latest =
    byTxid.get(g.latestBurnTxid.trim().toLowerCase()) ??
    burns[0] ??
    original;
  return {
    original,
    latest,
    burns: burns.length ? burns : [original],
    totalBurns: g.totalBurns || burns.length || 1,
    note: (g.originalNote || original.note || '').trim(),
  };
}

/** Prefer packed / non-empty index dedication note over a thin local root note. */
function preferRootNote(localNote: string, indexNote: string): string {
  const local = localNote.trim();
  const remote = indexNote.trim();
  if (!remote) return local;
  if (!local) return remote;
  const localPacked = local.includes('\u001f');
  const remotePacked = remote.includes('\u001f');
  if (remotePacked && !localPacked) return remote;
  return local;
}

/**
 * Union index burns for one dedication into localStorage offers so Recent
 * `totalBurns` matches History (without importing unrelated dedications).
 * Keeps local remint/pow fields when the same burnTxid already exists.
 */
export function syncIndexMemorialIntoLocal(
  localOffers: LocalOffer[],
  memorial: IndexMemorialGroup,
): LocalOffer[] {
  const root = memorial.originalBurnTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(root)) return localOffers;

  const originalNote = (memorial.originalNote || '').trim();
  const other: LocalOffer[] = [];
  const byTxid = new Map<string, LocalOffer>();

  for (const o of localOffers) {
    const id = o.burnTxid.trim().toLowerCase();
    if (!id) continue;
    if (resolveOriginalTxid(o) !== root && id !== root) {
      other.push(o);
      continue;
    }
    byTxid.set(id, {
      ...o,
      burnTxid: id,
      parentBurnTxid: o.parentBurnTxid?.trim().toLowerCase() || undefined,
    });
  }

  for (const raw of memorial.burns) {
    const incoming = indexBurnToLocal(raw);
    const id = incoming.burnTxid;
    if (!id) continue;
    // Star topology: only keep root + direct children of this dedication.
    if (id !== root) {
      const parent = incoming.parentBurnTxid;
      if (parent && parent !== root) continue;
      if (!parent) {
        // Index row missing parent — still attach as re-offer under this root.
        incoming.parentBurnTxid = root;
      }
    } else {
      incoming.parentBurnTxid = undefined;
      if (originalNote) incoming.note = originalNote;
    }

    const existing = byTxid.get(id);
    if (!existing) {
      byTxid.set(id, incoming);
      continue;
    }
    byTxid.set(id, {
      ...incoming,
      ...existing,
      burnTxid: id,
      note:
        id === root
          ? preferRootNote(existing.note, originalNote || incoming.note)
          : existing.note.trim() || incoming.note,
      parentBurnTxid:
        id === root
          ? undefined
          : existing.parentBurnTxid || incoming.parentBurnTxid || root,
      remintTxid: existing.remintTxid || incoming.remintTxid,
      powMs: existing.powMs ?? incoming.powMs,
      powAttempts: existing.powAttempts ?? incoming.powAttempts,
      hashrateHps: existing.hashrateHps ?? incoming.hashrateHps,
      bits: existing.bits ?? incoming.bits,
      at: existing.at || incoming.at,
    });
  }

  if (!byTxid.has(root) && originalNote) {
    byTxid.set(root, {
      remintTxid: root,
      burnTxid: root,
      note: originalNote,
      at: memorial.at || new Date().toISOString(),
    });
  } else if (byTxid.has(root) && originalNote) {
    const cur = byTxid.get(root)!;
    byTxid.set(root, {
      ...cur,
      note: preferRootNote(cur.note, originalNote),
      parentBurnTxid: undefined,
    });
  }

  return [...other, ...byTxid.values()];
}

/**
 * Prefer index (all clients). Overlay any local-only roots not yet in the index.
 * Drops empty-name / orphan groups ("Lần dâng hoa" fallbacks).
 */
export function mergeIndexAndLocalOffers(
  indexGroups: IndexMemorialGroup[] | null,
  localOffers: LocalOffer[],
): OfferGroup[] {
  const localGroups = groupOffersByOriginal(localOffers);
  if (!indexGroups?.length) return localGroups;

  const fromIndex = indexGroups
    .map(indexGroupToOfferGroup)
    .filter((g): g is OfferGroup => g != null && g.note.length > 0);
  const indexedRoots = new Set(
    fromIndex.map(g => g.original.burnTxid.trim().toLowerCase()),
  );
  const localOnly = localGroups.filter(
    g => !indexedRoots.has(g.original.burnTxid.trim().toLowerCase()),
  );

  // If index has the root but is missing a fresher local tip, prefer local tip note/count when newer.
  const merged = fromIndex.map(ig => {
    const local = localGroups.find(
      lg =>
        lg.original.burnTxid.trim().toLowerCase() ===
        ig.original.burnTxid.trim().toLowerCase(),
    );
    if (!local) return ig;
    if (Date.parse(local.latest.at) <= Date.parse(ig.latest.at)) {
      // Still union local-only burns the index has not seen yet.
      const byTxid = new Map<string, LocalOffer>();
      for (const b of [...ig.burns, ...local.burns]) {
        byTxid.set(b.burnTxid.trim().toLowerCase(), b);
      }
      if (byTxid.size === ig.burns.length) return ig;
      const burns = [...byTxid.values()].sort(
        (a, b) => Date.parse(b.at) - Date.parse(a.at),
      );
      return {
        original: ig.original,
        latest: burns[0]!,
        burns,
        totalBurns: burns.length,
        note: ig.note,
      };
    }
    // Combine burns by txid
    const byTxid = new Map<string, LocalOffer>();
    for (const b of [...ig.burns, ...local.burns]) {
      byTxid.set(b.burnTxid.trim().toLowerCase(), b);
    }
    const burns = [...byTxid.values()].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    );
    return {
      original: ig.original,
      latest: burns[0]!,
      burns,
      totalBurns: burns.length,
      note: ig.note,
    };
  });

  return [...merged, ...localOnly]
    .filter(g => g.note.trim().length > 0)
    .sort((a, b) => Date.parse(b.latest.at) - Date.parse(a.latest.at));
}
