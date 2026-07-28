/**
 * Vietnamese / Chinese lunar (âm lịch / 农历) calendar conversion.
 *
 * Faithful port of Hồ Ngọc Đức's public-domain astronomical algorithm
 * (https://www.xemamlich.uhm.vn/calrules.html — the reference implementation
 * behind essentially every Vietnamese lunar calendar on the web), valid for
 * solar years ~1800–2199.
 *
 * Vietnam and China compute the same new-moon / solar-term astronomy but at
 * different reference longitudes (Hanoi UTC+7 vs Beijing UTC+8), so the two
 * calendars occasionally differ by a day around a new-moon boundary — pass
 * the matching `timeZone` (7 or 8) for each.
 */

const PI = Math.PI;

/** Largest integer not exceeding `d` (i.e. `Math.floor`, kept for parity with the reference algorithm). */
function INT(d: number): number {
  return Math.floor(d);
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85; // Time in Julian centuries from 1900 January 0.5
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr); // Mean new moon
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3; // Sun's mean anomaly
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3; // Moon's mean anomaly
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3; // Moon's argument of latitude
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525; // Julian centuries from 2000-01-01 12:00 GMT
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2; // mean anomaly
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2; // mean longitude
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL; // true longitude, degree
  L = L * dr;
  L = L - PI * 2 * INT(L / (PI * 2)); // normalize to (0, 2*PI)
  return INT((L / PI) * 6);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone); // sun longitude at local midnight
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1; // Start with the month following lunar month 11
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** True when `month` is a leap month (tháng nhuận / 闰月). */
  leap: boolean;
}

/**
 * Convert a solar (Gregorian) date to its lunar equivalent.
 * `timeZone`: 7 for the Vietnamese calendar (Hanoi, UTC+7), 8 for the
 * Chinese calendar (Beijing, UTC+8).
 */
export function solarToLunar(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number,
): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

/** Heavenly Stems (Thiên Can / 天干) — index by `(year + 6) % 10`. */
const CAN_VI = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CAN_ZH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
/** Earthly Branches (Địa Chi / 地支) — index by `(year + 8) % 12`. */
const CHI_VI = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
];
const CHI_ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Can-Chi year name, e.g. "Tân Tỵ" (vi) / "辛巳" (zh). */
export function canChiYear(lunarYear: number, locale: 'vi' | 'zh'): string {
  const can = mod(lunarYear + 6, 10);
  const chi = mod(lunarYear + 8, 12);
  return locale === 'zh' ? `${CAN_ZH[can]}${CHI_ZH[chi]}` : `${CAN_VI[can]} ${CHI_VI[chi]}`;
}

const ZH_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Traditional Chinese lunar day name: 初一…初十, 十一…十九, 二十, 廿一…廿九, 三十. */
function zhDayName(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return `初${ZH_DIGITS[day - 1]}`;
  if (day < 20) return `十${ZH_DIGITS[day - 11]}`;
  if (day < 30) return `廿${ZH_DIGITS[day - 21]}`;
  return String(day);
}

const ZH_MONTH_NAMES = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月',
];

function zhMonthName(month: number, leap: boolean): string {
  const name = ZH_MONTH_NAMES[month - 1] ?? `${month}月`;
  return leap ? `闰${name}` : name;
}

/**
 * Format a full `YYYY-MM-DD` solar death date as a lunar date string for
 * `vi`/`zh` locales. Returns `null` for any other locale, an incomplete
 * date (`YYYY` / `YYYY-MM` — no single day to convert), or an unparsable
 * string, so callers can fall back to the plain solar display.
 */
export function formatLunarDeathDate(
  isoDate: string,
  locale: 'vi' | 'zh' | 'en',
): string | null {
  if (locale !== 'vi' && locale !== 'zh') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const timeZone = locale === 'zh' ? 8 : 7;
  const lunar = solarToLunar(day, month, year, timeZone);
  const cc = canChiYear(lunar.year, locale);

  if (locale === 'zh') {
    return `农历${cc}年${zhMonthName(lunar.month, lunar.leap)}${zhDayName(lunar.day)}`;
  }
  const leapNote = lunar.leap ? ' (nhuận)' : '';
  return `Ngày ${lunar.day} tháng ${lunar.month}${leapNote} năm ${cc}`;
}
