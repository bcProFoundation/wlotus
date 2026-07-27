import {
  encodeAltarNote,
  emptyAltarFields,
  isAltarPackedNote,
  memorialDisplayName,
  parseAltarNote,
  truncateUtf8Bytes,
  validateAltarFields,
  type AltarFields,
} from '../src/offering/altarFields.js';

describe('altarFields', () => {
  it('round-trips packed altar notes', () => {
    const fields: AltarFields = {
      name: 'Cao Lâm Quả',
      note: 'Kính bố',
      birthPlace: 'Mỹ Thành, Phù Mỹ, Bình Định',
      birthYear: '1945',
      deathDate: '2001-10-20',
      deathPlace: 'Bình Định',
      funeralPlace: '',
    };
    const packed = encodeAltarNote(fields);
    expect(isAltarPackedNote(packed)).toBe(true);
    expect(parseAltarNote(packed)).toEqual({
      ...fields,
      funeralPlace: '',
    });
    expect(memorialDisplayName(packed)).toBe('Cao Lâm Quả');
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

  it('truncates by UTF-8 bytes', () => {
    const s = 'á'.repeat(100);
    const out = truncateUtf8Bytes(s, 10);
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(10);
  });
});
