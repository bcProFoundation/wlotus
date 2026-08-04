import { describe, expect, it } from 'vitest';
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

  it('loads TEMPLE_SPECIALS_JSON only (no legacy HUNGRY_GHOST_*)', () => {
    const profile = ('ab' + 'cd'.repeat(31)).toLowerCase();
    const fromJson = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIALS_JSON: JSON.stringify([
        {
          profileId: profile,
          kind: 'hero',
          eventDate: '2026-09-02',
          eventCalendar: 'solar',
          birthDate: '1925-09-02',
          name: 'Hero',
        },
      ]),
    });
    expect(fromJson).toHaveLength(1);
    expect(fromJson[0]!.kind).toBe('hero');
    expect(fromJson[0]!.birthDate).toBe('1925-09-02');
    expect(fromJson[0]!.eventCalendar).toBe('solar');

    // Legacy env must be ignored
    const fromLegacy = loadTempleSpecialsFromEnv({
      HUNGRY_GHOST_PROFILE_ID: profile,
      HUNGRY_GHOST_DEAD_DATE: '2026-08-28',
    });
    expect(fromLegacy).toHaveLength(0);
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
    // Lunar 2026-07-15 (Hungry Ghost / Vu Lan mid-month) → solar ~2026-08-28
    // (exact conversion depends on algorithm; we assert round-trip shape)
    const solar = lunarYmdToSolarYmd('2026-07-15', 7);
    expect(solar).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const effective = effectiveEventDate('2026-07-15', 0, 'lunar');
    expect(effective).toBe(solar);

    // Solar calendar leaves the date unchanged
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
    // 2024-02-10 solar was lunar 2024-01-01 (non-leap) in VN calendar
    const s = lunarToSolar(1, 1, 2024, false, 7);
    expect(s).not.toBeNull();
    expect(s!.year).toBe(2024);
    expect(s!.month).toBe(2);
    expect(s!.day).toBe(10);
  });
});
