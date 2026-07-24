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
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
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
});
