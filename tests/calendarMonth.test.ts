import {
  addMonths,
  buildSolarMonthGrid,
  excludeSpecialDuplicateMemorials,
  lunarCellLabel,
  memorialDuplicatesSpecial,
  memorialOnYmd,
  memorialsInMonth,
  orderMonthSpecials,
  specialCoversYmd,
  specialsInMonth,
  tabFromHash,
  ymdKey,
} from '../apps/web/src/lib/calendarMonth.js';
import { solarToLunar } from '../apps/web/src/lib/lunarCalendar.js';
import type { TempleSpecialProfileUi } from '../apps/web/src/lib/specialsUi.js';

function stubSpecial(
  start: string,
  end = start,
): TempleSpecialProfileUi {
  return {
    profileId: '',
    kind: 'event',
    name: 'Test',
    active: false,
    eventDate: start,
    effectiveStartDate: start,
    effectiveEndDate: end,
  };
}

describe('calendarMonth', () => {
  it('builds a 42-day Monday-start grid', () => {
    const days = buildSolarMonthGrid(2026, 8, 'vi', new Date(2026, 7, 14));
    expect(days).toHaveLength(42);
    expect(days[0]!.ymd <= '2026-08-01').toBe(true);
    const mondays = [0, 7, 14, 21, 28, 35].map(i => days[i]!);
    for (const d of mondays) {
      expect(new Date(d.solarY, d.solarM - 1, d.solarD).getDay()).toBe(1);
    }
    const today = days.find(d => d.ymd === '2026-08-14');
    expect(today?.isToday).toBe(true);
    expect(today?.inMonth).toBe(true);
  });

  it('labels lunar new-month cells and plain days', () => {
    const tet = solarToLunar(17, 2, 2026, 7);
    expect(tet.day).toBe(1);
    expect(lunarCellLabel(tet, 'vi')).toBe('T1');
    expect(lunarCellLabel(tet, 'zh')).toBe('正月');
    expect(lunarCellLabel({ ...tet, day: 15 }, 'vi')).toBe('15');
  });

  it('covers multi-day specials on each solar day', () => {
    const ghost = stubSpecial('2026-08-14', '2026-08-27');
    expect(specialCoversYmd(ghost, '2026-08-14')).toBe(true);
    expect(specialCoversYmd(ghost, '2026-08-20')).toBe(true);
    expect(specialCoversYmd(ghost, '2026-08-27')).toBe(true);
    expect(specialCoversYmd(ghost, '2026-08-13')).toBe(false);
    expect(specialCoversYmd(ghost, '2026-08-28')).toBe(false);
  });

  it('places a solar death date on its lunar giỗ in a later year', () => {
    // Hồ Chí Minh died 2 Sep 1969 = lunar 21/7 Kỷ Dậu.
    const death = { name: 'HCM', deathYmd: '1969-09-02', parentTxid: 'aa' };
    const days = buildSolarMonthGrid(2026, 9, 'vi', new Date(2026, 8, 1));
    const hits = days.filter(d => memorialOnYmd(death, d, 'vi'));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const hit of hits) {
      expect(hit.lunar.day).toBe(21);
      expect(hit.lunar.month).toBe(7);
    }
  });

  it('lists month specials with the selected day first', () => {
    const early = stubSpecial('2026-08-05');
    early.name = 'Early';
    const ghost = stubSpecial('2026-08-14', '2026-08-27');
    ghost.name = 'Cô Hồn';
    const vuLan = stubSpecial('2026-08-27');
    vuLan.name = 'Vu Lan';
    const halloween = stubSpecial('2026-10-31');
    halloween.name = 'Halloween';
    const month = specialsInMonth(
      [halloween, vuLan, early, ghost],
      2026,
      8,
    );
    expect(month.map(s => s.name).sort()).toEqual(['Cô Hồn', 'Early', 'Vu Lan']);
    expect(
      orderMonthSpecials(month, '2026-08-05').map(s => s.name),
    ).toEqual(['Early', 'Cô Hồn', 'Vu Lan']);
    expect(
      orderMonthSpecials(month, '2026-08-27').map(s => s.name),
    ).toEqual(['Cô Hồn', 'Vu Lan', 'Early']);
  });

  it('drops temple specials from giỗ but keeps a personal memorial on the same lunar day', () => {
    const boundId = 'a'.repeat(64);
    const vuLan = stubSpecial('2026-08-27');
    vuLan.id = 'vu-lan';
    vuLan.name = 'Vu Lan';
    vuLan.profileId = boundId;
    const ghost = stubSpecial('2026-08-14', '2026-08-27');
    ghost.id = 'co-hon';
    ghost.name = 'Cô Hồn';
    ghost.profileId = '';
    const specials = [vuLan, ghost];

    const fromBoundRoot = {
      name: 'Vu Lan',
      deathYmd: '2026-08-27',
      parentTxid: boundId,
    };
    const fromAltarNote = {
      name: 'Cúng Cô Hồn',
      deathYmd: '2026-08-14',
      parentTxid: 'b'.repeat(64),
    };
    const fromVuLanNote = {
      name: 'Vu Lan Báo Hiếu',
      deathYmd: '2026-08-27',
      parentTxid: 'c'.repeat(64),
    };
    const personalOnVuLanDay = {
      name: 'Bà Nguyễn Thị Lan',
      deathYmd: '2026-08-27',
      parentTxid: 'd'.repeat(64),
    };

    expect(memorialDuplicatesSpecial(fromBoundRoot, specials)).toBe(true);
    expect(memorialDuplicatesSpecial(fromAltarNote, specials)).toBe(true);
    expect(memorialDuplicatesSpecial(fromVuLanNote, specials)).toBe(true);
    expect(memorialDuplicatesSpecial(personalOnVuLanDay, specials)).toBe(false);

    const kept = excludeSpecialDuplicateMemorials(
      [fromBoundRoot, fromAltarNote, fromVuLanNote, personalOnVuLanDay],
      specials,
    );
    expect(kept.map(m => m.name)).toEqual(['Bà Nguyễn Thị Lan']);

    const days = buildSolarMonthGrid(2026, 8, 'vi', new Date(2026, 7, 14));
    const inMonth = days.filter(d => d.inMonth);
    const month = memorialsInMonth(kept, inMonth, '2026-08-27', 'vi');
    expect(month).toHaveLength(1);
    expect(month[0]!.name).toBe('Bà Nguyễn Thị Lan');
    expect(month[0]!.onYmd).toBe('2026-08-27');
  });

  it('adds months and parses tab hash', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(tabFromHash('#/calendar')).toBe('calendar');
    expect(tabFromHash('#calendar')).toBe('calendar');
    expect(tabFromHash('')).toBe('home');
    expect(ymdKey(2026, 8, 4)).toBe('2026-08-04');
  });
});
