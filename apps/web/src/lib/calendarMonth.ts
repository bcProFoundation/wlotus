import { solarToLunar, type LunarDate } from './lunarCalendar.js';
import type { TempleSpecialProfileUi } from './specialsUi.js';

export function lunarTimeZone(locale: string): 7 | 8 {
  return locale.startsWith('zh') ? 8 : 7;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseYmd(
  ymd: string,
): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function todayYmd(now = new Date()): string {
  return ymdKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export interface CalendarDay {
  solarY: number;
  solarM: number;
  solarD: number;
  ymd: string;
  inMonth: boolean;
  isToday: boolean;
  lunar: LunarDate;
}

/** Six-week solar month grid. Weeks start Monday. */
export function buildSolarMonthGrid(
  year: number,
  month: number,
  locale: string,
  now = new Date(),
): CalendarDay[] {
  const tz = lunarTimeZone(locale);
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const today = todayYmd(now);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    days.push({
      solarY: y,
      solarM: m,
      solarD: d,
      ymd: ymdKey(y, m, d),
      inMonth: y === year && m === month,
      isToday: ymdKey(y, m, d) === today,
      lunar: solarToLunar(d, m, y, tz),
    });
  }
  return days;
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Lunar label in a cell: month name on the 1st, otherwise the lunar day. */
export function lunarCellLabel(lunar: LunarDate, locale: string): string {
  if (lunar.day !== 1) return String(lunar.day);
  if (locale.startsWith('zh')) {
    const names = [
      '正月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '冬月',
      '腊月',
    ];
    const name = names[lunar.month - 1] ?? `${lunar.month}月`;
    return lunar.leap ? `闰${name}` : name;
  }
  if (locale.startsWith('vi')) {
    return lunar.leap ? `N${lunar.month}` : `T${lunar.month}`;
  }
  return lunar.leap ? `L${lunar.month}` : `M${lunar.month}`;
}

export function specialCoversYmd(
  special: TempleSpecialProfileUi,
  ymd: string,
): boolean {
  const start = (
    special.effectiveStartDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    ''
  ).trim();
  const end = (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    start
  ).trim();
  if (!start || !parseYmd(ymd)) return false;
  const last = end && parseYmd(end) ? end : start;
  return ymd >= start && ymd <= last;
}

export function specialsOnYmd(
  specials: TempleSpecialProfileUi[] | null | undefined,
  ymd: string,
): TempleSpecialProfileUi[] {
  return (specials ?? []).filter(s => specialCoversYmd(s, ymd));
}

export interface CalendarMemorial {
  name: string;
  deathYmd: string;
  parentTxid: string;
}

/** Lunar death anniversary (giỗ) falls on this grid day. */
export function memorialOnYmd(
  memorial: CalendarMemorial,
  day: CalendarDay,
  locale: string,
): boolean {
  const p = parseYmd(memorial.deathYmd);
  if (!p) return false;
  const deathLunar = solarToLunar(p.d, p.m, p.y, lunarTimeZone(locale));
  return (
    deathLunar.day === day.lunar.day && deathLunar.month === day.lunar.month
  );
}

export function memorialsOnYmd(
  memorials: CalendarMemorial[],
  day: CalendarDay,
  locale: string,
): CalendarMemorial[] {
  return memorials.filter(m => memorialOnYmd(m, day, locale));
}

export type AppTab = 'home' | 'calendar';

export function tabFromHash(hash: string): AppTab {
  const h = hash.replace(/^#\/?/, '').trim().toLowerCase();
  return h === 'calendar' ? 'calendar' : 'home';
}

export function hashForTab(tab: AppTab): string {
  return tab === 'calendar' ? '#/calendar' : '#/';
}
