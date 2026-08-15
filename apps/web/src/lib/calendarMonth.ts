import {
  findCatalogEntryById,
  findCatalogEntryByName,
  foldSpecialName,
} from '../../../../src/params/templeSpecialCatalog.js';
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

function specialStartYmd(special: TempleSpecialProfileUi): string {
  return (
    special.effectiveStartDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    ''
  ).trim();
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthStartEnd(
  year: number,
  month: number,
): { start: string; end: string } {
  return {
    start: ymdKey(year, month, 1),
    end: ymdKey(year, month, lastDayOfMonth(year, month)),
  };
}

/** Special's window overlaps this solar month. */
export function specialOverlapsMonth(
  special: TempleSpecialProfileUi,
  year: number,
  month: number,
): boolean {
  const start = specialStartYmd(special);
  const endRaw = (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    start
  ).trim();
  if (!parseYmd(start)) return false;
  const end = parseYmd(endRaw) ? endRaw : start;
  const { start: monthStart, end: monthEnd } = monthStartEnd(year, month);
  return start <= monthEnd && end >= monthStart;
}

export function specialsInMonth(
  specials: TempleSpecialProfileUi[] | null | undefined,
  year: number,
  month: number,
): TempleSpecialProfileUi[] {
  return (specials ?? []).filter(s => specialOverlapsMonth(s, year, month));
}

/** Selected-day specials first, then the rest of the month by start date. */
export function orderMonthSpecials(
  specials: TempleSpecialProfileUi[],
  selectedYmd: string,
): TempleSpecialProfileUi[] {
  const onDay: TempleSpecialProfileUi[] = [];
  const rest: TempleSpecialProfileUi[] = [];
  for (const s of specials) {
    if (specialCoversYmd(s, selectedYmd)) onDay.push(s);
    else rest.push(s);
  }
  const byStart = (a: TempleSpecialProfileUi, b: TempleSpecialProfileUi) => {
    const cmp = specialStartYmd(a).localeCompare(specialStartYmd(b));
    if (cmp !== 0) return cmp;
    return (a.name || '').localeCompare(b.name || '', 'vi');
  };
  onDay.sort(byStart);
  rest.sort(byStart);
  return [...onDay, ...rest];
}

export interface CalendarMemorial {
  name: string;
  deathYmd: string;
  parentTxid: string;
}

function catalogYearFromSpecial(special: TempleSpecialProfileUi): number {
  return (
    parseYmd(
      special.effectiveEventDate || special.eventDate || '',
    )?.y ?? 2026
  );
}

function specialNameFolds(special: TempleSpecialProfileUi): string[] {
  const year = catalogYearFromSpecial(special);
  const catalog =
    findCatalogEntryById(special.id, year) ||
    findCatalogEntryByName(special.name, year);
  const raw = [
    special.id,
    special.name,
    catalog?.id,
    catalog?.name,
    catalog?.altarName,
    catalog?.note,
    ...(catalog?.aliases ?? []),
  ];
  const out = new Set<string>();
  for (const r of raw) {
    const f = foldSpecialName(r || '');
    if (f) out.add(f);
  }
  return [...out];
}

/** Folded names overlap when they match, or one contains the other. */
function foldedNamesOverlap(memorialFold: string, specialFold: string): boolean {
  if (!memorialFold || !specialFold) return false;
  if (memorialFold === specialFold) return true;
  const cjk = /[\u4e00-\u9fff]/.test(memorialFold + specialFold);
  const minLen = cjk ? 2 : 4;
  if (specialFold.length >= minLen && memorialFold.includes(specialFold)) {
    return true;
  }
  if (memorialFold.length >= minLen && specialFold.includes(memorialFold)) {
    return true;
  }
  return false;
}

/**
 * True when this giỗ is the same temple special already listed as a festival.
 * Personal memorials on the same lunar day are kept.
 */
export function memorialDuplicatesSpecial(
  memorial: CalendarMemorial,
  specials: TempleSpecialProfileUi[] | null | undefined,
): boolean {
  const list = specials ?? [];
  if (list.length === 0) return false;
  const txid = memorial.parentTxid.trim().toLowerCase();
  if (
    txid.length === 64 &&
    list.some(s => s.profileId.trim().toLowerCase() === txid)
  ) {
    return true;
  }
  const memFold = foldSpecialName(memorial.name);
  if (!memFold) return false;
  const catalog = findCatalogEntryByName(memorial.name);
  for (const s of list) {
    if (catalog) {
      const sid = (s.id || '').trim().toLowerCase();
      if (sid && sid === catalog.id) return true;
      if (foldSpecialName(s.name || '') === foldSpecialName(catalog.name)) {
        return true;
      }
    }
    if (specialNameFolds(s).some(n => foldedNamesOverlap(memFold, n))) {
      return true;
    }
  }
  return false;
}

/** Drop temple specials from the giỗ list so they only appear as festivals. */
export function excludeSpecialDuplicateMemorials(
  memorials: CalendarMemorial[],
  specials: TempleSpecialProfileUi[] | null | undefined,
): CalendarMemorial[] {
  return memorials.filter(m => !memorialDuplicatesSpecial(m, specials));
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

export interface MonthMemorial extends CalendarMemorial {
  /** Solar day in this month where the giỗ falls. */
  onYmd: string;
}

/** Unique giỗ that fall on an in-month grid day; selected day first. */
export function memorialsInMonth(
  memorials: CalendarMemorial[],
  inMonthDays: CalendarDay[],
  selectedYmd: string,
  locale: string,
): MonthMemorial[] {
  const seen = new Set<string>();
  const onDay: MonthMemorial[] = [];
  const rest: MonthMemorial[] = [];
  for (const day of inMonthDays) {
    for (const m of memorials) {
      if (!memorialOnYmd(m, day, locale)) continue;
      const key = m.parentTxid.trim().toLowerCase() || `${m.name}:${m.deathYmd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = { ...m, onYmd: day.ymd };
      if (day.ymd === selectedYmd) onDay.push(row);
      else rest.push(row);
    }
  }
  rest.sort((a, b) => a.onYmd.localeCompare(b.onYmd) || a.name.localeCompare(b.name, 'vi'));
  return [...onDay, ...rest];
}

export type AppTab = 'home' | 'calendar';

export function tabFromHash(hash: string): AppTab {
  const h = hash.replace(/^#\/?/, '').trim().toLowerCase();
  return h === 'calendar' ? 'calendar' : 'home';
}

export function hashForTab(tab: AppTab): string {
  return tab === 'calendar' ? '#/calendar' : '#/';
}
