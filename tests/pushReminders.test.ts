import { dueRemindersForSub } from '../apps/mint-api/src/pushReminders.js';

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
