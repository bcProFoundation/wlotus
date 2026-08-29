import { ALTAR_SEP } from '../src/offering/altarFields.js';
import {
  altarFieldsFromIndexMemorial,
  indexMemorialNotes,
} from '../apps/web/src/lib/danaIndexApi.js';
import { altarHasDeathDate } from '../src/offering/altarFields.js';

/** Packed HCM root on test (title-first; giỗ solar 2 Sep 2026). */
const HCM_NOTE = [
  '',
  'Hồ Chí Minh',
  'Giỗ bác Hồ',
  'Kim Liên, Nam Đàn, Nghệ An',
  '1890',
  '2026-09-02',
].join(ALTAR_SEP);

describe('altarFieldsFromIndexMemorial', () => {
  it('reads deathDate from a packed index note without a local Recent row', () => {
    const fields = altarFieldsFromIndexMemorial({
      originalNote: HCM_NOTE,
      latestNote: HCM_NOTE,
      burns: [
        {
          burnTxid: 'a'.repeat(64),
          tokenId: 'b'.repeat(64),
          note: HCM_NOTE,
          offeringId: 'wlotus',
          version: 1,
          originalBurnTxid: 'a'.repeat(64),
          blockHeight: 1,
          blockTimestamp: 0,
          timeFirstSeen: '2026-08-29T06:28:09.304Z',
        },
      ],
    });
    expect(fields?.name).toBe('Hồ Chí Minh');
    expect(fields?.deathDate).toBe('2026-09-02');
    expect(altarHasDeathDate(fields)).toBe(true);
  });

  it('does not treat a bare display name as a packed altar', () => {
    expect(indexMemorialNotes({ originalNote: 'Hồ Chí Minh', latestNote: '', burns: [] })).toEqual([
      'Hồ Chí Minh',
    ]);
    expect(
      altarFieldsFromIndexMemorial({
        originalNote: 'Hồ Chí Minh',
        latestNote: '',
        burns: [],
      }),
    ).toBeNull();
  });
});
