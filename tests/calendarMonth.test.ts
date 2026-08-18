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
  specialWindowInYear,
  tabFromHash,
  ymdKey,
  defaultSelectedYmdForMonth,
} from '../apps/web/src/lib/calendarMonth.js';
import { solarToLunar } from '../apps/web/src/lib/lunarCalendar.js';
import { formatSpecialEventDateLabel, formatSpecialListName } from '../apps/web/src/lib/specialsUi.js';
import { lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';
import { catalogToSpecial } from '../src/params/templeSpecials.js';
import { templeSpecialCatalog } from '../src/params/templeSpecialCatalog.js';
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

function catalogAsUi(id: string, year = 2026): TempleSpecialProfileUi {
  const e = templeSpecialCatalog(year).find(x => x.id === id);
  if (!e) throw new Error(`missing catalog ${id}`);
  const s = catalogToSpecial(e);
  return {
    id: s.id,
    profileId: '',
    kind: s.kind,
    name: s.name ?? '',
    active: false,
    eventDate: s.eventDate,
    eventCalendar: s.eventCalendar,
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

  it('lists month specials from the selected day onward', () => {
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
      orderMonthSpecials(month, '2026-08-14').map(s => s.name),
    ).toEqual(['Cô Hồn', 'Vu Lan']);
    expect(
      orderMonthSpecials(month, '2026-08-27').map(s => s.name),
    ).toEqual(['Cô Hồn', 'Vu Lan']);
    expect(
      orderMonthSpecials(month, '2026-08-28').map(s => s.name),
    ).toEqual([]);
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
    expect(
      memorialsInMonth(kept, inMonth, '2026-08-28', 'vi'),
    ).toHaveLength(0);
  });

  it('repeats festivals and personal death days every year', () => {
    const vuLan = stubSpecial('2026-08-27');
    vuLan.id = 'vu-lan';
    vuLan.name = 'Vu Lan';
    vuLan.eventCalendar = 'lunar';
    vuLan.eventDate = '2026-07-15';
    const birthday = stubSpecial('2026-05-19');
    birthday.id = 'ho-chi-minh-birthday';
    birthday.name = 'Ngày sinh Hồ Chí Minh';
    birthday.eventCalendar = 'solar';

    const aug2027 = specialsInMonth(
      [vuLan, birthday],
      2027,
      8,
      'vi',
      '2027-08-01',
    );
    expect(aug2027.map(s => s.id)).toEqual(['vu-lan']);
    const vuLan2027 = specialWindowInYear(vuLan, 2027, 'vi');
    expect(vuLan2027).not.toBeNull();
    expect(aug2027[0]!.effectiveEventDate).toBe(vuLan2027!.peak);
    expect(aug2027[0]!.effectiveEventDate).not.toBe('2026-08-27');

    const may2027 = specialsInMonth(
      [vuLan, birthday],
      2027,
      5,
      'vi',
      '2027-05-01',
    );
    expect(may2027.map(s => s.id)).toEqual(['ho-chi-minh-birthday']);
    expect(may2027[0]!.effectiveStartDate).toBe('2027-05-19');
    expect(specialCoversYmd(birthday, '2027-05-19', 'vi')).toBe(true);
    expect(specialCoversYmd(birthday, '2026-05-19', 'vi')).toBe(true);

    const personal = {
      name: 'Ông nội',
      deathYmd: '1969-09-02',
      parentTxid: 'e'.repeat(64),
    };
    const sep2025 = buildSolarMonthGrid(2025, 9, 'vi', new Date(2025, 8, 1));
    const solarHit = sep2025.find(d => d.ymd === '2025-09-02');
    expect(solarHit && memorialOnYmd(personal, solarHit, 'vi')).toBe(true);
    const inMonth = sep2025.filter(d => d.inMonth);
    const listed = memorialsInMonth( [personal], inMonth, '2025-09-02', 'vi');
    expect(listed.some(m => m.onYmd === '2025-09-02')).toBe(true);
    const lunarHits = listed.filter(m => m.onYmd !== '2025-09-02');
    for (const row of lunarHits) {
      expect(row.onYmd >= '2025-09-02').toBe(true);
      const day = sep2025.find(d => d.ymd === row.onYmd);
      expect(day?.lunar.day).toBe(21);
      expect(day?.lunar.month).toBe(7);
    }
  });

  it('places Hồ Chí Minh giỗ on 2 Sep 2026 (lunar 21/7)', () => {
    const gio = catalogAsUi('ho-chi-minh');
    const bday = catalogAsUi('ho-chi-minh-birthday');
    expect(specialWindowInYear(gio, 2026, 'vi')?.peak).toBe('2026-09-02');
    const sep = specialsInMonth([gio, bday], 2026, 9, 'vi', '2026-09-02');
    expect(sep.map(s => s.id)).toEqual(['ho-chi-minh']);
    expect(sep[0]!.effectiveEventDate).toBe('2026-09-02');
    expect(specialCoversYmd(gio, '2026-09-02', 'vi')).toBe(true);
    const may = specialsInMonth([gio, bday], 2026, 5, 'vi', '2026-05-19');
    expect(may.map(s => s.id)).toEqual(['ho-chi-minh-birthday']);
    expect(may[0]!.effectiveStartDate).toBe('2026-05-19');
  });

  it('places Cô Sáu on 23 Jan and Thánh Mẫu windows in 2026', () => {
    const sau = catalogAsUi('vo-thi-sau');
    const mau = catalogAsUi('lieu-hanh');
    const xu = catalogAsUi('ba-chua-xu');
    const den = catalogAsUi('ba-den');
    const hau = catalogAsUi('thien-hau');
    expect(specialWindowInYear(sau, 2026, 'vi')?.peak).toBe('2026-01-23');
    expect(specialCoversYmd(sau, '2026-01-23', 'vi')).toBe(true);
    expect(specialWindowInYear(mau, 2026, 'vi')?.peak).toBe('2026-04-19');
    expect(specialWindowInYear(hau, 2026, 'vi')?.peak).toBe('2026-05-09');
    expect(specialWindowInYear(xu, 2026, 'vi')?.start).toBe('2026-06-07');
    expect(specialWindowInYear(xu, 2026, 'vi')?.peak).toBe('2026-06-10');
    expect(specialWindowInYear(xu, 2026, 'vi')?.end).toBe('2026-06-12');
    expect(specialCoversYmd(xu, '2026-06-07', 'vi')).toBe(true);
    expect(specialCoversYmd(xu, '2026-06-12', 'vi')).toBe(true);
    expect(specialWindowInYear(den, 2026, 'vi')?.start).toBe('2026-06-18');
    expect(specialWindowInYear(den, 2026, 'vi')?.end).toBe('2026-06-20');
  });

  it('places Phật Đản week 24–31 May 2026 (lunar 8–15/4) and Vesak on the full moon', () => {
    const phatDan = catalogAsUi('phat-dan');
    const vesak = catalogAsUi('vesak');
    expect(specialWindowInYear(phatDan, 2026, 'vi')?.peak).toBe('2026-05-31');
    expect(specialWindowInYear(phatDan, 2026, 'vi')?.start).toBe('2026-05-24');
    expect(specialWindowInYear(vesak, 2026, 'en')?.peak).toBe('2026-05-31');
    const mayVn = specialsInMonth([phatDan], 2026, 5, 'vi', '2026-05-24');
    expect(mayVn.map(s => s.id)).toEqual(['phat-dan']);
    expect(specialCoversYmd(phatDan, '2026-05-24', 'vi')).toBe(true);
    expect(specialCoversYmd(phatDan, '2026-05-31', 'vi')).toBe(true);
    const mayEn = specialsInMonth([vesak], 2026, 5, 'en', '2026-05-31');
    expect(mayEn.map(s => s.id)).toEqual(['vesak']);
  });

  it('uses the API solar window when the SPA catalog is stale', () => {
    const stale = stubSpecial('2026-05-19');
    stale.id = 'ho-chi-minh';
    stale.name = 'Hồ Chí Minh';
    stale.eventCalendar = 'solar';
    stale.effectiveEventDate = '2026-09-02';
    stale.effectiveStartDate = '2026-09-02';
    stale.effectiveEndDate = '2026-09-02';
    expect(specialWindowInYear(stale, 2026, 'vi')?.peak).toBe('2026-09-02');
    expect(specialCoversYmd(stale, '2026-09-02', 'vi')).toBe(true);
    const sep = specialsInMonth([stale], 2026, 9, 'vi', '2026-09-02');
    expect(sep.map(s => s.id)).toEqual(['ho-chi-minh']);
  });

  it('adds months and parses tab hash', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(tabFromHash('#/calendar')).toBe('calendar');
    expect(tabFromHash('#calendar')).toBe('calendar');
    expect(tabFromHash('')).toBe('home');
    expect(ymdKey(2026, 8, 4)).toBe('2026-08-04');
  });

  it('selects today in the current month and the 1st otherwise', () => {
    const now = new Date(2026, 7, 17);
    expect(defaultSelectedYmdForMonth(2026, 8, now)).toBe('2026-08-17');
    expect(defaultSelectedYmdForMonth(2026, 9, now)).toBe('2026-09-01');
    expect(defaultSelectedYmdForMonth(2026, 7, now)).toBe('2026-07-01');
    expect(defaultSelectedYmdForMonth(2025, 12, now)).toBe('2025-12-01');
  });

  it('repeats mùng 1 and rằm on the eve and peak, skipping named festival months', () => {
    const mung = catalogAsUi('mung-1');
    const ram = catalogAsUi('ram');
    expect(specialCoversYmd(mung, '2026-02-17', 'vi')).toBe(false);
    expect(specialCoversYmd(mung, '2026-08-12', 'vi')).toBe(true);
    expect(specialCoversYmd(mung, '2026-08-13', 'vi')).toBe(true);
    expect(specialCoversYmd(ram, '2026-08-27', 'vi')).toBe(false);
    expect(specialCoversYmd(ram, '2026-03-03', 'vi')).toBe(false);
    expect(specialCoversYmd(ram, '2026-06-28', 'vi')).toBe(true);
    expect(specialCoversYmd(ram, '2026-06-29', 'vi')).toBe(true);
    expect(specialCoversYmd(mung, '2026-08-27', 'vi')).toBe(false);
    const aug = specialsInMonth([mung, ram], 2026, 8, 'vi', '2026-08-17');
    expect(aug.map(s => s.id)).toEqual(['mung-1']);
    expect(
      orderMonthSpecials(aug, '2026-08-17', 'vi').map(s => s.id),
    ).toEqual([]);
    expect(
      orderMonthSpecials(aug, '2026-08-12', 'vi').map(s => s.id),
    ).toEqual(['mung-1']);
    const oct = specialsInMonth([mung], 2026, 10, 'vi', '2026-10-01');
    expect(
      orderMonthSpecials(oct, '2026-10-01', 'vi').map(s => s.id),
    ).toEqual(['mung-1']);
    const jun = specialsInMonth([ram], 2026, 6, 'vi', '2026-06-29');
    expect(jun.map(s => s.id)).toEqual(['ram']);
    expect(jun[0]!.effectiveStartDate).toBe('2026-06-28');
    expect(jun[0]!.effectiveEndDate).toBe('2026-06-29');
  });

  it('places Giao thừa on the last day of tháng Chạp (29 in 2025)', () => {
    const giao = catalogAsUi('giao-thua', 2025);
    giao.eventDate = '2025-12-30';
    const w = specialWindowInYear(giao, 2025, 'vi');
    expect(w?.peak).toBe('2026-02-16');
    expect(specialCoversYmd(giao, '2026-02-16', 'vi')).toBe(true);
    expect(specialCoversYmd(giao, '2026-02-17', 'vi')).toBe(false);
  });

  it('keeps Tết as 1/1–1/3 and tiễn ông bà on mùng 3', () => {
    const tet = catalogAsUi('tet');
    const tien = catalogAsUi('tien-ong-ba');
    expect(specialCoversYmd(tet, '2026-02-17', 'vi')).toBe(true);
    expect(specialCoversYmd(tet, '2026-02-19', 'vi')).toBe(true);
    expect(specialCoversYmd(tet, '2026-02-20', 'vi')).toBe(false);
    expect(specialCoversYmd(tien, '2026-02-19', 'vi')).toBe(true);
  });

  it('covers Nguyên Tiêu and Trung Thu from the 14th through rằm', () => {
    const tieu = catalogAsUi('nguyen-tieu');
    const thu = catalogAsUi('trung-thu');
    expect(specialCoversYmd(tieu, '2026-03-02', 'vi')).toBe(true);
    expect(specialCoversYmd(tieu, '2026-03-03', 'vi')).toBe(true);
    expect(specialCoversYmd(thu, '2026-09-24', 'vi')).toBe(true);
    expect(specialCoversYmd(thu, '2026-09-25', 'vi')).toBe(true);
  });

  it('labels monthly sóc/vọng as the two-day folk window', () => {
    expect(formatSpecialEventDateLabel(catalogAsUi('mung-1'), 'vi')).toBe(
      '30 và mùng 1 mỗi tháng',
    );
    expect(formatSpecialEventDateLabel(catalogAsUi('ram'), 'vi')).toBe(
      '14 và rằm mỗi tháng',
    );
    expect(formatSpecialEventDateLabel(catalogAsUi('chu-yi'), 'zh')).toBe(
      '每月月末与初一',
    );
    expect(formatSpecialEventDateLabel(catalogAsUi('shi-wu'), 'zh')).toBe(
      '每月十四与十五',
    );
  });

  it('names monthly sóc/vọng with the lunar month of that occurrence', () => {
    const mung = catalogAsUi('mung-1');
    const ram = catalogAsUi('ram');
    const aug = specialsInMonth([mung], 2026, 8, 'vi', '2026-08-12');
    expect(formatSpecialListName(aug[0]!, 'vi')).toMatch(/^1 tháng /);
    expect(formatSpecialListName(aug[0]!, 'vi')).not.toBe('Mùng 1');

    const tetMung1 = {
      ...mung,
      eventRecurrence: 'monthly-lunar' as const,
      effectiveStartDate: '2026-02-17',
      effectiveEndDate: '2026-02-17',
      effectiveEventDate: '2026-02-17',
    };
    expect(formatSpecialListName(tetMung1, 'vi')).toBe('1 tháng giêng');
    expect(formatSpecialListName(tetMung1, 'zh')).toBe('正月初一');

    const chapPeak = lunarYmdToSolarYmd('2026-12-15', 7);
    expect(chapPeak).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ramChap = {
      ...ram,
      eventRecurrence: 'monthly-lunar' as const,
      effectiveStartDate: chapPeak!,
      effectiveEndDate: chapPeak!,
      effectiveEventDate: chapPeak!,
    };
    expect(formatSpecialListName(ramChap, 'vi')).toBe('rằm tháng chạp');
    expect(formatSpecialListName(ramChap, 'zh')).toBe('腊月十五');

    const ramThang9 = {
      ...ram,
      eventRecurrence: 'monthly-lunar' as const,
      effectiveStartDate: lunarYmdToSolarYmd('2026-09-15', 7)!,
      effectiveEndDate: lunarYmdToSolarYmd('2026-09-15', 7)!,
      effectiveEventDate: lunarYmdToSolarYmd('2026-09-15', 7)!,
    };
    expect(formatSpecialListName(ramThang9, 'vi')).toBe('rằm tháng 9');
  });
});
