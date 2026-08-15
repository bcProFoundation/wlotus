import { rankTempleSpecials } from '../apps/web/src/lib/specialsUi.js';
import type { TempleSpecialProfileUi } from '../apps/web/src/lib/specialsUi.js';

function spec(
  id: string,
  ymd: string,
  extra: Partial<TempleSpecialProfileUi> = {},
): TempleSpecialProfileUi {
  return {
    id,
    profileId: '',
    kind: 'event',
    name: id,
    active: false,
    eventDate: ymd,
    eventCalendar: 'solar',
    effectiveEventDate: ymd,
    effectiveStartDate: ymd,
    effectiveEndDate: ymd,
    ...extra,
  };
}

describe('rankTempleSpecials', () => {
  const now = new Date(2026, 7, 15); // 15 Aug 2026 local

  it('drops past events and keeps ongoing + upcoming', () => {
    const ranked = rankTempleSpecials(
      [
        spec('thanh-minh', '2026-04-05'),
        spec('co-hon', '2026-08-27', {
          effectiveStartDate: '2026-08-14',
          effectiveEndDate: '2026-08-27',
          active: true,
        }),
        spec('halloween', '2026-10-31'),
        spec('memorial-day', '2026-05-25'),
      ],
      {},
      8,
      now,
    );
    expect(ranked.map(r => r.id)).toEqual(['co-hon', 'halloween']);
  });

  it('orders upcoming by soonest start', () => {
    const ranked = rankTempleSpecials(
      [spec('all-souls', '2026-11-02'), spec('halloween', '2026-10-31')],
      {},
      8,
      now,
    );
    expect(ranked.map(r => r.id)).toEqual(['halloween', 'all-souls']);
  });
});
