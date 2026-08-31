/**
 * Drop this device's offering history when the live token id changes.
 *
 * Local Recent / reminders key off burn txids. A new genesis clones those
 * burns on-chain, but the old hashes are a different token — keep showing
 * them as "own" would mix eras. First run of this helper (no stored era)
 * adopts the current token without wiping, so deploy this SPA on the
 * current token before genesis.
 */

import { CREATED_ROOTS_KEY } from './createdRoots.js';
import { HIDDEN_RECENT_KEY } from './hiddenRecent.js';
import type { LocalOffer } from './groupOffers.js';

export const LIVE_TOKEN_ERA_KEY = 'wlotus.liveTokenId';
export const ACTIVE_CHALLENGE_KEY = 'wlotus.activeChallenge';
const LOCAL_OFFERS_KEY = 'wlotus.web.offers';

const TOKEN_ID_RE = /^[0-9a-f]{64}$/;

export function normalizeTokenId(raw: string | null | undefined): string | null {
  const id = String(raw ?? '')
    .trim()
    .toLowerCase();
  return TOKEN_ID_RE.test(id) ? id : null;
}

export function readStoredLiveTokenId(): string | null {
  try {
    return normalizeTokenId(localStorage.getItem(LIVE_TOKEN_ERA_KEY));
  } catch {
    return null;
  }
}

/** Device-local rows that belong to a previous genesis. */
export function clearOwnOfferingHistory(): void {
  try {
    localStorage.removeItem(LOCAL_OFFERS_KEY);
    localStorage.removeItem(HIDDEN_RECENT_KEY);
    localStorage.removeItem(CREATED_ROOTS_KEY);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    sessionStorage.removeItem(ACTIVE_CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Adopt `liveTokenId` as this device's era.
 * Returns true when previous-era own history was wiped.
 */
export function syncLocalHistoryToLiveToken(
  liveTokenId: string | null | undefined,
): boolean {
  const live = normalizeTokenId(liveTokenId);
  if (!live) return false;
  const prev = readStoredLiveTokenId();
  if (prev === live) return false;
  const wiped = Boolean(prev);
  if (wiped) clearOwnOfferingHistory();
  try {
    localStorage.setItem(LIVE_TOKEN_ERA_KEY, live);
  } catch {
    /* ignore */
  }
  return wiped;
}

/** Drop rows stamped with a different token (untagged rows stay). */
export function offersForLiveToken(
  offers: LocalOffer[],
  liveTokenId: string | null | undefined,
): LocalOffer[] {
  const live = normalizeTokenId(liveTokenId);
  if (!live) return offers;
  return offers.filter(o => {
    const tagged = normalizeTokenId(o.tokenId);
    return !tagged || tagged === live;
  });
}
