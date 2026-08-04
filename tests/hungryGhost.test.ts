import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  effectiveHungryGhostDeadDate,
  globalCivilDayWindowUtc,
  isHungryGhostSpecialOffer,
  isWithinGlobalCivilDay,
  loadHungryGhostConfigFromEnv,
  resolveHungryGhostStatus,
} from '../src/params/hungryGhost.js';

describe('hungryGhost calendar window', () => {
  it('parses global civil-day window for a fixed ymd', () => {
    const w = globalCivilDayWindowUtc('2026-08-28');
    expect(w).not.toBeNull();
    // start = 2026-08-27 10:00 UTC, end = 2026-08-29 12:00 UTC
    expect(new Date(w!.startMs).toISOString()).toBe('2026-08-27T10:00:00.000Z');
    expect(new Date(w!.endMs).toISOString()).toBe('2026-08-29T12:00:00.000Z');
  });

  it('is active inside the window and inactive outside', () => {
    expect(isWithinGlobalCivilDay(Date.parse('2026-08-28T00:00:00Z'), '2026-08-28')).toBe(
      true,
    );
    expect(isWithinGlobalCivilDay(Date.parse('2026-08-27T09:59:59Z'), '2026-08-28')).toBe(
      false,
    );
    expect(isWithinGlobalCivilDay(Date.parse('2026-08-29T12:00:00Z'), '2026-08-28')).toBe(
      false,
    );
  });

  it('applies test offset days to effective dead date', () => {
    expect(addCalendarDays('2026-08-28', -15)).toBe('2026-08-13');
    const cfg = {
      profileId: 'a'.repeat(64),
      deadDate: '2026-08-28',
      testOffsetDays: 15,
    };
    expect(effectiveHungryGhostDeadDate(cfg)).toBe('2026-08-13');
    const st = resolveHungryGhostStatus(cfg, Date.parse('2026-08-13T12:00:00Z'));
    expect(st.enabled).toBe(true);
    expect(st.active).toBe(true);
    expect(st.burnAtoms).toBe('102');
  });

  it('special offer requires matching profile + active window', () => {
    const profile = 'b'.repeat(64);
    const cfg = {
      profileId: profile,
      deadDate: '2026-08-28',
      testOffsetDays: 0,
    };
    expect(
      isHungryGhostSpecialOffer({
        parentBurnTxid: profile,
        cfg,
        nowMs: Date.parse('2026-08-28T12:00:00Z'),
      }),
    ).toBe(true);
    expect(
      isHungryGhostSpecialOffer({
        parentBurnTxid: 'c'.repeat(64),
        cfg,
        nowMs: Date.parse('2026-08-28T12:00:00Z'),
      }),
    ).toBe(false);
    expect(
      isHungryGhostSpecialOffer({
        parentBurnTxid: profile,
        cfg,
        nowMs: Date.parse('2026-01-01T12:00:00Z'),
      }),
    ).toBe(false);
  });

  it('loads env config', () => {
    const cfg = loadHungryGhostConfigFromEnv({
      HUNGRY_GHOST_PROFILE_ID: 'AB' + 'cd'.repeat(31),
      HUNGRY_GHOST_DEAD_DATE: '2026-08-28',
      HUNGRY_GHOST_TEST_OFFSET_DAYS: '7',
    });
    expect(cfg.profileId).toBe(('AB' + 'cd'.repeat(31)).toLowerCase());
    expect(cfg.deadDate).toBe('2026-08-28');
    expect(cfg.testOffsetDays).toBe(7);
  });
});
