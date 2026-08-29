import {
  altarAllowsFlowerReoffer,
  findSpecialById,
  homeEventOfferHint,
  omitLotusPrayerParagraph,
  overlaySpecialEventDate,
  parseHomeEventsSort,
  rankTempleSpecials,
  specialCountdown,
  specialStoryForLocale,
} from '../apps/web/src/lib/specialsUi.js';
import type { TempleSpecialProfileUi } from '../apps/web/src/lib/specialsUi.js';
import { emptyAltarFields } from '../src/offering/altarFields.js';
import { templeSpecialCatalog } from '../src/params/templeSpecialCatalog.js';

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
    expect(ranked.map(r => r.id)).toEqual([
      'co-hon',
      'halloween',
      'thanh-minh',
      'memorial-day',
    ]);
    expect(ranked.find(r => r.id === 'thanh-minh')?.effectiveStartDate).toBe(
      '2027-04-05',
    );
  });

  it('rolls a past festival to next year instead of dropping it', () => {
    const ranked = rankTempleSpecials(
      [spec('halloween', '2026-10-31')],
      {},
      8,
      new Date(2026, 10, 1), // 1 Nov 2026
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.effectiveStartDate).toBe('2027-10-31');
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

  it('leaves bound offer counts unknown until the index loads', () => {
    const bound = 'ab'.repeat(32);
    const ranked = rankTempleSpecials(
      [
        spec('vu-lan', '2026-08-27', { profileId: bound, active: true }),
        spec('co-hon', '2026-08-27', { active: true }),
      ],
      {},
      8,
      now,
    );
    expect(ranked.find(r => r.id === 'vu-lan')?.offerCount).toBeNull();
    expect(ranked.find(r => r.id === 'co-hon')?.offerCount).toBe(0);
    const withCount = rankTempleSpecials(
      [spec('vu-lan', '2026-08-27', { profileId: bound, active: true })],
      { [bound]: 4 },
      8,
      now,
    );
    expect(withCount[0]!.offerCount).toBe(4);
  });

  it('ranks upcoming by soonest window, not lifetime offer count', () => {
    const halloweenId = 'ab'.repeat(32);
    const coHonId = 'cd'.repeat(32);
    const profiles = [
      spec('halloween', '2026-10-31', { profileId: halloweenId }),
      spec('all-souls', '2026-11-02'),
      spec('co-hon', '2026-08-27', {
        effectiveStartDate: '2026-08-14',
        effectiveEndDate: '2026-08-27',
        active: true,
        profileId: coHonId,
      }),
    ];
    const counts = { [halloweenId]: 20, [coHonId]: 5 };
    const upcoming = rankTempleSpecials(
      profiles,
      counts,
      8,
      now,
      'vi',
    );
    expect(upcoming.map(r => r.id)).toEqual([
      'co-hon',
      'halloween',
      'all-souls',
    ]);
  });

  it('defaults the home list to upcoming unless trending was saved', () => {
    expect(parseHomeEventsSort(null)).toBe('upcoming');
    expect(parseHomeEventsSort('')).toBe('upcoming');
    expect(parseHomeEventsSort('upcoming')).toBe('upcoming');
    expect(parseHomeEventsSort('trending')).toBe('trending');
  });
});

describe('specialCountdown', () => {
  const vuLanDay = new Date(2026, 7, 27); // 27 Aug 2026 — lunar 15/7

  it('treats Vu Lan on rằm as happening, not merely today', () => {
    const vuLan = spec('vu-lan', '2026-08-27', { active: true });
    expect(specialCountdown(vuLan, vuLanDay)).toEqual({ kind: 'ongoing' });
  });

  it('treats a multi-day window that includes today as happening', () => {
    const coHon = spec('co-hon', '2026-08-27', {
      effectiveStartDate: '2026-08-14',
      effectiveEndDate: '2026-08-27',
      active: true,
    });
    expect(specialCountdown(coHon, vuLanDay)).toEqual({ kind: 'ongoing' });
    expect(specialCountdown(coHon, new Date(2026, 7, 14))).toEqual({
      kind: 'ongoing',
    });
  });

  it('counts down to an upcoming festival and marks a past window', () => {
    const halloween = spec('halloween', '2026-10-31');
    expect(specialCountdown(halloween, vuLanDay)).toEqual({
      kind: 'days',
      days: 65,
    });
    expect(
      specialCountdown(halloween, new Date(2026, 10, 2)),
    ).toEqual({ kind: 'past', days: 2 });
  });
});

