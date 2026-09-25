import {
  copyForLocale,
  dueRemindersForSub,
} from '../apps/mint-api/src/pushReminders.js';

describe('dueRemindersForSub', () => {
  const altar = {
    txid: 'a'.repeat(64),
    name: 'Cao Lâm Quả',
    deathYmd: '2001-10-20',
    kind: 'person' as const,
  };

  it('fires at the local morning hour on the anniversary civil day', () => {
    const now = new Date('2026-10-20T07:10:00.000Z');
    const due = dueRemindersForSub(
      {
        altars: [altar],
        locale: 'vi',
        timeZone: 'UTC',
        sent: [],
      },
      now,
      7,
    );
    expect(due).toEqual([
      { txid: altar.txid, name: altar.name, kind: 'person', ymd: '2026-10-20' },
    ]);
  });

  it('does not fire at other hours or after already sending that day', () => {
    const morning = new Date('2026-10-20T07:10:00.000Z');
    const afternoon = new Date('2026-10-20T15:10:00.000Z');
    expect(
      dueRemindersForSub(
        { altars: [altar], locale: 'vi', timeZone: 'UTC', sent: [] },
        afternoon,
        7,
      ),
    ).toEqual([]);
    expect(
      dueRemindersForSub(
        {
          altars: [altar],
          locale: 'vi',
          timeZone: 'UTC',
          sent: [`${altar.txid}:2026-10-20`],
        },
        morning,
        7,
      ),
    ).toEqual([]);
  });
});

describe('festival reminder copy', () => {
  const item = {
    txid: 'b'.repeat(64),
    ymd: '2026-09-25',
  };

  it('does not call Tết Trung Thu or a ghost a ngày giỗ', () => {
    expect(
      copyForLocale('vi', { ...item, name: 'Tết Trung Thu', kind: 'person' }).body,
    ).toBe('Hôm nay là Tết Trung Thu.');
    expect(
      copyForLocale('vi', { ...item, name: 'Cô Hồn', kind: 'person' }).body,
    ).toBe('Hôm nay là Cô Hồn.');
  });

  it('keeps ngày giỗ for a person', () => {
    expect(
      copyForLocale('vi', { ...item, name: 'Cao Lâm Quả', kind: 'person' }).body,
    ).toBe('Hôm nay là ngày giỗ của Cao Lâm Quả.');
  });
});
