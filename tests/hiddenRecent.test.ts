import {
  hideRecentRoot,
  HIDDEN_RECENT_KEY,
  isRecentRootHidden,
  loadHiddenRecentRoots,
  stripOffersForRoot,
  unhideRecentRoot,
} from '../apps/web/src/lib/hiddenRecent.js';
import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';

const ROOT = 'a'.repeat(64);
const CHILD = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
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
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

describe('hiddenRecent', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('persists hide / unhide of dedication roots', () => {
    let set = loadHiddenRecentRoots();
    expect(set.size).toBe(0);
    set = hideRecentRoot(ROOT.toUpperCase(), set);
    expect(isRecentRootHidden(ROOT, set)).toBe(true);
    expect(JSON.parse(localStorage.getItem(HIDDEN_RECENT_KEY)!)).toEqual([
      ROOT,
    ]);
    set = unhideRecentRoot(ROOT, set);
    expect(isRecentRootHidden(ROOT, set)).toBe(false);
    expect(loadHiddenRecentRoots().size).toBe(0);
  });

  it('strips local offers for a hidden root (star children included)', () => {
    const offers: LocalOffer[] = [
      {
        remintTxid: 'r0',
        burnTxid: ROOT,
        note: 'Root',
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        remintTxid: 'r1',
        burnTxid: CHILD,
        note: '',
        at: '2026-01-02T00:00:00.000Z',
        parentBurnTxid: ROOT,
      },
      {
        remintTxid: 'r2',
        burnTxid: OTHER,
        note: 'Keep',
        at: '2026-01-03T00:00:00.000Z',
      },
    ];
    const next = stripOffersForRoot(offers, ROOT);
    expect(next).toHaveLength(1);
    expect(next[0]!.burnTxid).toBe(OTHER);
  });
});
