import {
  ALTAR_SEP,
  encodeAltarNote,
  encodeRelationshipNote,
  emptyAltarFields,
  formatAltarDateInput,
  formatAltarPersonName,
  parseAltarPersonName,
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
  encodeListNote,
  isDeathDateAmendNote,
  isListAmendNote,
  isRelationshipAmendNote,
  altarIsTrendingEligible,
  altarIsCatalogTrendingName,
  altarNotesAreTrendingEligible,
  MAX_PARENT_RELATIONSHIPS,
  MEMORIAL_NOTE_MAX_BYTES,
  MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
  normalizeAltarRelatedTxid,
  normalizeAltarRelationshipType,
  normalizeAltarKind,
  normalizeAltarDateCalendar,
  parseAltarNote,
  prepareDanaNote,
  reofferExtraNote,
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
      listed: null,
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

  it('parses a combined title+name back to wire honorific + bare name', () => {
    expect(parseAltarPersonName('Ông Cao Lâm Quả')).toEqual({
      title: 'mr',
      name: 'Cao Lâm Quả',
    });
    expect(parseAltarPersonName('Bà Nguyễn Thị Mân')).toEqual({
      title: 'mrs',
      name: 'Nguyễn Thị Mân',
    });
    expect(parseAltarPersonName('Mr. Cao Lâm Quả')).toEqual({
      title: 'mr',
      name: 'Cao Lâm Quả',
    });
    expect(parseAltarPersonName('先生 Cao Lâm Quả')).toEqual({
      title: 'mr',
      name: 'Cao Lâm Quả',
    });
    expect(parseAltarPersonName('Cao Lâm Quả')).toEqual({
      title: '',
      name: 'Cao Lâm Quả',
    });
    expect(parseAltarPersonName('Ông')).toEqual({
      title: '',
      name: 'Ông',
    });
    expect(
      formatAltarPersonName(parseAltarPersonName('Ông Cao Lâm Quả'), 'vi'),
    ).toBe('Ông Cao Lâm Quả');
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
    // Compact `s\x1f` + 64-hex = 66 bytes (10-slot pack was 74 and overflowed
    // leftover SEND + DANA v2 at the 223 OP_RETURN edge).
    expect(new TextEncoder().encode(packed).length).toBe(66);
    expect(packed).toBe(`s${ALTAR_SEP}${'f'.repeat(64)}`);
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('');
    expect(parsed.deathDate).toBe('');
    expect(parsed.relationshipType).toBe('spouse');
    expect(parsed.relatedTxid).toBe(relatedTxid);
    expect(memorialDisplayName(packed, 'vi')).toBe('');
  });

  it('still reads the 10-slot relationship fragment written before compact wire', () => {
    const relatedTxid = 'e'.repeat(64);
    const legacy = `${ALTAR_SEP.repeat(8)}p${ALTAR_SEP}${relatedTxid}`;
    const parsed = parseAltarNote(legacy)!;
    expect(parsed.name).toBe('');
    expect(parsed.relationshipType).toBe('parent');
    expect(parsed.relatedTxid).toBe(relatedTxid);
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

  it('does not split Chinese or Japanese characters at the UTF-8 byte cap', () => {
    const zh = '追思寄语'.repeat(40);
    const ja = 'ありがとう'.repeat(40);
    expect(utf8ByteLength('追')).toBe(3);
    expect(utf8ByteLength('あ')).toBe(3);
    for (const s of [zh, ja]) {
      expect(utf8ByteLength(s)).toBeGreaterThan(MEMORIAL_NOTE_MAX_BYTES);
      const clipped = truncateUtf8Bytes(s, MEMORIAL_NOTE_MAX_BYTES);
      expect(utf8ByteLength(clipped)).toBe(MEMORIAL_NOTE_MAX_BYTES);
      expect(utf8ByteLength(clipped) % 3).toBe(0);
      expect([...clipped].every(ch => utf8ByteLength(ch) === 3)).toBe(true);
    }
    const packed = encodeAltarNote({
      ...emptyAltarFields(),
      name: '中村花子',
      deathDate: '2001-12-04',
      note: zh,
    });
    expect(utf8ByteLength(packed)).toBeLessThanOrEqual(MEMORIAL_NOTE_MAX_BYTES);
    const parsed = parseAltarNote(packed)!;
    expect(parsed.name).toBe('中村花子');
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
      listed: null,
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
    expect(MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT).toBe(120);
    expect(memorialNoteMaxBytes(false)).toBe(150);
    expect(memorialNoteMaxBytes(true)).toBe(120);
  });

  it('strips packed root fields from a re-offer extra, keeps death/relationship fragments', () => {
    const packed = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      note: 'Nhớ mãi',
      deathDate: '2001-12-04',
      deathPlace: 'Quy Nhơn',
    });
    expect(reofferExtraNote(packed)).toBe('Nhớ mãi');
    expect(reofferExtraNote('Dâng hoa sen')).toBe('Dâng hoa sen');
    expect(prepareDanaNote(packed, true)).toBe('Nhớ mãi');
    expect(prepareDanaNote(packed, false)).toBe(packed);
    const rel = encodeRelationshipNote({
      relationshipType: 'spouse',
      relatedTxid: 'a'.repeat(64),
    });
    expect(prepareDanaNote(rel, true)).toBe(rel);
    const death = encodeDeathDateNote({
      deathDate: '2020-01-15',
      deathPlace: 'Hà Nội',
      funeralPlace: '',
    });
    expect(prepareDanaNote(death, true)).toBe(death);
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

  it('defaults person altars to unlisted and keeps events trending', () => {
    const person = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
    });
    const listed = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
      listed: true,
    });
    const event = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Vu Lan hội',
      deathDate: '2026-08-26',
      kind: 'event',
    });
    expect(parseAltarNote(person)?.listed).toBeNull();
    expect(listed.includes(`${ALTAR_SEP}l`)).toBe(true);
    expect(parseAltarNote(listed)?.listed).toBe(true);
    expect(altarIsTrendingEligible(parseAltarNote(person))).toBe(false);
    expect(altarIsTrendingEligible(parseAltarNote(listed))).toBe(true);
    expect(altarIsTrendingEligible(parseAltarNote(event))).toBe(true);
    expect(altarNotesAreTrendingEligible(['Cao Lâm Quả'])).toBe(false);
    const catalogVuLan = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Vu Lan',
      note: 'Nguyện cho nhà nhà được bình an.',
      birthPlace: 'Việt Nam',
      deathDate: '2026-08-27',
    });
    expect(parseAltarNote(catalogVuLan)?.kind).toBe('');
    expect(altarIsTrendingEligible(parseAltarNote(catalogVuLan))).toBe(false);
    expect(altarNotesAreTrendingEligible([catalogVuLan])).toBe(true);
    expect(altarNotesAreTrendingEligible(['\u001fNepal 26/08'])).toBe(true);
    expect(altarIsCatalogTrendingName("All Hallows' Eve")).toBe(true);
    expect(altarIsCatalogTrendingName('Hồ Chí Minh')).toBe(true);
    expect(altarIsCatalogTrendingName('Cao Lâm Quả')).toBe(false);
    expect(
      altarNotesAreTrendingEligible([
        `${ALTAR_SEP}All Hallows' Eve${ALTAR_SEP}wow${ALTAR_SEP}${ALTAR_SEP}${ALTAR_SEP}2026-10-31`,
      ]),
    ).toBe(true);
    expect(
      altarNotesAreTrendingEligible([
        `${ALTAR_SEP}Hồ Chí Minh${ALTAR_SEP}Giỗ Hồ Chí Minh${ALTAR_SEP}Kim Liên, Nam Đàn, Nghệ An${ALTAR_SEP}1890${ALTAR_SEP}2026-09-02`,
      ]),
    ).toBe(true);
  });

  it('lists and unlists a person altar latest-wins via compact fragments', () => {
    const root = encodeAltarNote({
      ...emptyAltarFields(),
      title: 'mr',
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
    });
    const list = encodeListNote(true);
    const unlist = encodeListNote(false);
    expect(list).toBe(`l${ALTAR_SEP}`);
    expect(unlist).toBe(`u${ALTAR_SEP}`);
    expect(isListAmendNote(list)).toBe(true);
    expect(isListAmendNote(unlist)).toBe(true);
    expect(isListAmendNote(root)).toBe(false);
    expect(isRelationshipAmendNote(list)).toBe(false);
    expect(isDeathDateAmendNote(list)).toBe(false);
    expect(prepareDanaNote(list, true)).toBe(list);
    expect(prepareDanaNote(unlist, true)).toBe(unlist);
    const afterList = mergeAltarFields([list, root]);
    expect(afterList?.listed).toBe(true);
    expect(altarIsTrendingEligible(afterList)).toBe(true);
    const afterUnlist = mergeAltarFields([unlist, list, root]);
    expect(afterUnlist?.listed).toBe(false);
    expect(altarIsTrendingEligible(afterUnlist)).toBe(false);
  });

  it('does not treat a legacy multi-slot root named l or u as a list amend', () => {
    const legacyL = ['l', 'note', 'Hà Nội'].join(ALTAR_SEP);
    const legacyU = ['u', 'remember', 'Quy Nhơn'].join(ALTAR_SEP);
    expect(isListAmendNote(legacyL)).toBe(false);
    expect(isListAmendNote(legacyU)).toBe(false);
    expect(parseAltarNote(legacyL)).toMatchObject({
      name: 'l',
      note: 'note',
      birthPlace: 'Hà Nội',
      listed: null,
    });
    expect(parseAltarNote(legacyU)).toMatchObject({
      name: 'u',
      note: 'remember',
      birthPlace: 'Quy Nhơn',
      listed: null,
    });
  });

  it('keeps listed when fitting a root note, and rejects if listed cannot fit', () => {
    const listed = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'Cao Lâm Quả',
      deathDate: '2001-12-04',
      note: 'n'.repeat(400),
      listed: true,
    });
    expect(parseAltarNote(listed)?.listed).toBe(true);
    expect(utf8ByteLength(listed)).toBeLessThanOrEqual(MEMORIAL_NOTE_MAX_BYTES);

    const unlisted = encodeAltarNote({
      ...emptyAltarFields(),
      name: 'A',
    });
    expect(() =>
      encodeAltarNote(
        { ...emptyAltarFields(), name: 'A', listed: true },
        { maxBytes: utf8ByteLength(unlisted) },
      ),
    ).toThrow(/exceeds OP_RETURN budget/);
  });
});

describe('altarSearchRelevance', () => {
  it('treats honorific-prefixed display names as prefix match on bare name', () => {
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'cao', 'Cao Lâm Quả')).toBe(2);
    expect(altarSearchRelevance('Cao Lâm Quả', 'cao')).toBe(2);
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'cao')).toBe(2);
  });

  it('matches family + given when a middle name is skipped', () => {
    expect(altarSearchRelevance('Cao Lâm Quả', 'Cao Quả')).toBe(2);
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'cao qua')).toBe(2);
    expect(altarSearchRelevance('Nguyễn Thị Mân', 'Nguyễn Mân')).toBe(2);
    expect(altarSearchRelevance('Đinh Văn Phấn', 'dinh phan')).toBe(2);
  });

  it('does not treat an honorific-only query as a match', () => {
    expect(altarSearchRelevance('Ông Cao Lâm Quả', 'ông')).toBe(0);
    expect(altarSearchRelevance('Bà Nguyễn Thị Mân', 'bà')).toBe(0);
    expect(altarSearchRelevance('Mr. Cao Lâm Quả', 'mr')).toBe(0);
  });
});
