import {
  memorialPushdata,
  parseMemorialPushdata,
  parseParentBurnTxidHex,
  WLBR_LOKAD,
  WLBR_VERSION,
  WLBR_VERSION_PARENT,
  OFFERING_ID_WLOTUS,
} from '../src/offering/wlbrMemorial.js';

describe('WLBR memorial pushdata', () => {
  test('v1 round-trip without parent', () => {
    const raw = memorialPushdata('for Anh', OFFERING_ID_WLOTUS);
    expect(raw[4]).toBe(WLBR_VERSION);
    const parsed = parseMemorialPushdata(raw);
    expect(parsed).toEqual({
      version: 1,
      offeringId: 'wlotus',
      note: 'for Anh',
      parentBurnTxid: undefined,
    });
    expect(Buffer.from(raw.subarray(0, 4)).equals(Buffer.from(WLBR_LOKAD))).toBe(
      true,
    );
  });

  test('v2 encodes parent burn txid for re-offer (empty note)', () => {
    const parent =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const raw = memorialPushdata('', OFFERING_ID_WLOTUS, parent);
    expect(raw[4]).toBe(WLBR_VERSION_PARENT);
    const parsed = parseMemorialPushdata(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.offeringId).toBe('wlotus');
    expect(parsed.note).toBe('');
    expect(parsed.parentBurnTxid).toBe(parent);
  });

  test('parseParentBurnTxidHex rejects bad input', () => {
    expect(parseParentBurnTxidHex(undefined)).toBeUndefined();
    expect(parseParentBurnTxidHex('')).toBeUndefined();
    expect(() => parseParentBurnTxidHex('deadbeef')).toThrow(/64 hex/);
  });
});
