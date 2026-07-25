/**
 * Merge global dana-index groups with this device's localStorage burns.
 */

import type { IndexMemorialGroup } from './danaIndexApi.js';
import type { LocalOffer, OfferGroup } from './groupOffers.js';
import { groupOffersByOriginal, isNamedRootOffer } from './groupOffers.js';

function indexGroupToOfferGroup(g: IndexMemorialGroup): OfferGroup | null {
  const burns: LocalOffer[] = g.burns.map(b => ({
    remintTxid: '',
    burnTxid: b.burnTxid,
    note: b.note,
    at:
      b.blockTimestamp != null && b.blockTimestamp > 0
        ? new Date(b.blockTimestamp * 1000).toISOString()
        : b.timeFirstSeen,
    parentBurnTxid: b.parentBurnTxid,
  }));
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
  const indexedRoots = new Set(fromIndex.map(g => g.original.burnTxid));
  const localOnly = localGroups.filter(
    g => !indexedRoots.has(g.original.burnTxid),
  );

  // If index has the root but is missing a fresher local tip, prefer local tip note/count when newer.
  const merged = fromIndex.map(ig => {
    const local = localGroups.find(
      lg => lg.original.burnTxid === ig.original.burnTxid,
    );
    if (!local) return ig;
    if (Date.parse(local.latest.at) <= Date.parse(ig.latest.at)) return ig;
    // Combine burns by txid
    const byTxid = new Map<string, LocalOffer>();
    for (const b of [...ig.burns, ...local.burns]) {
      byTxid.set(b.burnTxid, b);
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
