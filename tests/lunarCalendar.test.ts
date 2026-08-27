import {
  canChiYear,
  formatLunarBirthYear,
  formatLunarDeathDate,
  solarDateForBirthYearLookup,
  solarToLunar,
} from '../apps/web/src/lib/lunarCalendar.js';
import {
  nextMonthlyLunarWindow,
  solarYmdInMonthlyLunar,
  lunarYmdToSolarYmd,
  solarYmdToLunarYmd,
} from '../src/lib/lunarCalendar.js';

describe('lunarCalendar', () => {
  it('converts well-known Vietnamese Tết (lunar New Year) solar dates to lunar 1/1', () => {
    const tetDates: { solar: [number, number, number]; canChi: string }[] = [
      { solar: [25, 1, 2020], canChi: 'Canh Tý' },
      { solar: [12, 2, 2021], canChi: 'Tân Sửu' },
      { solar: [1, 2, 2022], canChi: 'Nhâm Dần' },
      { solar: [22, 1, 2023], canChi: 'Quý Mão' },
      { solar: [10, 2, 2024], canChi: 'Giáp Thìn' },
      { solar: [29, 1, 2025], canChi: 'Ất Tỵ' },
      { solar: [17, 2, 2026], canChi: 'Bính Ngọ' },
    ];
    for (const { solar, canChi } of tetDates) {
      const [dd, mm, yy] = solar;
      const lunar = solarToLunar(dd, mm, yy, 7);
      expect(lunar).toEqual({ day: 1, month: 1, year: yy, leap: false });
      expect(canChiYear(lunar.year, 'vi')).toBe(canChi);
    }
  });

  it('flags the known 2004 leap month (nhuận tháng 2)', () => {
    // Hồ Ngọc Đức's own worked example: leap month 2 runs 21/3/2004–18/4/2004.
    const lunar = solarToLunar(1, 4, 2004, 7);
    expect(lunar.month).toBe(2);
    expect(lunar.leap).toBe(true);
    expect(lunar.year).toBe(2004);
  });

  it('matches the Vietnamese calendar year for a documented historical date', () => {
    // Widely documented: Hồ Chí Minh died 2/9/1969, lunar 21/7 năm Kỷ Dậu.
    const lunar = solarToLunar(2, 9, 1969, 7);
    expect(lunar).toEqual({ day: 21, month: 7, year: 1969, leap: false });
    expect(canChiYear(lunar.year, 'vi')).toBe('Kỷ Dậu');
  });

  it('computes matching Can-Chi stem-branch names in vi and zh', () => {
    expect(canChiYear(2001, 'vi')).toBe('Tân Tỵ');
    expect(canChiYear(2001, 'zh')).toBe('辛巳');
    expect(canChiYear(1984, 'vi')).toBe('Giáp Tý');
    expect(canChiYear(1984, 'zh')).toBe('甲子');
  });

  it('formats a full death date as lunar text', () => {
    expect(formatLunarDeathDate('2001-12-04', 'vi')).toBe(
      'Ngày 20 tháng 10 năm Tân Tỵ',
    );
    expect(formatLunarDeathDate('2001-12-04', 'zh')).toBe('农历辛巳年十月二十');
    expect(formatLunarDeathDate('2001-12-04', 'en')).toBe('Lunar 20/10/2001');
  });

  it('returns null for incomplete or malformed dates', () => {
    expect(formatLunarDeathDate('2001', 'vi')).toBeNull();
    expect(formatLunarDeathDate('2001-12', 'vi')).toBeNull();
    expect(formatLunarDeathDate('not-a-date', 'vi')).toBeNull();
    expect(formatLunarDeathDate('', 'zh')).toBeNull();
  });

  it('uses 31 Dec when looking up Can-Chi for a year-only birth', () => {
    expect(solarDateForBirthYearLookup('1926')).toEqual({
      day: 31,
      month: 12,
      year: 1926,
    });
    expect(solarDateForBirthYearLookup('1945-09-02')).toEqual({
      day: 2,
      month: 9,
      year: 1945,
    });
    expect(solarDateForBirthYearLookup('1945-09')).toEqual({
      day: 30,
      month: 9,
      year: 1945,
    });
  });

  it('formats lunar birth year (Can-Chi) with year-only Dec 31 rule', () => {
    // 31/12/1926 → lunar year for Can-Chi
    expect(formatLunarBirthYear('1926', 'vi')).toBe(
      canChiYear(solarToLunar(31, 12, 1926, 7).year, 'vi'),
    );
    expect(formatLunarBirthYear('1945-09-02', 'vi')).toBe(
      canChiYear(solarToLunar(2, 9, 1945, 7).year, 'vi'),
    );
    expect(formatLunarBirthYear('1926', 'en')).toBeNull();
    expect(formatLunarBirthYear('', 'vi')).toBeNull();
  });

  it('round-trips Vu Lan lunar 15/7 2026 to solar 27 Aug', () => {
    expect(lunarYmdToSolarYmd('2026-07-15', 7)).toBe('2026-08-27');
    expect(solarYmdToLunarYmd('2026-08-27', 7)).toBe('2026-07-15');
  });
});

describe('monthly sóc/vọng windows', () => {
  const ram = {
    peakDay: 15,
    includeEve: true,
    skipLunarMonths: [1, 7, 8],
  };
  const soc = {
    peakDay: 1,
    includeEve: true,
    skipLunarMonths: [1],
  };

  it('covers 14–rằm and skips Vu Lan / Nguyên Tiêu / Trung Thu months', () => {
    expect(solarYmdInMonthlyLunar('2026-06-28', ram, 7)).toBe(true);
    expect(solarYmdInMonthlyLunar('2026-06-29', ram, 7)).toBe(true);
    expect(solarYmdInMonthlyLunar('2026-08-27', ram, 7)).toBe(false);
    expect(solarYmdInMonthlyLunar('2026-03-03', ram, 7)).toBe(false);
    expect(nextMonthlyLunarWindow('2026-08-01', ram, 7)).toEqual({
      start: '2026-10-23',
      end: '2026-10-24',
      peak: '2026-10-24',
    });
  });

  it('covers 30–mùng 1 and skips Tết', () => {
    expect(solarYmdInMonthlyLunar('2026-02-17', soc, 7)).toBe(false);
    expect(solarYmdInMonthlyLunar('2026-08-12', soc, 7)).toBe(true);
    expect(solarYmdInMonthlyLunar('2026-08-13', soc, 7)).toBe(true);
    expect(nextMonthlyLunarWindow('2026-02-16', soc, 7)).toEqual({
      start: '2026-03-18',
      end: '2026-03-19',
      peak: '2026-03-19',
    });
  });
});
