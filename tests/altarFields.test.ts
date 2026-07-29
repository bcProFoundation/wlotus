import {
  ALTAR_SEP,
  encodeAltarNote,
  emptyAltarFields,
  formatAltarDateInput,
  formatAltarPersonName,
  formatDeathDateInput,
  isAltarPackedNote,
  memorialDisplayName,
  memorialNoteMaxBytes,
  mergeAltarFields,
  MEMORIAL_NOTE_MAX_BYTES,
  MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
  normalizeAltarRelatedTxid,
  normalizeAltarRelationshipType,
  parseAltarNote,
  truncateUtf8Bytes,
  validateAltarFields,
  type AltarFields,
} from '../src/offering/altarFields.js';

describe('altarFields', () => {
  it('round-trips packed altar notes with title', () => {
    const fields: AltarFields = {
      title: 'mr',
      name: 'Cao Lâm Quả',
      note: 'Kính bố',
      birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
      birthYear: '1945',
      deathDate: '2001-10-20',
      deathPlace: 'Bình Định',
      funeralPlace: '',
      relationshipType: '',
      relatedTxid: '',
    };
    const packed = encodeAltarNote(fields);
    expect(isAltarPackedNote(packed)).toBe(true);
    expect(packed.startsWith(`mr${ALTAR_SEP}`)).toBe(true);
    expect(parseAltarNote(packed)).toEqual({
      ...fields,
      funeralPlace: '',
    });
    expect(memorialDisplayName(packed, 'vi')).toBe('Ông Cao Lâm Quả');
    expect(memorialDisplayName(packed, 'en')).toBe('Mr. Cao Lâm Quả');
    expect(formatAltarPersonName(fields, 'zh')).toBe('先生 Cao Lâm Quả');
  });

  it('round-trips a spouse relationship link (compact wire code)', () => {
    const relatedTxid = 'a'.repeat(64);
    const fields: AltarFields = {
      ...emptyAltarFields(),
      name: 'Cao Lâm Quả',
      deathDate: '2001-10-20',
      relationshipType: 'spouse',
      relatedTxid,
    };
    const packed = encodeAltarNote(fields);
    expect(packed.includes(`${ALTAR_SEP}s${ALTAR_SEP}${relatedTxid}`)).toBe(
      true,
    );
    const parsed = parseAltarNote(packed);
    expect(parsed?.relationshipType).toBe('spouse');
    expect(parsed?.relatedTxid).toBe(relatedTxid);
  });

  it('round-trips a parent/child relationship link on a legacy (no-title) pack', () => {
    const relatedTxid = 'b'.repeat(64);
    const legacy = [
      'Cao Lâm Quả',
      '',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
      'child',
      relatedTxid,
    ].join(ALTAR_SEP);
    const parsed = parseAltarNote(legacy);
    expect(parsed?.relationshipType).toBe('child');
    expect(parsed?.relatedTxid).toBe(relatedTxid);
  });

  it('is backward compatible with notes packed before relationship fields existed', () => {
    const legacy = [
      'Cao Lâm Quả',
      '',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
    ].join(ALTAR_SEP);
    const parsed = parseAltarNote(legacy);
    expect(parsed?.relationshipType).toBe('');
    expect(parsed?.relatedTxid).toBe('');
  });

  it('normalizes relationship type and related txid', () => {
    expect(normalizeAltarRelationshipType('SPOUSE')).toBe('spouse');
    expect(normalizeAltarRelationshipType('s')).toBe('spouse');
    expect(normalizeAltarRelationshipType('p')).toBe('parent');
    expect(normalizeAltarRelationshipType('c')).toBe('child');
    expect(normalizeAltarRelationshipType('sibling')).toBe('');
    expect(normalizeAltarRelationshipType(undefined)).toBe('');
    const hex = 'c'.repeat(64);
    expect(normalizeAltarRelatedTxid(`  ${hex.toUpperCase()}  `)).toBe(hex);
    expect(normalizeAltarRelatedTxid('not-a-txid')).toBe('');
  });

  it('requires both relationship type and related txid together', () => {
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        relationshipType: 'spouse',
        relatedTxid: '',
      }),
    ).toBe('relatedTxid');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        relationshipType: '',
        relatedTxid: 'd'.repeat(64),
      }),
    ).toBe('relationshipType');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        relationshipType: 'parent',
        relatedTxid: 'not-hex',
      }),
    ).toBe('relatedTxid');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        relationshipType: 'parent',
        relatedTxid: 'e'.repeat(64),
      }),
    ).toBeNull();
  });

  it('reads legacy name-first packs without title', () => {
    const legacy = [
      'Cao Lâm Quả',
      '',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
    ].join(ALTAR_SEP);
    const parsed = parseAltarNote(legacy);
    expect(parsed?.title).toBe('');
    expect(parsed?.name).toBe('Cao Lâm Quả');
    expect(parsed?.deathDate).toBe('2001-12-04');
    expect(memorialDisplayName(legacy, 'vi')).toBe('Cao Lâm Quả');
  });

  it('requires name and death date', () => {
    expect(validateAltarFields(emptyAltarFields())).toBe('name');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '20-10-2001',
      }),
    ).toBe('deathDate');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
      }),
    ).toBeNull();
  });

  it('leaves plain notes alone for display', () => {
    expect(memorialDisplayName('Tưởng nhớ ông nội')).toBe(
      'Tưởng nhớ ông nội',
    );
    expect(parseAltarNote('plain')).toBeNull();
  });

  it('accepts birth date like death date (YYYY / YYYY-MM / YYYY-MM-DD)', () => {
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        birthYear: '1945-10-20',
      }),
    ).toBeNull();
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
        birthYear: '19-45',
      }),
    ).toBe('birthYear');
    expect(formatAltarDateInput('19451020')).toBe('1945-10-20');
  });

  it('auto-formats death date digits with hyphens', () => {
    expect(formatDeathDateInput('2001')).toBe('2001');
    expect(formatDeathDateInput('200110')).toBe('2001-10');
    expect(formatDeathDateInput('20011020')).toBe('2001-10-20');
    expect(formatDeathDateInput('2001-10-20')).toBe('2001-10-20');
    expect(formatDeathDateInput('200||204')).toBe('2002-04');
  });

  it('truncates by UTF-8 bytes', () => {
    const s = 'á'.repeat(100);
    const out = truncateUtf8Bytes(s, 10);
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(10);
  });

  it('drops optional places to fit OP_RETURN amend budget with a relationship', () => {
    const relatedTxid = 'f'.repeat(64);
    const fields: AltarFields = {
      title: 'mr',
      name: 'Cao Lâm Quả',
      note: '',
      birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
      birthYear: '1945-09-02',
      deathDate: '2001-12-04',
      deathPlace: 'Hải Cảng, Quy Nhơn, Bình Định',
      funeralPlace: '',
      relationshipType: 'spouse',
      relatedTxid,
    };
    const packed = encodeAltarNote(fields, {
      maxBytes: MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    });
    expect(new TextEncoder().encode(packed).length).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    );
    const parsed = parseAltarNote(packed)!;
    expect(parsed.relationshipType).toBe('spouse');
    expect(parsed.relatedTxid).toBe(relatedTxid);
    expect(parsed.name).toBe('Cao Lâm Quả');
    expect(parsed.deathDate).toBe('2001-12-04');
    // Places dropped so the link fits under the amend budget.
    expect(parsed.deathPlace).toBe('');
  });

  it('merges a trimmed relationship amend with the richer root note', () => {
    const relatedTxid = 'a'.repeat(64);
    const root = encodeAltarNote({
      title: 'mr',
      name: 'Cao Lâm Quả',
      note: '',
      birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
      birthYear: '1945-09-02',
      deathDate: '2001-12-04',
      deathPlace: 'Hải Cảng, Quy Nhơn, Bình Định',
      funeralPlace: '',
      relationshipType: '',
      relatedTxid: '',
    });
    const amend = encodeAltarNote(
      {
        title: 'mr',
        name: 'Cao Lâm Quả',
        note: '',
        birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
        birthYear: '1945-09-02',
        deathDate: '2001-12-04',
        deathPlace: 'Hải Cảng, Quy Nhơn, Bình Định',
        funeralPlace: '',
        relationshipType: 'spouse',
        relatedTxid,
      },
      { maxBytes: memorialNoteMaxBytes(true) },
    );
    const merged = mergeAltarFields([amend, root]);
    expect(merged?.relationshipType).toBe('spouse');
    expect(merged?.relatedTxid).toBe(relatedTxid);
    expect(merged?.deathPlace).toBe('Hải Cảng, Quy Nhơn, Bình Định');
    expect(merged?.birthPlace).toBe('Mỹ Thành, Phù Mỹ, Bình Định');
  });

  it('exposes parent-aware note budgets under the OP_RETURN ceiling', () => {
    expect(MEMORIAL_NOTE_MAX_BYTES).toBe(150);
    expect(MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT).toBe(120);
    expect(memorialNoteMaxBytes(false)).toBe(150);
    expect(memorialNoteMaxBytes(true)).toBe(120);
  });
});
