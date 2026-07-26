/**
 * Device-local hide list for Recent rows (cannot delete on-chain burns).
 */

import { resolveOriginalTxid, type LocalOffer } from './groupOffers.js';

export const HIDDEN_RECENT_KEY = 'wlotus.web.hiddenRecent';

function norm(txid: string): string {
  return txid.trim().toLowerCase();
}

export function loadHiddenRecentRoots(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_RECENT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .filter((x): x is string => typeof x === 'string' && /^[0-9a-fA-F]{64}$/.test(x))
        .map(norm),
    );
  } catch {
    return new Set();
  }
}

export function saveHiddenRecentRoots(roots: Set<string>): void {
  localStorage.setItem(HIDDEN_RECENT_KEY, JSON.stringify([...roots]));
}

/** Hide a dedication root on this device. */
export function hideRecentRoot(rootTxid: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  next.add(norm(rootTxid));
  saveHiddenRecentRoots(next);
  return next;
}

/** If the user engages with a root again, show it in Recent. */
export function unhideRecentRoot(rootTxid: string, current: Set<string>): Set<string> {
  const id = norm(rootTxid);
  if (!current.has(id)) return current;
  const next = new Set(current);
  next.delete(id);
  saveHiddenRecentRoots(next);
  return next;
}

/** Drop local burns that belong to a hidden root. */
export function stripOffersForRoot(
  offers: LocalOffer[],
  rootTxid: string,
): LocalOffer[] {
  const root = norm(rootTxid);
  return offers.filter(o => resolveOriginalTxid(o) !== root);
}

export function isRecentRootHidden(
  rootTxid: string,
  hidden: Set<string>,
): boolean {
  return hidden.has(norm(rootTxid));
}
