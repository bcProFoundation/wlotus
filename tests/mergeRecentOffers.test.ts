import type { IndexMemorialGroup } from '../apps/web/src/lib/danaIndexApi.js';
import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';
import { mergeIndexAndLocalOffers } from '../apps/web/src/lib/mergeRecentOffers.js';

describe('mergeIndexAndLocalOffers', () => {
  it('falls back to local when index is empty', () => {
    const local: LocalOffer[] = [
      {
        remintTxid: 'r1',
        burnTxid: 'a'.repeat(64),
        note: 'Local only',
        at: '2026-01-02T00:00:00.000Z',
      },
    ];
    const groups = mergeIndexAndLocalOffers(null, local);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.note).toBe('Local only');
  });

  it('keeps named index groups and skips empty-name index rows', () => {
    const root =
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    const orphanChild =
      'b38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const other =
      'c38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const index: IndexMemorialGroup[] = [
      {
        originalBurnTxid: root,
        originalNote: 'From index',
        latestBurnTxid: root,
        latestNote: 'From index',
        totalBurns: 1,
        at: '2026-01-03T00:00:00.000Z',
        burns: [
          {
            burnTxid: root,
            tokenId: 't'.repeat(64),
            note: 'From index',
            offeringId: 'wlotus',
            version: 1,
            originalBurnTxid: root,
            blockHeight: 1,
            blockTimestamp: 1_700_000_000,
            timeFirstSeen: '2026-01-03T00:00:00.000Z',
          },
        ],
      },
      {
        // Index sometimes surfaces orphan re-offers as fake roots — drop them.
        originalBurnTxid: orphanChild,
        originalNote: '',
        latestBurnTxid: orphanChild,
        latestNote: '',
        totalBurns: 1,
        at: '2026-01-05T00:00:00.000Z',
        burns: [
          {
            burnTxid: orphanChild,
            tokenId: 't'.repeat(64),
            note: '',
            offeringId: 'wlotus',
            version: 2,
            parentBurnTxid: root,
            originalBurnTxid: root,
            blockHeight: 2,
            blockTimestamp: 1_700_000_200,
            timeFirstSeen: '2026-01-05T00:00:00.000Z',
          },
        ],
      },
    ];
    const local: LocalOffer[] = [
      {
        remintTxid: 'r2',
        burnTxid: other,
        note: 'Device only',
        at: '2026-01-04T00:00:00.000Z',
      },
    ];
    const groups = mergeIndexAndLocalOffers(index, local);
    expect(groups.map(g => g.note)).toEqual(['Device only', 'From index']);
  });
});
