import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';
import {
  CREATED_ROOTS_KEY,
  markLocalCreatedRoot,
} from '../apps/web/src/lib/createdRoots.js';
import {
  HIDDEN_RECENT_KEY,
  hideRecentRoot,
  loadHiddenRecentRoots,
} from '../apps/web/src/lib/hiddenRecent.js';
import {
  ACTIVE_CHALLENGE_KEY,
  LIVE_TOKEN_ERA_KEY,
  clearOwnOfferingHistory,
  isSpaBakePlaceholderTokenId,
  offersForLiveToken,
  resolveBakedLiveTokenId,
  stampOffersForLiveToken,
  syncLocalHistoryToLiveToken,
} from '../apps/web/src/lib/tokenEra.js';
import { SPA_BAKE_PLACEHOLDER_TOKEN_ID } from '../src/params/wlotusTokens.js';

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);
const ROOT = 'c'.repeat(64);
const LOCAL_OFFERS_KEY = 'wlotus.web.offers';
const PLACEHOLDER = SPA_BAKE_PLACEHOLDER_TOKEN_ID;

function installMemoryStorage(): void {
  const make = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, String(v));
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => {
        map.clear();
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
  };
  const local = make();
  const session = make();
  Object.defineProperty(globalThis, 'localStorage', {
    value: local,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: session,
    configurable: true,
    writable: true,
  });
}

function seedOwnHistory(): void {
  const offer: LocalOffer = {
    remintTxid: 'd'.repeat(64),
    burnTxid: ROOT,
    note: 'Old altar',
    at: '2026-08-01T00:00:00.000Z',
    own: true,
    tokenId: TOKEN_A,
  };
  localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify([offer]));
  markLocalCreatedRoot(ROOT);
  hideRecentRoot(ROOT, loadHiddenRecentRoots());
  sessionStorage.setItem(
    ACTIVE_CHALLENGE_KEY,
    JSON.stringify({ challengeId: 'x', installId: 'y' }),
  );
}

describe('tokenEra', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('adopts the first live token without wiping existing Recent', () => {
    seedOwnHistory();
    localStorage.removeItem(LIVE_TOKEN_ERA_KEY);
    expect(syncLocalHistoryToLiveToken(TOKEN_A)).toBe(false);
    expect(localStorage.getItem(LIVE_TOKEN_ERA_KEY)).toBe(TOKEN_A);
    expect(JSON.parse(localStorage.getItem(LOCAL_OFFERS_KEY)!)).toHaveLength(1);
    expect(loadHiddenRecentRoots().has(ROOT)).toBe(true);
  });

  it('clears own offering history when the live token changes', () => {
    seedOwnHistory();
    expect(syncLocalHistoryToLiveToken(TOKEN_A)).toBe(false);
    expect(syncLocalHistoryToLiveToken(TOKEN_B)).toBe(true);
    expect(localStorage.getItem(LIVE_TOKEN_ERA_KEY)).toBe(TOKEN_B);
    expect(localStorage.getItem(LOCAL_OFFERS_KEY)).toBeNull();
    expect(localStorage.getItem(HIDDEN_RECENT_KEY)).toBeNull();
    expect(localStorage.getItem(CREATED_ROOTS_KEY)).toBeNull();
    expect(sessionStorage.getItem(ACTIVE_CHALLENGE_KEY)).toBeNull();
  });

  it('does not adopt the old SPA dryrun bake default as an era', () => {
    seedOwnHistory();
    expect(isSpaBakePlaceholderTokenId(PLACEHOLDER)).toBe(true);
    expect(syncLocalHistoryToLiveToken(PLACEHOLDER)).toBe(false);
    expect(localStorage.getItem(LIVE_TOKEN_ERA_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(LOCAL_OFFERS_KEY)!)).toHaveLength(1);
  });

  it('adopts the live token without wiping when the stored era is the bake default', () => {
    seedOwnHistory();
    localStorage.setItem(LIVE_TOKEN_ERA_KEY, PLACEHOLDER);
    expect(syncLocalHistoryToLiveToken(TOKEN_B)).toBe(false);
    expect(localStorage.getItem(LIVE_TOKEN_ERA_KEY)).toBe(TOKEN_B);
    expect(JSON.parse(localStorage.getItem(LOCAL_OFFERS_KEY)!)).toHaveLength(1);
  });

  it('is a no-op when the live token is unchanged', () => {
    seedOwnHistory();
    syncLocalHistoryToLiveToken(TOKEN_A);
    expect(syncLocalHistoryToLiveToken(TOKEN_A.toUpperCase())).toBe(false);
    expect(JSON.parse(localStorage.getItem(LOCAL_OFFERS_KEY)!)).toHaveLength(1);
  });

  it('drops rows stamped for a different token and keeps untagged / live / bake-placeholder rows', () => {
    const offers: LocalOffer[] = [
      {
        remintTxid: '',
        burnTxid: ROOT,
        note: 'legacy',
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        remintTxid: '',
        burnTxid: 'd'.repeat(64),
        note: 'old era',
        at: '2026-01-02T00:00:00.000Z',
        tokenId: TOKEN_A,
      },
      {
        remintTxid: '',
        burnTxid: 'e'.repeat(64),
        note: 'live',
        at: '2026-01-03T00:00:00.000Z',
        tokenId: TOKEN_B,
      },
      {
        remintTxid: 'f'.repeat(64),
        burnTxid: '1'.repeat(64),
        note: 'new bake-stamped',
        at: '2026-09-01T00:00:00.000Z',
        own: true,
        tokenId: PLACEHOLDER,
      },
    ];
    const next = offersForLiveToken(offers, TOKEN_B);
    expect(next.map(o => o.note)).toEqual([
      'legacy',
      'live',
      'new bake-stamped',
    ]);
    expect(
      stampOffersForLiveToken(next, TOKEN_B).map(o => o.tokenId),
    ).toEqual([TOKEN_B, TOKEN_B, TOKEN_B]);
  });

  it('clearOwnOfferingHistory does not touch install id', () => {
    localStorage.setItem('wlotus.installId', 'keep-me');
    seedOwnHistory();
    clearOwnOfferingHistory();
    expect(localStorage.getItem('wlotus.installId')).toBe('keep-me');
    expect(localStorage.getItem(LOCAL_OFFERS_KEY)).toBeNull();
  });

  it('resolveBakedLiveTokenId ignores empty and the dryrun placeholder', () => {
    expect(resolveBakedLiveTokenId(undefined, TOKEN_B)).toBe(TOKEN_B);
    expect(resolveBakedLiveTokenId('', TOKEN_B)).toBe(TOKEN_B);
    expect(resolveBakedLiveTokenId(PLACEHOLDER, TOKEN_B)).toBe(TOKEN_B);
    expect(resolveBakedLiveTokenId(TOKEN_A, TOKEN_B)).toBe(TOKEN_A);
  });
});
