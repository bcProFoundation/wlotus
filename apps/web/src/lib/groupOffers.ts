/** Local memorial burn recorded in the Offerings SPA (localStorage). */
export interface LocalOffer {
  remintTxid: string;
  burnTxid: string;
  note: string;
  at: string;
  powMs?: number;
  powAttempts?: number;
  hashrateHps?: number;
  bits?: number;
  /** Immediate parent burn this re-offer links to (on-chain DANA v2). */
  parentBurnTxid?: string;
}

/** One dedication thread: original burn + any local re-offers. */
export interface OfferGroup {
  /** Earliest local burn in the parent chain (the dedication). */
  original: LocalOffer;
  /** Most recent burn in the group (re-offer tip + explorer link). */
  latest: LocalOffer;
  /** All burns in the group, newest first. */
  burns: LocalOffer[];
  totalBurns: number;
  /** Dedication text from the original (fallback: latest note). */
  note: string;
}

function byTimeDesc(a: LocalOffer, b: LocalOffer): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

/**
 * Walk parentBurnTxid until the earliest burn still present in `byTxid`.
 * Missing parents (not in local history) stop the walk — that burn is the
 * local "original" for grouping.
 */
export function resolveOriginalTxid(
  offer: LocalOffer,
  byTxid: Map<string, LocalOffer>,
): string {
  let cur = offer;
  const seen = new Set<string>();
  while (
    cur.parentBurnTxid &&
    byTxid.has(cur.parentBurnTxid) &&
    !seen.has(cur.burnTxid)
  ) {
    seen.add(cur.burnTxid);
    cur = byTxid.get(cur.parentBurnTxid)!;
  }
  return cur.burnTxid;
}

/**
 * Group flat local burns under their original dedications.
 * Groups are ordered by most recent activity (latest burn `at`).
 */
export function groupOffersByOriginal(offers: LocalOffer[]): OfferGroup[] {
  const byTxid = new Map<string, LocalOffer>();
  for (const o of offers) {
    if (o.burnTxid) byTxid.set(o.burnTxid, o);
  }

  const buckets = new Map<string, LocalOffer[]>();
  for (const o of offers) {
    const rootId = resolveOriginalTxid(o, byTxid);
    const list = buckets.get(rootId);
    if (list) list.push(o);
    else buckets.set(rootId, [o]);
  }

  const groups: OfferGroup[] = [];
  for (const [rootId, members] of buckets) {
    const burns = [...members].sort(byTimeDesc);
    const latest = burns[0]!;
    const original =
      byTxid.get(rootId) ??
      [...members].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]!;
    const note = (original.note || latest.note || '').trim();
    groups.push({
      original,
      latest,
      burns,
      totalBurns: burns.length,
      note,
    });
  }

  groups.sort((a, b) => Date.parse(b.latest.at) - Date.parse(a.latest.at));
  return groups;
}
