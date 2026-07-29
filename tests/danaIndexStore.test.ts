import { BurnStore, type IndexedBurn } from '../apps/dana-index/src/store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function burn(
  partial: Partial<IndexedBurn> & Pick<IndexedBurn, 'burnTxid' | 'note'>,
): IndexedBurn {
  return {
    tokenId: 'aa'.repeat(32),
    offeringId: 'wlotus',
    version: partial.parentBurnTxid ? 2 : 1,
    originalBurnTxid: partial.parentBurnTxid || partial.burnTxid,
    blockHeight: 1,
    blockTimestamp: partial.blockTimestamp ?? 1_700_000_000,
    timeFirstSeen: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('BurnStore', () => {
  let dir: string;
  let store: BurnStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dana-index-'));
    store = new BurnStore(join(dir, 'burns.json'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('groups re-offers under the original dedication', () => {
    const root =
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    const child =
      'b38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: root,
        note: 'Cao Lâm Quả',
        blockTimestamp: 1_700_000_000,
      }),
    );
    store.upsert(
      burn({
        burnTxid: child,
        note: 'nhớ mãi',
        parentBurnTxid: root,
        blockTimestamp: 1_700_000_100,
      }),
    );

    const recent = store.recentGroups(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.originalNote).toBe('Cao Lâm Quả');
    expect(recent[0]!.latestNote).toBe('nhớ mãi');
    expect(recent[0]!.totalBurns).toBe(2);

    const memorial = store.memorial(child);
    expect(memorial?.originalBurnTxid).toBe(root);
    expect(memorial?.burns.map(b => b.note)).toEqual(['nhớ mãi', 'Cao Lâm Quả']);
  });

  it('skips orphan re-offers when the original is not indexed', () => {
    const root =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const child =
      'b38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: child,
        note: '',
        parentBurnTxid: root,
        blockTimestamp: 1_700_000_100,
      }),
    );
    expect(store.recentGroups(10)).toHaveLength(0);
    expect(store.memorial(child)).toBeNull();
  });

  it('skips empty-name roots', () => {
    const root =
      'c38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: root,
        note: '  ',
        blockTimestamp: 1_700_000_000,
      }),
    );
    expect(store.recentGroups(10)).toHaveLength(0);
  });

  it('searches by name, ranking exact match before contains', () => {
    const rootA =
      'd38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootB =
      'e38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootC =
      'f38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(burn({ burnTxid: rootA, note: 'Cao Lâm Quả' }));
    store.upsert(burn({ burnTxid: rootB, note: 'Quả' }));
    store.upsert(burn({ burnTxid: rootC, note: 'Nguyễn Văn A' }));

    const results = store.searchGroups('quả', 10);
    expect(results.map(r => r.originalBurnTxid)).toEqual([rootB, rootA]);
    expect(store.searchGroups('nguyen', 10)).toHaveLength(1);
    expect(store.searchGroups('', 10)).toHaveLength(0);
    expect(store.searchGroups('không tồn tại', 10)).toHaveLength(0);
  });

  it('breaks ties within the same relevance tier by offering count', () => {
    const rootA =
      '138825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootB =
      '238825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(burn({ burnTxid: rootA, note: 'Cao Lâm Quả' }));
    store.upsert(burn({ burnTxid: rootB, note: 'Cao Lâm An' }));
    // Both match "cao" at the same (contains) tier — rootB gets more
    // fragments, so it should rank first on offering score.
    for (let i = 0; i < 4; i++) {
      store.upsert(
        burn({
          burnTxid: `${rootB.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: rootB,
          blockTimestamp: 1_700_000_100 + i,
        }),
      );
    }

    const results = store.searchGroups('cao', 10);
    expect(results.map(r => r.originalBurnTxid)).toEqual([rootB, rootA]);
  });
});
