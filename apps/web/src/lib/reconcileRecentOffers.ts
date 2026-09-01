/**
 * Align device Recent with the live-token dana-index.
 *
 * Untagged local rows can be a previous genesis (same names, different
 * burn txids) or the current token before `tokenId` was stamped. Index
 * 404 → drop stale roots. Index hit → union burns so today's offering
 * shows up even when localStorage missed the save.
 */

import type { IndexMemorialGroup } from './danaIndexApi.js';
import { syncIndexMemorialIntoLocal } from './mergeRecentOffers.js';
import { resolveOriginalTxid, type LocalOffer } from './groupOffers.js';
import {
  isOwnOffer,
  pruneUnownedAndExpiredOffers,
  recentOwnOfferRoots,
} from './ownOffers.js';
import {
  offersForLiveToken,
  stampOffersForLiveToken,
} from './tokenEra.js';

/** Keep a just-mined root that the index has not ingested yet. */
export const INDEX_LAG_GRACE_MS = 48 * 60 * 60 * 1000;

function lastOwnAtMs(offers: LocalOffer[], root: string): number {
  let max = 0;
  for (const o of offers) {
    if (resolveOriginalTxid(o) !== root || !isOwnOffer(o)) continue;
    const at = Date.parse(o.at);
    if (Number.isFinite(at) && at > max) max = at;
  }
  return max;
}

function memorialTokenId(memorial: IndexMemorialGroup): string | null {
  for (const b of memorial.burns) {
    const id = (b.tokenId || '').trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(id)) return id;
  }
  return null;
}

export async function reconcileLocalOffersWithIndex(
  offers: LocalOffer[],
  opts: {
    liveTokenId: string;
    fetchMemorial: (txid: string) => Promise<IndexMemorialGroup | null>;
    nowMs?: number;
  },
): Promise<LocalOffer[]> {
  const now = opts.nowMs ?? Date.now();
  const live = opts.liveTokenId.trim().toLowerCase();
  let next = offersForLiveToken(
    pruneUnownedAndExpiredOffers(offers, now),
    live,
  );
  const roots = [...recentOwnOfferRoots(next, now)];
  if (roots.length === 0) return stampOffersForLiveToken(next, live);

  const keep = new Set<string>();
  const memorials: IndexMemorialGroup[] = [];

  await Promise.all(
    roots.map(async root => {
      let memorial: IndexMemorialGroup | null;
      try {
        memorial = await opts.fetchMemorial(root);
      } catch {
        keep.add(root);
        return;
      }
      if (!memorial) {
        if (now - lastOwnAtMs(next, root) <= INDEX_LAG_GRACE_MS) {
          keep.add(root);
        }
        return;
      }
      const memToken = memorialTokenId(memorial);
      if (memToken && memToken !== live) return;
      memorials.push(memorial);
      keep.add(root);
    }),
  );

  next = next.filter(o => keep.has(resolveOriginalTxid(o)));
  for (const memorial of memorials) {
    next = syncIndexMemorialIntoLocal(next, memorial);
  }
  return stampOffersForLiveToken(
    pruneUnownedAndExpiredOffers(next, now),
    live,
  );
}
