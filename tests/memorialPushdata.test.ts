import {
  memorialPushdata,
  parseMemorialPushdata,
  parseParentBurnTxidHex,
  DANA_LOKAD,
  WLBR_LOKAD,
  DANA_VERSION,
  DANA_VERSION_PARENT,
  OFFERING_ID_WLOTUS,
} from '../src/offering/wlbrMemorial.js';

describe('DANA memorial pushdata', () => {
  test('v1 round-trip without parent writes DANA', () => {
    const raw = memorialPushdata('for Anh', OFFERING_ID_WLOTUS);
    expect(raw[4]).toBe(DANA_VERSION);
    const parsed = parseMemorialPushdata(raw);
    expect(parsed).toEqual({
      version: 1,
      offeringId: 'wlotus',
      note: 'for Anh',
      parentBurnTxid: undefined,
      lokad: 'DANA',
    });
    expect(Buffer.from(raw.subarray(0, 4)).equals(Buffer.from(DANA_LOKAD))).toBe(
      true,
    );
  });

  test('v2 encodes parent burn txid for re-offer (empty note)', () => {
    const parent =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const raw = memorialPushdata('', OFFERING_ID_WLOTUS, parent);
    expect(raw[4]).toBe(DANA_VERSION_PARENT);
    const parsed = parseMemorialPushdata(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.offeringId).toBe('wlotus');
    expect(parsed.note).toBe('');
    expect(parsed.parentBurnTxid).toBe(parent);
    expect(parsed.lokad).toBe('DANA');
  });

  test('parser still accepts legacy WLBR payloads', () => {
    const note = new TextEncoder().encode('hi');
    const id = new TextEncoder().encode('wlotus');
    const raw = new Uint8Array(4 + 1 + 1 + id.length + 1 + note.length);
    let o = 0;
    raw.set(WLBR_LOKAD, o);
    o += 4;
    raw[o++] = 1;
    raw[o++] = id.length;
    raw.set(id, o);
    o += id.length;
    raw[o++] = note.length;
    raw.set(note, o);
    const parsed = parseMemorialPushdata(raw);
    expect(parsed.lokad).toBe('WLBR');
    expect(parsed.note).toBe('hi');
  });

  test('parseParentBurnTxidHex rejects bad input', () => {
    expect(parseParentBurnTxidHex(undefined)).toBeUndefined();
    expect(parseParentBurnTxidHex('')).toBeUndefined();
    expect(() => parseParentBurnTxidHex('deadbeef')).toThrow(/64 hex/);
  });
});
