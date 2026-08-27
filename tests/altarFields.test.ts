import {
  ALTAR_SEP,
  encodeAltarNote,
  encodeRelationshipNote,
  emptyAltarFields,
  formatAltarDateInput,
  formatAltarPersonName,
  formatDeathDateInput,
  isAltarPackedNote,
  memorialDisplayName,
  memorialNoteMaxBytes,
  mergeAltarFields,
  canAddRelationship,
  altarRelationships,
  altarHasDeathDate,
  altarIsEvent,
  altarParentRelationshipLabel,
  altarSearchRelevance,
  altarSpouseRelationshipLabel,
  encodeDeathDateNote,
  isDeathDateAmendNote,
  isRelationshipAmendNote,
  MAX_PARENT_RELATIONSHIPS,
  MEMORIAL_NOTE_MAX_BYTES,
  MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
  normalizeAltarRelatedTxid,
  normalizeAltarRelationshipType,
  normalizeAltarKind,
  normalizeAltarDateCalendar,
  parseAltarNote,
  sortAltarRelationships,
  truncateUtf8Bytes,
  utf8ByteLength,
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
      relationships: [],
      kind: '',
      dateCalendar: '',
    };
    const packed = encodeAltarNote(fields);
    expect(isAltarPackedNote(packed)).toBe(true);
    expect(packed.startsWith(`mr${ALTAR_SEP}`)).toBe(true);
    expect(parseAltarNote(packed)).toEqual({
      ...fields,
      funeralPlace: '',
      relationships: [],
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

  it('packs a relationship-only star fragment without altar identity', () => {
    const relatedTxid = 'f'.repeat(64);
    const packed = encodeRelationshipNote(
      { relationshipType: 'spouse', relatedTxid },
      { maxBytes: MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT },
    );
    // type + 64-hex txid + separators is ~74 bytes; fits under the v2 100-byte cap.
    expect(new TextEncoder().encode(packed).length).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    );
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('');
    expect(parsed.deathDate).toBe('');
    expect(parsed.relationshipType).toBe('spouse');
    expect(parsed.relatedTxid).toBe(relatedTxid);
    expect(memorialDisplayName(packed, 'vi')).toBe('');
  });

  it('drops optional memorial message before the relationship link', () => {
    const relatedTxid = 'c'.repeat(64);
    const packed = encodeRelationshipNote(
      {
        relationshipType: 'parent',
        relatedTxid,
        note: 'x'.repeat(200),
      },
      { maxBytes: MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT },
    );
    const parsed = parseAltarNote(packed)!;
    expect(parsed.relationshipType).toBe('parent');
    expect(parsed.relatedTxid).toBe(relatedTxid);
    expect(new TextEncoder().encode(packed).length).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    );
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

  it('requires name; death date optional (living profile)', () => {
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
        deathDate: '',
      }),
    ).toBeNull();
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'A',
        deathDate: '2001',
      }),
    ).toBeNull();
    expect(altarHasDeathDate({ deathDate: '' })).toBe(false);
    expect(altarHasDeathDate({ deathDate: '2001-12-04' })).toBe(true);
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

  it('counts Vietnamese remembrance text in UTF-8 bytes, not characters', () => {
    const vi = 'Dâng lại hoa sen cho ban thờ. '.repeat(8);
    expect(utf8ByteLength(vi)).toBeGreaterThan(vi.length);
    const clipped = truncateUtf8Bytes(vi, MEMORIAL_NOTE_MAX_BYTES);
    expect(utf8ByteLength(clipped)).toBeLessThanOrEqual(MEMORIAL_NOTE_MAX_BYTES);
    expect(clipped.length).toBeLessThan(vi.length);
    const packed = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
      note: vi,
    });
    expect(utf8ByteLength(packed)).toBeLessThanOrEqual(MEMORIAL_NOTE_MAX_BYTES);
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('Cao Lâm Quả');
    expect(parsed.note.length).toBeGreaterThan(0);
    expect(utf8ByteLength(parsed.note)).toBeLessThan(utf8ByteLength(vi));
  });

  it('truncates a long remembrance note instead of dropping it', () => {
    const packed = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
      note: 'n'.repeat(400),
    });
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('Cao Lâm Quả');
    expect(parsed.note.length).toBeGreaterThan(20);
    expect(new TextEncoder().encode(packed).length).toBeLessThanOrEqual(
      MEMORIAL_NOTE_MAX_BYTES,
    );
  });

  it('prefers keeping relationship on the root over long place text', () => {
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
      relationships: [],
      kind: '',
      dateCalendar: '',
    };
    const packed = encodeAltarNote(fields, {
      maxBytes: MEMORIAL_NOTE_MAX_BYTES,
    });
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('Cao Lâm Quả');
    expect(parsed.relationshipType).toBe('spouse');
    expect(parsed.relatedTxid).toBe(relatedTxid);
    // Place text may be dropped so the relationship link fits.
    expect(
      !parsed.deathPlace ||
        parsed.deathPlace === 'Hải Cảng, Quy Nhơn, Bình Định',
    ).toBe(true);
  });

  it('sorts relationships Cha → Mẹ → spouse → children by birth year', () => {
    const father = '1'.repeat(64);
    const mother = '2'.repeat(64);
    const spouse = '3'.repeat(64);
    const childOlder = '4'.repeat(64);
    const childYounger = '5'.repeat(64);
    const parentUnknown = '6'.repeat(64);
    const links = [
      { type: 'child' as const, relatedTxid: childYounger },
      { type: 'spouse' as const, relatedTxid: spouse },
      { type: 'parent' as const, relatedTxid: mother },
      { type: 'child' as const, relatedTxid: childOlder },
      { type: 'parent' as const, relatedTxid: father },
      { type: 'parent' as const, relatedTxid: parentUnknown },
    ];
    const meta = new Map([
      [father, { title: 'mr', birthYear: '1920' }],
      [mother, { title: 'mrs', birthYear: '1925' }],
      [spouse, { title: 'mrs', birthYear: '1950' }],
      [childOlder, { title: 'mr', birthYear: '1970-01-01' }],
      [childYounger, { title: 'mrs', birthYear: '1975' }],
      [parentUnknown, { title: '', birthYear: '' }],
    ]);
    expect(sortAltarRelationships(links, meta).map(l => l.relatedTxid)).toEqual([
      father,
      mother,
      parentUnknown,
      spouse,
      childOlder,
      childYounger,
    ]);
    expect(altarParentRelationshipLabel('mr', 'vi')).toBe('Cha');
    expect(altarParentRelationshipLabel('mrs', 'vi')).toBe('Mẹ');
    expect(altarParentRelationshipLabel('', 'vi')).toBe('Cha/Mẹ');
    expect(altarParentRelationshipLabel('mr', 'en')).toBe('Father');
    expect(altarParentRelationshipLabel('mrs', 'en')).toBe('Mother');
  });

  it('merges a relationship fragment with the richer root note', () => {
    const relatedTxid = 'a'.repeat(64);
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
      birthYear: '1945-09-02',
      deathDate: '2001-12-04',
      deathPlace: 'Hải Cảng, Quy Nhơn, Bình Định',
    });
    const fragment = encodeRelationshipNote(
      { relationshipType: 'spouse', relatedTxid },
      { maxBytes: memorialNoteMaxBytes(true) },
    );
    const merged = mergeAltarFields([fragment, root]);
    expect(merged?.relationshipType).toBe('spouse');
    expect(merged?.relatedTxid).toBe(relatedTxid);
    expect(merged?.relationships).toEqual([
      { type: 'spouse', relatedTxid },
    ]);
    expect(merged?.deathPlace).toBe('Hải Cảng, Quy Nhơn, Bình Định');
    expect(merged?.birthPlace).toBe('Mỹ Thành, Phù Mỹ, Bình Định');
  });

  it('collects multiple relationship fragments (parent max 2)', () => {
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'A',
      deathDate: '2001',
    });
    const parent1 = '1'.repeat(64);
    const parent2 = '2'.repeat(64);
    const parent3 = '3'.repeat(64);
    const spouse = 'a'.repeat(64);
    // notes latest-first
    const merged = mergeAltarFields([
      encodeRelationshipNote({ relationshipType: 'parent', relatedTxid: parent2 }),
      encodeRelationshipNote({ relationshipType: 'spouse', relatedTxid: spouse }),
      encodeRelationshipNote({ relationshipType: 'parent', relatedTxid: parent1 }),
      root,
    ]);
    expect(altarRelationships(merged!)).toEqual([
      { type: 'parent', relatedTxid: parent1 },
      { type: 'spouse', relatedTxid: spouse },
      { type: 'parent', relatedTxid: parent2 },
    ]);
    expect(
      canAddRelationship(altarRelationships(merged!), {
        type: 'parent',
        relatedTxid: parent3,
      }),
    ).toBe('parentMax');
    expect(
      canAddRelationship(altarRelationships(merged!), {
        type: 'child',
        relatedTxid: 'b'.repeat(64),
      }),
    ).toBeNull();
    expect(
      canAddRelationship(altarRelationships(merged!), {
        type: 'spouse',
        relatedTxid: 'c'.repeat(64),
      }),
    ).toBeNull();
    expect(MAX_PARENT_RELATIONSHIPS).toBe(2);
  });

  it('merges draft singular relationship into existing relationships list', () => {
    const existing = 'a'.repeat(64);
    const draft = 'b'.repeat(64);
    const fields: AltarFields = {
      ...emptyAltarFields(),
      name: 'A',
      relationships: [{ type: 'spouse', relatedTxid: existing }],
      relationshipType: 'parent',
      relatedTxid: draft,
    };
    expect(altarRelationships(fields)).toEqual([
      { type: 'spouse', relatedTxid: existing },
      { type: 'parent', relatedTxid: draft },
    ]);
  });

  it('labels spouse from this altar honorific', () => {
    expect(altarSpouseRelationshipLabel('mr', 'vi')).toBe('Vợ');
    expect(altarSpouseRelationshipLabel('mrs', 'vi')).toBe('Chồng');
    expect(altarSpouseRelationshipLabel('', 'vi')).toBe('Vợ/Chồng');
    expect(altarSpouseRelationshipLabel('mr', 'en')).toBe('Wife');
    expect(altarSpouseRelationshipLabel('mrs', 'en')).toBe('Husband');
  });

  it('merges a death-date fragment onto a living root', () => {
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Nguyễn Văn A',
      birthYear: '1950',
      deathDate: '',
    });
    expect(altarHasDeathDate(parseAltarNote(root)!)).toBe(false);
    const fragment = encodeDeathDateNote({
      deathDate: '2020-01-15',
      deathPlace: 'Hà Nội',
      funeralPlace: '',
    });
    expect(isDeathDateAmendNote(fragment)).toBe(true);
    expect(isDeathDateAmendNote(root)).toBe(false);
    expect(isRelationshipAmendNote(fragment)).toBe(false);
    const merged = mergeAltarFields([fragment, root]);
    expect(merged?.name).toBe('Nguyễn Văn A');
    expect(merged?.deathDate).toBe('2020-01-15');
    expect(merged?.deathPlace).toBe('Hà Nội');
    expect(altarHasDeathDate(merged!)).toBe(true);
  });

  it('detects relationship-only star fragments for creator gates', () => {
    const related = 'a'.repeat(64);
    const fragment = encodeRelationshipNote({
      relationshipType: 'child',
      relatedTxid: related,
    });
    expect(isRelationshipAmendNote(fragment)).toBe(true);
    expect(isDeathDateAmendNote(fragment)).toBe(false);
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      birthYear: '1945',
      deathDate: '2020-01-15',
    });
    expect(isRelationshipAmendNote(root)).toBe(false);
  });

  it('exposes parent-aware note budgets under the OP_RETURN ceiling', () => {
    expect(MEMORIAL_NOTE_MAX_BYTES).toBe(150);
    expect(MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT).toBe(100);
    expect(memorialNoteMaxBytes(false)).toBe(150);
    expect(memorialNoteMaxBytes(true)).toBe(100);
  });

  it('round-trips an event altar with lunar calendar preference', () => {
    const packed = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Nepal 26/08',
      note: 'Tưởng niệm',
      deathDate: '2026-08-26',
      deathPlace: 'Kathmandu',
      kind: 'event',
      dateCalendar: 'lunar',
    });
    expect(packed.includes(`${ALTAR_SEP}e${ALTAR_SEP}l`)).toBe(true);
    const parsed = parseAltarNote(packed)!;
    expect(parsed.kind).toBe('event');
    expect(parsed.dateCalendar).toBe('lunar');
    expect(parsed.deathDate).toBe('2026-08-26');
    expect(parsed.deathPlace).toBe('Kathmandu');
    expect(altarIsEvent(parsed)).toBe(true);
    expect(normalizeAltarKind('e')).toBe('event');
    expect(normalizeAltarDateCalendar('l')).toBe('lunar');
    expect(normalizeAltarDateCalendar('s')).toBe('solar');
  });

  it('requires a date for event altars', () => {
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'Nepal',
        kind: 'event',
      }),
    ).toBe('deathDate');
    expect(
      validateAltarFields({
        ...emptyAltarFields(),
        name: 'Nepal',
        kind: 'event',
        deathDate: '2026-08-26',
      }),
    ).toBeNull();
  });

  it('packs dateCalendar on a death-date fragment without setting event kind', () => {
    const fragment = encodeDeathDateNote({
      deathDate: '2020-01-15',
      deathPlace: '',
      funeralPlace: '',
      dateCalendar: 'lunar',
    });
    const parsed = parseAltarNote(fragment)!;
    expect(isDeathDateAmendNote(fragment)).toBe(true);
    expect(parsed.kind).toBe('');
    expect(parsed.dateCalendar).toBe('lunar');
    expect(parsed.deathDate).toBe('2020-01-15');
  });

  it('merges event kind and calendar from the latest packed note', () => {
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Nepal 26/08',
      deathDate: '2026-08-26',
      kind: 'event',
      dateCalendar: 'solar',
    });
    const fragment = encodeDeathDateNote({
      deathDate: '2026-08-26',
      deathPlace: '',
      funeralPlace: '',
      dateCalendar: 'lunar',
    });
    const merged = mergeAltarFields([fragment, root]);
    expect(merged?.kind).toBe('event');
    expect(merged?.dateCalendar).toBe('lunar');
  });
});

describe('altarSearchRelevance', () => {
  it('treats honorific-prefixed display names as prefix match on bare name', () => {
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'cao', 'Cao Lâm Quả')).toBe(2);
    expect(altarSearchRelevance('Cao Lâm Quả', 'cao')).toBe(2);
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'cao')).toBe(1);
  });
});
