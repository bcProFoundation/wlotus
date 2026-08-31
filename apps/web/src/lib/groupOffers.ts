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
  /** Original dedication burn this re-offer links to (on-chain DANA v2). */
  parentBurnTxid?: string;
  /** True when this device completed the offer (not an index/view seed). */
  own?: boolean;
  /** Live token id when this row was saved (era check on genesis). */
  tokenId?: string;
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
 * Star topology only: parent = original dedication, or self is the root.
 * Tip-chains (parent = previous re-offer) are not walked — bad/legacy data
 * is skipped at group build time when the named root is missing.
 */
export function resolveOriginalTxid(offer: LocalOffer): string {
  const parent = offer.parentBurnTxid?.trim().toLowerCase();
  if (parent) return parent;
  return offer.burnTxid.trim().toLowerCase();
}

/** True when this burn is a dedication root worth listing (has a name). */
export function isNamedRootOffer(offer: LocalOffer): boolean {
  if (offer.parentBurnTxid?.trim()) return false;
  return (offer.note || '').trim().length > 0;
}

/**
 * Group flat local burns under their original dedications.
 * Orphan re-offers (parent not on device) and empty-name roots are skipped —
 * call {@link seedLocalRootIfMissing} when recording a share-link re-offer.
 */
export function groupOffersByOriginal(offers: LocalOffer[]): OfferGroup[] {
  const byTxid = new Map<string, LocalOffer>();
  for (const o of offers) {
    if (o.burnTxid) byTxid.set(o.burnTxid.trim().toLowerCase(), o);
  }

  const buckets = new Map<string, LocalOffer[]>();
  for (const o of offers) {
    const rootId = resolveOriginalTxid(o);
    const list = buckets.get(rootId);
    if (list) list.push(o);
    else buckets.set(rootId, [o]);
  }

  const groups: OfferGroup[] = [];
  for (const [rootId, members] of buckets) {
    const original = byTxid.get(rootId);
    // Skip: tip-chain / orphan parent not on device / empty dedication name.
    if (!original || !isNamedRootOffer(original)) continue;

    const burns = [...members].sort(byTimeDesc);
    const latest = burns[0]!;
    groups.push({
      original,
      latest,
      burns,
      totalBurns: burns.length,
      note: original.note.trim(),
    });
  }

  groups.sort((a, b) => Date.parse(b.latest.at) - Date.parse(a.latest.at));
  return groups;
}

/**
 * When the user re-offers via a share link, the original burn may not be in
 * localStorage. Seed a named root so Recent can list the dedication.
 */
export function seedLocalRootIfMissing(
  offers: LocalOffer[],
  parentBurnTxid: string,
  dedicationNote: string,
  atMs: number = Date.now() - 1000,
): LocalOffer[] {
  const root = parentBurnTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(root)) return offers;
  const note = dedicationNote.trim();
  if (!note) return offers;
  const hasRoot = offers.some(
    o =>
      o.burnTxid.trim().toLowerCase() === root && !o.parentBurnTxid?.trim(),
  );
  if (hasRoot) return offers;
  const seed: LocalOffer = {
    remintTxid: root,
    burnTxid: root,
    note,
    at: new Date(atMs).toISOString(),
  };
  return [seed, ...offers];
}
