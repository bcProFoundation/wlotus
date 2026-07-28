import type { IndexMemorialGroup } from '../apps/web/src/lib/danaIndexApi.js';
import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';
import { groupOffersByOriginal } from '../apps/web/src/lib/groupOffers.js';
import {
  mergeIndexAndLocalOffers,
  syncIndexMemorialIntoLocal,
} from '../apps/web/src/lib/mergeRecentOffers.js';

const ROOT =
  'd2bc4d61b4e69ab8fb70f694931e7a364955fc875f57b763cae0edf139bfa640';
const B2 = 'b'.repeat(64);
const B3 = 'c'.repeat(64);
const B4 = 'd'.repeat(64);

function indexBurn(
  burnTxid: string,
  opts: { parent?: string; note?: string; at?: string } = {},
) {
  return {
    burnTxid,
    tokenId: 't'.repeat(64),
    note: opts.note ?? '',
    offeringId: 'wlotus',
    version: opts.parent ? 2 : 1,
    parentBurnTxid: opts.parent,
    originalBurnTxid: ROOT,
    blockHeight: 1,
    blockTimestamp: opts.at
      ? Math.floor(Date.parse(opts.at) / 1000)
      : 1_700_000_000,
    timeFirstSeen: opts.at ?? '2026-01-01T00:00:00.000Z',
  };
}

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

describe('syncIndexMemorialIntoLocal', () => {
  it('raises Recent totalBurns to match index History count', () => {
    const local: LocalOffer[] = [
      {
        remintTxid: ROOT,
        burnTxid: ROOT,
        note: 'Ông Cao Lâm Quả',
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        remintTxid: 'r-local',
        burnTxid: B2,
        parentBurnTxid: ROOT,
        note: 'local re-offer',
        at: '2026-01-02T00:00:00.000Z',
        powMs: 120_000,
      },
    ];
    const memorial: IndexMemorialGroup = {
      originalBurnTxid: ROOT,
      originalNote: 'mr\u001fCao Lâm Quả\u001f\u001f\u001f\u001f2001-12-04\u001f\u001f',
      latestBurnTxid: B4,
      latestNote: '',
      totalBurns: 4,
      at: '2026-01-04T00:00:00.000Z',
      burns: [
        indexBurn(ROOT, {
          note: 'name',
          at: '2026-01-01T00:00:00.000Z',
        }),
        indexBurn(B2, { parent: ROOT, at: '2026-01-02T00:00:00.000Z' }),
        indexBurn(B3, { parent: ROOT, at: '2026-01-03T00:00:00.000Z' }),
        indexBurn(B4, { parent: ROOT, at: '2026-01-04T00:00:00.000Z' }),
      ],
    };

    const synced = syncIndexMemorialIntoLocal(local, memorial);
    const groups = groupOffersByOriginal(synced);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.totalBurns).toBe(4);
    // Keep local pow metadata on the burn this device mined.
    const localBurn = synced.find(o => o.burnTxid === B2);
    expect(localBurn?.powMs).toBe(120_000);
    expect(localBurn?.remintTxid).toBe('r-local');
    // Upgrade root to packed Ban thờ note from index.
    expect(groups[0]!.note.includes('\u001f')).toBe(true);
  });

  it('does not import unrelated dedications', () => {
    const other =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const local: LocalOffer[] = [
      {
        remintTxid: 'r',
        burnTxid: other,
        note: 'Other altar',
        at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const memorial: IndexMemorialGroup = {
      originalBurnTxid: ROOT,
      originalNote: 'Synced altar',
      latestBurnTxid: ROOT,
      latestNote: 'Synced altar',
      totalBurns: 1,
      at: '2026-01-02T00:00:00.000Z',
      burns: [indexBurn(ROOT, { note: 'Synced altar' })],
    };
    const synced = syncIndexMemorialIntoLocal(local, memorial);
    const groups = groupOffersByOriginal(synced);
    expect(groups.map(g => g.note).sort()).toEqual([
      'Other altar',
      'Synced altar',
    ]);
  });
});
