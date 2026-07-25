import {
  groupOffersByOriginal,
  resolveOriginalTxid,
  type LocalOffer,
} from '../apps/web/src/lib/groupOffers.js';

function offer(
  partial: Pick<LocalOffer, 'burnTxid'> & Partial<LocalOffer>,
): LocalOffer {
  return {
    remintTxid: `r-${partial.burnTxid}`,
    note: '',
    at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('resolveOriginalTxid', () => {
  it('returns self when no parent', () => {
    expect(resolveOriginalTxid(offer({ burnTxid: 'A' }))).toBe('a');
  });

  it('uses immediate parent only (star — no tip-chain walk)', () => {
    const c = offer({ burnTxid: 'C', parentBurnTxid: 'B' });
    expect(resolveOriginalTxid(c)).toBe('b');
  });
});

describe('groupOffersByOriginal', () => {
  it('groups star re-offers under the named original', () => {
    const a = offer({
      burnTxid: 'A',
      note: 'for mom',
      at: '2026-01-01T10:00:00.000Z',
      powMs: 90_000,
    });
    const b = offer({
      burnTxid: 'B',
      parentBurnTxid: 'A',
      note: '',
      at: '2026-01-02T10:00:00.000Z',
      powMs: 40_000,
      hashrateHps: 2e6,
    });
    const c = offer({
      burnTxid: 'C',
      parentBurnTxid: 'A',
      note: 'extra',
      at: '2026-01-03T10:00:00.000Z',
      powMs: 20_000,
      hashrateHps: 4e6,
    });
    const other = offer({
      burnTxid: 'X',
      note: 'for dad',
      at: '2026-01-02T12:00:00.000Z',
    });

    const groups = groupOffersByOriginal([c, other, b, a]);
    expect(groups).toHaveLength(2);

    expect(groups[0]!.original.burnTxid).toBe('A');
    expect(groups[0]!.latest.burnTxid).toBe('C');
    expect(groups[0]!.totalBurns).toBe(3);
    expect(groups[0]!.note).toBe('for mom');

    expect(groups[1]!.original.burnTxid).toBe('X');
    expect(groups[1]!.note).toBe('for dad');
  });

  it('skips tip-chain fragments that do not point at a named root', () => {
    const a = offer({
      burnTxid: 'A',
      note: 'for mom',
      at: '2026-01-01T10:00:00.000Z',
    });
    const b = offer({
      burnTxid: 'B',
      parentBurnTxid: 'A',
      at: '2026-01-02T10:00:00.000Z',
    });
    // Legacy tip-chain: parent = previous re-offer, not the original.
    const c = offer({
      burnTxid: 'C',
      parentBurnTxid: 'B',
      at: '2026-01-03T10:00:00.000Z',
    });
    const groups = groupOffersByOriginal([c, b, a]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.original.burnTxid).toBe('A');
    expect(groups[0]!.totalBurns).toBe(2); // A + B; C skipped
    expect(groups[0]!.note).toBe('for mom');
  });

  it('skips orphan re-offers and empty-name roots', () => {
    const emptyRoot = offer({
      burnTxid: 'E',
      note: '   ',
      at: '2026-01-04T00:00:00.000Z',
    });
    const orphan = offer({
      burnTxid: 'O',
      parentBurnTxid: 'gone',
      note: 'fragment',
      at: '2026-01-05T00:00:00.000Z',
    });
    const groups = groupOffersByOriginal([emptyRoot, orphan]);
    expect(groups).toHaveLength(0);
  });
});
