import type { IndexMemorialGroup } from '../apps/web/src/lib/danaIndexApi.js';
import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';
import { groupOffersByOriginal } from '../apps/web/src/lib/groupOffers.js';
import { reconcileLocalOffersWithIndex } from '../apps/web/src/lib/reconcileRecentOffers.js';

const LIVE = 'a41bf9d03961a2be83f854c8cea0b3fddf7e275ff3695d9848046052d6db3df9';
const ROOT = '51a2211da2aa54ed8eea53ea17e8eb848053df066f03d403bde1aac9c03112ad';
const OLD_ROOT = '22df868bf1111111111111111111111111111111111111111111111111111111';
const NEW_BURN = '6afae3da326c3d4ebd5070ef08eaf7dcbcffd63549c278134564c8b0c24c2e3a';
const NOW = Date.parse('2026-09-01T13:00:00.000Z');

function ownOffer(
  burnTxid: string,
  at: string,
  extra: Partial<LocalOffer> = {},
): LocalOffer {
  return {
    remintTxid: 'e'.repeat(64),
    burnTxid,
    note: extra.note ?? '\u001fNepal 26/08',
    at,
    own: true,
    ...extra,
  };
}

function memorial(
  originalBurnTxid: string,
  burns: { burnTxid: string; parent?: string; at: string; note?: string }[],
): IndexMemorialGroup {
  return {
    originalBurnTxid,
    originalNote: '\u001fNepal 26/08',
    latestBurnTxid: burns[0]!.burnTxid,
    latestNote: burns[0]!.note ?? '',
    totalBurns: burns.length,
    at: burns[0]!.at,
    burns: burns.map(b => ({
      burnTxid: b.burnTxid,
      tokenId: LIVE,
      note: b.note ?? '',
      offeringId: 'wlotus',
      version: b.parent ? 2 : 1,
      parentBurnTxid: b.parent,
      originalBurnTxid,
      blockHeight: 1,
      blockTimestamp: Math.floor(Date.parse(b.at) / 1000),
      timeFirstSeen: b.at,
    })),
  };
}

describe('reconcileLocalOffersWithIndex', () => {
  it('drops old-token roots that 404 and unions live index burns into Recent', async () => {
    const local: LocalOffer[] = [
      ownOffer(OLD_ROOT, '2026-08-27T14:05:05.000Z', {
        remintTxid: OLD_ROOT,
        note: '\u001fVu Lan',
      }),
      ownOffer(ROOT, '2026-08-27T14:05:05.000Z', {
        remintTxid: 'b'.repeat(64),
      }),
    ];
    const nepal = memorial(ROOT, [
      {
        burnTxid: NEW_BURN,
        parent: ROOT,
        at: '2026-09-01T07:45:41.000Z',
      },
      {
        burnTxid: ROOT,
        at: '2026-08-26T00:00:00.000Z',
        note: '\u001fNepal 26/08',
      },
    ]);
    const next = await reconcileLocalOffersWithIndex(local, {
      liveTokenId: LIVE,
      nowMs: NOW,
      fetchMemorial: async txid => (txid === ROOT ? nepal : null),
    });
    const groups = groupOffersByOriginal(next);
    expect(groups.map(g => g.original.burnTxid)).toEqual([ROOT]);
    expect(groups[0]!.totalBurns).toBe(2);
    expect(groups[0]!.latest.burnTxid).toBe(NEW_BURN);
    expect(next.every(o => o.tokenId === LIVE)).toBe(true);
  });

  it('keeps a just-mined root the index has not seen yet', async () => {
    const fresh = ownOffer('f'.repeat(64), '2026-09-01T12:30:00.000Z', {
      note: '\u001fNew altar',
    });
    const next = await reconcileLocalOffersWithIndex([fresh], {
      liveTokenId: LIVE,
      nowMs: NOW,
      fetchMemorial: async () => null,
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.burnTxid).toBe(fresh.burnTxid);
    expect(next[0]!.tokenId).toBe(LIVE);
  });

  it('keeps a root when the index request fails', async () => {
    const row = ownOffer(ROOT, '2026-08-01T00:00:00.000Z');
    const next = await reconcileLocalOffersWithIndex([row], {
      liveTokenId: LIVE,
      nowMs: NOW,
      fetchMemorial: async () => {
        throw new Error('INDEX_HTML');
      },
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.burnTxid).toBe(ROOT);
  });
});
