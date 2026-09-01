/**
 * Drop this device's offering history when the live token id changes.
 *
 * Local Recent / reminders key off burn txids. A new genesis clones those
 * burns on-chain, but the old hashes are a different token — keep showing
 * them as "own" would mix eras. First run of this helper (no stored era)
 * adopts the current token without wiping, so deploy this SPA on the
 * current token before genesis.
 *
 * Never adopt the old unset-`VITE_PRAYER_TOKEN_ID` dryrun default as an era.
 * Test deploys that omitted the Actions var baked that placeholder, then
 * `/api/status` reported the live felt id — ping-ponging those two wiped
 * new offerings and left untagged old-token Recent rows in place.
 */

import { SPA_BAKE_PLACEHOLDER_TOKEN_ID } from '../../../../src/params/wlotusTokens.js';
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

/** True when `id` is the old SPA dryrun fallback, not a real desk token. */
export function isSpaBakePlaceholderTokenId(
  raw: string | null | undefined,
): boolean {
  const id = normalizeTokenId(raw);
  return id === SPA_BAKE_PLACEHOLDER_TOKEN_ID;
}

export function readStoredLiveTokenId(): string | null {
  try {
    return normalizeTokenId(localStorage.getItem(LIVE_TOKEN_ERA_KEY));
  } catch {
    return null;
  }
}

function writeStoredLiveTokenId(live: string): void {
  try {
    localStorage.setItem(LIVE_TOKEN_ERA_KEY, live);
  } catch {
    /* ignore quota / private mode */
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
  if (!live || isSpaBakePlaceholderTokenId(live)) return false;
  const prev = readStoredLiveTokenId();
  if (prev === live) return false;
  // Bake-default leftover is not a real genesis — adopt the live id without
  // wiping (index reconcile drops old-token roots; new burns stay).
  const leftoverPlaceholder = isSpaBakePlaceholderTokenId(prev);
  const wiped = Boolean(prev) && !leftoverPlaceholder;
  if (wiped) clearOwnOfferingHistory();
  writeStoredLiveTokenId(live);
  return wiped;
}

function offerTokenId(offer: LocalOffer): string | null {
  const tagged = normalizeTokenId(offer.tokenId);
  if (!tagged || isSpaBakePlaceholderTokenId(tagged)) return null;
  return tagged;
}

/** Drop rows stamped with a different token (untagged / bake-placeholder stay). */
export function offersForLiveToken(
  offers: LocalOffer[],
  liveTokenId: string | null | undefined,
): LocalOffer[] {
  const live = normalizeTokenId(liveTokenId);
  if (!live || isSpaBakePlaceholderTokenId(live)) return offers;
  return offers.filter(o => {
    const tagged = offerTokenId(o);
    return !tagged || tagged === live;
  });
}

/** Stamp leftover placeholder / untagged rows with the live token. */
export function stampOffersForLiveToken(
  offers: LocalOffer[],
  liveTokenId: string | null | undefined,
): LocalOffer[] {
  const live = normalizeTokenId(liveTokenId);
  if (!live || isSpaBakePlaceholderTokenId(live)) return offers;
  return offers.map(o => {
    const tagged = offerTokenId(o);
    if (tagged === live) return o;
    if (tagged) return o;
    return { ...o, tokenId: live };
  });
}
