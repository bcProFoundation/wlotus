import {
  addCalendarDays,
  burnAtomsForDeskKeep,
  DEFAULT_SPECIAL_DESK_KEEP,
  effectiveEventDate,
  globalCivilDayWindowUtc,
  isActiveSpecialOffer,
  isWithinGlobalCivilDay,
  loadTempleSpecialsFromEnv,
  loadTempleSpecialsGlobalConfig,
  resolveOfferBurnAtoms,
  resolveTempleSpecialsStatus,
} from '../src/params/templeSpecials.js';
import { lunarYmdToSolarYmd, lunarToSolar } from '../src/lib/lunarCalendar.js';

describe('templeSpecials', () => {
  it('parses global civil-day window for a fixed ymd', () => {
    const w = globalCivilDayWindowUtc('2026-08-28');
    expect(w).not.toBeNull();
    expect(new Date(w!.startMs).toISOString()).toBe('2026-08-27T10:00:00.000Z');
    expect(new Date(w!.endMs).toISOString()).toBe('2026-08-29T12:00:00.000Z');
  });

  it('is active inside the window and inactive outside', () => {
    expect(
      isWithinGlobalCivilDay(Date.parse('2026-08-28T00:00:00Z'), '2026-08-28'),
    ).toBe(true);
    expect(
      isWithinGlobalCivilDay(Date.parse('2026-08-27T09:59:59Z'), '2026-08-28'),
    ).toBe(false);
    expect(
      isWithinGlobalCivilDay(Date.parse('2026-08-29T12:00:00Z'), '2026-08-28'),
    ).toBe(false);
  });

  it('deskKeep 6 → burn 96; deskKeep 0 → burn 102', () => {
    expect(DEFAULT_SPECIAL_DESK_KEEP).toBe(6);
    expect(burnAtomsForDeskKeep(6)).toBe(96n);
    expect(burnAtomsForDeskKeep(0)).toBe(102n);
    expect(burnAtomsForDeskKeep(101)).toBe(1n);
  });

  it('loads global deskKeep and testOffsetDays from env', () => {
    expect(
      loadTempleSpecialsGlobalConfig({
        TEMPLE_SPECIAL_DESK_KEEP: '0',
        TEMPLE_SPECIAL_TEST_OFFSET_DAYS: '15',
      }),
    ).toEqual({ deskKeep: 0, testOffsetDays: 15 });

    expect(loadTempleSpecialsGlobalConfig({})).toEqual({
      deskKeep: 6,
      testOffsetDays: 0,
    });
  });

  it('outside window always burns 1 flower (never rejects)', () => {
    const profile = 'b'.repeat(64);
    const specials = [
      {
        id: 'co-hon',
        profileId: profile,
        kind: 'ghost' as const,
        eventDate: '2026-08-28',
        eventCalendar: 'solar' as const,
        name: 'Cô Hồn',
      },
    ];
    const globalCfg = { deskKeep: 0, testOffsetDays: 0 };

    const off = resolveOfferBurnAtoms({
      parentBurnTxid: profile,
      specials,
      globalCfg,
      nowMs: Date.parse('2026-01-01T12:00:00Z'),
    });
    expect(off.burnAtoms).toBe(1n);
    expect(off.special).toBeNull();
    expect(
      isActiveSpecialOffer({
        parentBurnTxid: profile,
        specials,
        globalCfg,
        nowMs: Date.parse('2026-01-01T12:00:00Z'),
      }),
    ).toBe(false);

    const on = resolveOfferBurnAtoms({
      parentBurnTxid: profile,
      specials,
      globalCfg,
      nowMs: Date.parse('2026-08-28T12:00:00Z'),
    });
    expect(on.burnAtoms).toBe(102n);
    expect(on.special?.kind).toBe('ghost');
  });

  it('loads the built-in catalog without requiring a temple burn', () => {
    const loaded = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIAL_CLAIMS_FILE: '/tmp/wlotus-no-claims.json',
    });
    expect(loaded.length).toBeGreaterThanOrEqual(19);
    const vuLan = loaded.find(s => s.id === 'vu-lan');
    expect(vuLan?.profileId).toBe('');
    expect(vuLan?.kind).toBe('event');

    const fromLegacy = loadTempleSpecialsFromEnv({
      HUNGRY_GHOST_PROFILE_ID: 'ab'.repeat(32),
      HUNGRY_GHOST_DEAD_DATE: '2026-08-28',
      TEMPLE_SPECIAL_CLAIMS_FILE: '/tmp/wlotus-no-claims.json',
    });
    expect(fromLegacy.find(s => s.id === 'vu-lan')?.profileId).toBe('');
  });

  it('overlays JSON profileId onto catalog rows and can add extra specials', () => {
    const profile = ('ab' + 'cd'.repeat(31)).toLowerCase();
    const fromJson = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIAL_CLAIMS_FILE: '/tmp/wlotus-no-claims.json',
      TEMPLE_SPECIALS_JSON: JSON.stringify([
        {
          id: 'vu-lan',
          profileId: profile,
          kind: 'event',
          eventDate: '2026-07-15',
          eventCalendar: 'lunar',
          name: 'Vu Lan',
        },
        {
          profileId: 'ef'.repeat(32),
          kind: 'hero',
          eventDate: '2026-09-02',
          eventCalendar: 'solar',
          birthDate: '1925-09-02',
          name: 'Custom Hero',
        },
      ]),
    });
    expect(fromJson.find(s => s.id === 'vu-lan')?.profileId).toBe(profile);
    const extra = fromJson.find(s => s.name === 'Custom Hero');
    expect(extra?.kind).toBe('hero');
    expect(extra?.birthDate).toBe('1925-09-02');
    expect(extra?.eventCalendar).toBe('solar');
  });

  it('applies global testOffsetDays to all profiles', () => {
    expect(addCalendarDays('2026-08-28', -15)).toBe('2026-08-13');
    const specials = [
      {
        profileId: 'a'.repeat(64),
        kind: 'ghost' as const,
        eventDate: '2026-08-28',
        eventCalendar: 'solar' as const,
      },
    ];
    const st = resolveTempleSpecialsStatus(
      specials,
      { deskKeep: 6, testOffsetDays: 15 },
      Date.parse('2026-08-13T12:00:00Z'),
    );
    expect(st.enabled).toBe(true);
    expect(st.testOffsetDays).toBe(15);
    expect(st.deskKeep).toBe(6);
    expect(st.burnAtoms).toBe('96');
    expect(st.active).toHaveLength(1);
    expect(st.active[0]!.effectiveEventDate).toBe('2026-08-13');
  });

  it('defaults eventCalendar to lunar and converts to solar', () => {
    const solar = lunarYmdToSolarYmd('2026-07-15', 7);
    expect(solar).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const effective = effectiveEventDate('2026-07-15', 0, 'lunar');
    expect(effective).toBe(solar);

    expect(effectiveEventDate('2026-09-02', 0, 'solar')).toBe('2026-09-02');
  });

  it('solar eventCalendar for heroes (e.g. Hồ Chí Minh 2 Sep)', () => {
    const profile = 'c'.repeat(64);
    const specials = [
      {
        profileId: profile,
        kind: 'hero' as const,
        eventDate: '2026-09-02',
        eventCalendar: 'solar' as const,
        name: 'Hồ Chí Minh',
      },
    ];
    const st = resolveTempleSpecialsStatus(
      specials,
      { deskKeep: 6, testOffsetDays: 0 },
      Date.parse('2026-09-02T12:00:00Z'),
    );
    expect(st.active).toHaveLength(1);
    expect(st.active[0]!.eventCalendar).toBe('solar');
    expect(st.active[0]!.effectiveEventDate).toBe('2026-09-02');
  });

  it('lunarToSolar is inverse of solarToLunar for common dates', () => {
    const s = lunarToSolar(1, 1, 2024, false, 7);
    expect(s).not.toBeNull();
    expect(s!.year).toBe(2024);
    expect(s!.month).toBe(2);
    expect(s!.day).toBe(10);
  });

  it('supports multi-day eventStart/eventEnd range', () => {
    const profile = 'd'.repeat(64);
    const specials = [
      {
        profileId: profile,
        kind: 'ghost' as const,
        eventDate: '2026-07-15',
        eventStart: '2026-07-02',
        eventEnd: '2026-07-15',
        eventCalendar: 'lunar' as const,
        name: 'Cô Hồn',
      },
    ];
    const st = resolveTempleSpecialsStatus(
      specials,
      { deskKeep: 0, testOffsetDays: 0 },
      Date.parse('2026-08-20T12:00:00Z'),
    );
    expect(st.active.length).toBe(1);
    expect(st.active[0]!.effectiveStartDate <= st.active[0]!.effectiveEndDate).toBe(true);
    expect(st.active[0]!.storyBody).toBeTruthy();
  });

  it('parses event kind and serves Vu Lan story', () => {
    const profile = 'e'.repeat(64);
    const specials = [
      {
        profileId: profile,
        kind: 'event' as const,
        eventDate: '2026-07-15',
        eventCalendar: 'lunar' as const,
        name: 'Vu Lan',
      },
    ];
    const st = resolveTempleSpecialsStatus(
      specials,
      { deskKeep: 6, testOffsetDays: 0 },
      Date.parse('2026-08-27T12:00:00Z'),
    );
    expect(st.profiles[0]!.kind).toBe('event');
    expect(st.profiles[0]!.storyTitle).toMatch(/Vu Lan/i);
  });

  it('does not give every event the Vu Lan story', () => {
    const profile = 'f'.repeat(64);
    const st = resolveTempleSpecialsStatus(
      [
        {
          profileId: profile,
          kind: 'event' as const,
          eventDate: '2026-04-05',
          eventCalendar: 'solar' as const,
          name: 'Tết Thanh Minh',
        },
      ],
      { deskKeep: 6, testOffsetDays: 0 },
      Date.parse('2026-04-05T12:00:00Z'),
    );
    expect(st.profiles[0]!.storyTitle).toMatch(/Thanh Minh/i);
    expect(st.profiles[0]!.storyTitle).not.toMatch(/Vu Lan/i);
  });

  it('exposes countries on public status (empty = Global)', () => {
    const profile = '1'.repeat(64);
    const st = resolveTempleSpecialsStatus(
      [
        {
          profileId: profile,
          kind: 'event' as const,
          eventDate: '2026-07-15',
          eventCalendar: 'lunar' as const,
          name: 'Vu Lan',
          countries: ['VN'],
        },
      ],
      { deskKeep: 6, testOffsetDays: 0 },
      Date.parse('2026-01-01T12:00:00Z'),
    );
    expect(st.profiles[0]!.countries).toEqual(['VN']);
    expect(st.profiles[0]!.storyTitleZh).toBeNull();
  });

  it('does not raise burn for unbound specials (empty profileId)', () => {
    const specials = [
      {
        id: 'vu-lan',
        profileId: '',
        kind: 'event' as const,
        eventDate: '2026-07-15',
        eventCalendar: 'lunar' as const,
        name: 'Vu Lan',
      },
    ];
    const on = resolveOfferBurnAtoms({
      parentBurnTxid: 'a'.repeat(64),
      specials,
      globalCfg: { deskKeep: 0, testOffsetDays: 0 },
      nowMs: Date.parse('2026-08-27T12:00:00Z'),
    });
    expect(on.burnAtoms).toBe(1n);
    expect(on.special).toBeNull();
  });
});