describe('homeEventOfferHint', () => {
  const bound = 'cd'.repeat(32);

  it('shows first-burn only for unbound specials', () => {
    expect(homeEventOfferHint('', 0)).toBe('first');
    expect(homeEventOfferHint('', null)).toBe('first');
  });

  it('hides the count when a bound special has no loaded total', () => {
    expect(homeEventOfferHint(bound, null)).toBe('none');
    expect(homeEventOfferHint(bound, 0)).toBe('none');
    expect(homeEventOfferHint(bound, 3)).toBe('count');
  });
});

describe('omitLotusPrayerParagraph', () => {
  it('keeps the story and drops only the closing lotus prayer', () => {
    const vu = templeSpecialCatalog(2026).find(e => e.id === 'vu-lan')!;
    const hung = templeSpecialCatalog(2026).find(e => e.id === 'hung-kings')!;
    const yulan = templeSpecialCatalog(2026).find(e => e.id === 'yulanpen')!;

    const vi = omitLotusPrayerParagraph(vu.story.body);
    expect(vi).toContain('Rằm tháng Bảy là ngày Báo Hiếu');
    expect(vi).not.toMatch(/lời nguyện/);
    expect(vi).toContain('mẹ mới được siêu thoát');

    const hungBody = omitLotusPrayerParagraph(hung.story.body);
    expect(hungBody).toContain('Vua Hùng');
    expect(hungBody).not.toMatch(/lời nguyện/);

    const en = omitLotusPrayerParagraph(vu.story.bodyEn!);
    expect(en).toContain('filial gratitude');
    expect(en).not.toMatch(/also a prayer/i);

    const zh = omitLotusPrayerParagraph(yulan.story.bodyZh || yulan.story.body);
    expect(zh).toContain('盂兰盆');
    expect(zh).not.toMatch(/一句愿/);
  });

  it('strips the lotus prayer from every catalog locale body', () => {
    for (const e of templeSpecialCatalog(2026)) {
      const texts = [e.story.body, e.story.bodyEn, e.story.bodyZh].filter(
        (t): t is string => Boolean(t?.trim()),
      );
      for (const t of texts) {
        const out = omitLotusPrayerParagraph(t);
        expect(out.length).toBeGreaterThan(20);
        expect(out).not.toMatch(/lời nguyện|also a prayer|一句愿/i);
      }
    }
  });

  it('omits the prayer from locale story used on details', () => {
    const vu = templeSpecialCatalog(2026).find(e => e.id === 'vu-lan')!;
    const special: TempleSpecialProfileUi = {
      id: vu.id,
      profileId: '',
      kind: vu.kind,
      name: vu.name,
      active: false,
      storyTitle: vu.story.title,
      storyBody: vu.story.body,
      storyTitleEn: vu.story.titleEn,
      storyBodyEn: vu.story.bodyEn,
    };
    const details = specialStoryForLocale(special, 'vi', { omitPrayer: true });
    const session = specialStoryForLocale(special, 'vi');
    expect(details?.body).not.toMatch(/lời nguyện/);
    expect(session?.body).toMatch(/lời nguyện/);
  });

  it('finds an unbound special by catalog id', () => {
    const status = {
      profiles: [
        spec('vu-lan', '2026-08-27', { id: 'vu-lan', profileId: 'pending' }),
      ],
    };
    expect(findSpecialById(status, 'vu-lan')?.id).toBe('vu-lan');
    expect(findSpecialById(status, '')).toBeNull();
  });
});

describe('altarAllowsFlowerReoffer', () => {
  const hero = spec('ho-chi-minh', '2026-09-02', {
    kind: 'hero',
    name: 'Hồ Chí Minh',
    profileId: '2'.repeat(64),
    eventCalendar: 'lunar',
    eventDate: '2026-07-21',
    effectiveEventDate: '2026-09-02',
  });

  it('lets catalog heroes re-offer without a packed death date', () => {
    expect(altarAllowsFlowerReoffer({ deathDate: '' }, hero)).toBe(true);
    expect(altarAllowsFlowerReoffer(emptyAltarFields(), hero)).toBe(true);
  });

  it('still hides flowers on living personal profiles', () => {
    expect(altarAllowsFlowerReoffer({ deathDate: '' }, null)).toBe(false);
    expect(
      altarAllowsFlowerReoffer({ deathDate: '1969-09-02' }, null),
    ).toBe(true);
  });

  it('overlays the catalog solar day onto a name-only home-list fallback', () => {
    const named = { ...emptyAltarFields(), name: 'Hồ Chí Minh' };
    expect(named.deathDate).toBe('');
    const overlaid = overlaySpecialEventDate(named, hero);
    expect(overlaid.deathDate).toBe('2026-09-02');
    expect(overlaid.dateCalendar).toBe('lunar');
    expect(overlaySpecialEventDate(overlaid, hero).deathDate).toBe(
      '2026-09-02',
    );
  });
});
