import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  burnAtomsForDeskKeep,
  DEFAULT_SPECIAL_DESK_KEEP,
  globalCivilDayWindowUtc,
  isActiveSpecialOffer,
  isWithinGlobalCivilDay,
  loadTempleSpecialsFromEnv,
  resolveOfferBurnAtoms,
  resolveTempleSpecialsStatus,
} from '../src/params/templeSpecials.js';

describe('templeSpecials calendar window', () => {
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

  it('outside window always burns 1 flower (never rejects)', () => {
    const profile = 'b'.repeat(64);
    const specials = [
      {
        profileId: profile,
        kind: 'ghost' as const,
        eventDate: '2026-08-28',
        deskKeep: 0,
        testOffsetDays: 0,
        name: 'Cô Hồn',
      },
    ];
    // Outside window
    const off = resolveOfferBurnAtoms({
      parentBurnTxid: profile,
      specials,
      nowMs: Date.parse('2026-01-01T12:00:00Z'),
    });
    expect(off.burnAtoms).toBe(1n);
    expect(off.special).toBeNull();
    expect(
      isActiveSpecialOffer({
        parentBurnTxid: profile,
        specials,
        nowMs: Date.parse('2026-01-01T12:00:00Z'),
      }),
    ).toBe(false);

    // Inside window
    const on = resolveOfferBurnAtoms({
      parentBurnTxid: profile,
      specials,
      nowMs: Date.parse('2026-08-28T12:00:00Z'),
    });
    expect(on.burnAtoms).toBe(102n);
    expect(on.special?.kind).toBe('ghost');
  });

  it('loads TEMPLE_SPECIALS_JSON and legacy HUNGRY_GHOST_*', () => {
    const profile = ('ab' + 'cd'.repeat(31)).toLowerCase();
    const fromJson = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIALS_JSON: JSON.stringify([
        {
          profileId: profile,
          kind: 'hero',
          eventDate: '2026-09-02',
          birthDate: '1925-09-02',
          deskKeep: 6,
          name: 'Hero',
        },
      ]),
    });
    expect(fromJson).toHaveLength(1);
    expect(fromJson[0]!.kind).toBe('hero');
    expect(fromJson[0]!.birthDate).toBe('1925-09-02');
    expect(fromJson[0]!.deskKeep).toBe(6);

    const fromLegacy = loadTempleSpecialsFromEnv({
      HUNGRY_GHOST_PROFILE_ID: profile,
      HUNGRY_GHOST_DEAD_DATE: '2026-08-28',
      HUNGRY_GHOST_DESK_KEEP: '0',
      HUNGRY_GHOST_TEST_OFFSET_DAYS: '7',
    });
    expect(fromLegacy).toHaveLength(1);
    expect(fromLegacy[0]!.kind).toBe('ghost');
    expect(fromLegacy[0]!.deskKeep).toBe(0);
    expect(fromLegacy[0]!.testOffsetDays).toBe(7);
  });

  it('applies test offset days', () => {
    expect(addCalendarDays('2026-08-28', -15)).toBe('2026-08-13');
    const specials = [
      {
        profileId: 'a'.repeat(64),
        kind: 'ghost' as const,
        eventDate: '2026-08-28',
        deskKeep: 6,
        testOffsetDays: 15,
      },
    ];
    const st = resolveTempleSpecialsStatus(
      specials,
      Date.parse('2026-08-13T12:00:00Z'),
    );
    expect(st.enabled).toBe(true);
    expect(st.active).toHaveLength(1);
    expect(st.active[0]!.burnAtoms).toBe('96');
  });
});
