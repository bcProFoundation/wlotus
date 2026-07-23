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
    const a = offer({ burnTxid: 'A' });
    const map = new Map([['A', a]]);
    expect(resolveOriginalTxid(a, map)).toBe('A');
  });

  it('walks to the root through local parents', () => {
    const a = offer({ burnTxid: 'A', note: 'for mom' });
    const b = offer({ burnTxid: 'B', parentBurnTxid: 'A' });
    const c = offer({ burnTxid: 'C', parentBurnTxid: 'B' });
    const map = new Map([
      ['A', a],
      ['B', b],
      ['C', c],
    ]);
    expect(resolveOriginalTxid(c, map)).toBe('A');
    expect(resolveOriginalTxid(b, map)).toBe('A');
  });

  it('stops when parent is missing from local history', () => {
    const b = offer({ burnTxid: 'B', parentBurnTxid: 'missing' });
    const map = new Map([['B', b]]);
    expect(resolveOriginalTxid(b, map)).toBe('B');
  });
});

describe('groupOffersByOriginal', () => {
  it('groups re-offers under the original and exposes last stats + total', () => {
    const a = offer({
      burnTxid: 'A',
      note: 'for mom',
      at: '2026-01-01T10:00:00.000Z',
      powMs: 90_000,
      hashrateHps: 1e6,
    });
    const b = offer({
      burnTxid: 'B',
      parentBurnTxid: 'A',
      note: 'for mom',
      at: '2026-01-02T10:00:00.000Z',
      powMs: 45_000,
      hashrateHps: 2e6,
    });
    const c = offer({
      burnTxid: 'C',
      parentBurnTxid: 'B',
      note: 'for mom',
      at: '2026-01-03T10:00:00.000Z',
      powMs: 30_000,
      hashrateHps: 3e6,
    });
    const other = offer({
      burnTxid: 'X',
      note: 'for dad',
      at: '2026-01-02T12:00:00.000Z',
      powMs: 60_000,
    });

    const groups = groupOffersByOriginal([c, other, b, a]);
    expect(groups).toHaveLength(2);

    expect(groups[0]!.original.burnTxid).toBe('A');
    expect(groups[0]!.latest.burnTxid).toBe('C');
    expect(groups[0]!.totalBurns).toBe(3);
    expect(groups[0]!.note).toBe('for mom');
    expect(groups[0]!.latest.powMs).toBe(30_000);
    expect(groups[0]!.latest.hashrateHps).toBe(3e6);

    expect(groups[1]!.original.burnTxid).toBe('X');
    expect(groups[1]!.totalBurns).toBe(1);
    expect(groups[1]!.note).toBe('for dad');
  });

  it('groups star re-offers that all point at the original', () => {
    const a = offer({
      burnTxid: 'A',
      note: 'for mom',
      at: '2026-01-01T10:00:00.000Z',
      powMs: 90_000,
    });
    const b = offer({
      burnTxid: 'B',
      parentBurnTxid: 'A',
      note: 'for mom',
      at: '2026-01-02T10:00:00.000Z',
      powMs: 40_000,
      hashrateHps: 2e6,
    });
    const c = offer({
      burnTxid: 'C',
      parentBurnTxid: 'A',
      note: 'for mom',
      at: '2026-01-03T10:00:00.000Z',
      powMs: 20_000,
      hashrateHps: 4e6,
    });
    const groups = groupOffersByOriginal([c, b, a]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.original.burnTxid).toBe('A');
    expect(groups[0]!.latest.burnTxid).toBe('C');
    expect(groups[0]!.totalBurns).toBe(3);
    expect(groups[0]!.latest.powMs).toBe(20_000);
  });

  it('treats a burn with missing parent as its own original', () => {
    const orphan = offer({
      burnTxid: 'O',
      parentBurnTxid: 'gone',
      note: 'kept locally',
      at: '2026-01-05T00:00:00.000Z',
    });
    const child = offer({
      burnTxid: 'P',
      parentBurnTxid: 'O',
      note: 'kept locally',
      at: '2026-01-06T00:00:00.000Z',
    });
    const groups = groupOffersByOriginal([child, orphan]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.original.burnTxid).toBe('O');
    expect(groups[0]!.latest.burnTxid).toBe('P');
    expect(groups[0]!.totalBurns).toBe(2);
  });
});
