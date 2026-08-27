import {
  encodeRelationshipNote,
  MEMORIAL_NOTE_MAX_BYTES,
  MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
  truncateUtf8Bytes,
  utf8ByteLength,
} from '../src/offering/altarFields.js';
import {
  memorialPushdata,
  OFFERING_ID_WLOTUS,
  parseMemorialPushdata,
} from '../src/offering/wlbrMemorial.js';

const PARENT = 'ab'.repeat(32);

describe('burn OP_RETURN budget', () => {
  it('truncates a v1 note to 150 UTF-8 bytes (BURN+DATA fits; leftover SEND is retried)', () => {
    const note = 'n'.repeat(200);
    const parsed = parseMemorialPushdata(
      memorialPushdata(note, OFFERING_ID_WLOTUS),
    );
    expect(utf8ByteLength(parsed.note)).toBe(MEMORIAL_NOTE_MAX_BYTES);
    expect(MEMORIAL_NOTE_MAX_BYTES).toBe(150);
    // Historical: a 140-byte v1 note + leftover ALP SEND was 262 OP_RETURN
    // bytes (max 223). burnOnePrayer retries without that SEND.
  });

  it('truncates a v2 note to 120 UTF-8 bytes', () => {
    const note = 'n'.repeat(200);
    const parsed = parseMemorialPushdata(
      memorialPushdata(note, OFFERING_ID_WLOTUS, PARENT),
    );
    expect(utf8ByteLength(parsed.note)).toBe(MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT);
    expect(MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT).toBe(120);
  });

  it('counts Vietnamese remembrance text in UTF-8 bytes, not characters', () => {
    const vi = 'Dâng lại hoa sen cho ban thờ. '.repeat(8);
    expect(utf8ByteLength(vi)).toBeGreaterThan(MEMORIAL_NOTE_MAX_BYTES);
    expect(utf8ByteLength(vi)).toBeGreaterThan(vi.length);
    const clipped = truncateUtf8Bytes(vi, MEMORIAL_NOTE_MAX_BYTES);
    expect(utf8ByteLength(clipped)).toBeLessThanOrEqual(MEMORIAL_NOTE_MAX_BYTES);
    expect(clipped.length).toBeLessThan(vi.length);
    const parsed = parseMemorialPushdata(
      memorialPushdata(vi, OFFERING_ID_WLOTUS),
    );
    expect(utf8ByteLength(parsed.note)).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES,
    );
    expect(parsed.note.length).toBeLessThan(vi.length);
  });

  it('truncates Chinese and Japanese notes to whole UTF-8 characters', () => {
    const zh = '追思寄语'.repeat(40);
    const ja = 'ありがとう'.repeat(40);
    for (const s of [zh, ja]) {
      const parsed = parseMemorialPushdata(
        memorialPushdata(s, OFFERING_ID_WLOTUS),
      );
      expect(utf8ByteLength(parsed.note)).toBeLessThanOrEqual(
        MEMORIAL_NOTE_MAX_BYTES,
      );
      expect(utf8ByteLength(parsed.note) % 3).toBe(0);
    }
  });

  it('keeps a relationship fragment whole through memorialPushdata', () => {
    const relatedTxid = 'f'.repeat(64);
    const packed = encodeRelationshipNote({
      relationshipType: 'spouse',
      relatedTxid,
    });
    expect(utf8ByteLength(packed)).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    );
    const decoded = parseMemorialPushdata(
      memorialPushdata(packed, OFFERING_ID_WLOTUS, PARENT),
    );
    expect(decoded.note).toBe(packed);
    expect(decoded.note.includes(relatedTxid)).toBe(true);
  });
});
