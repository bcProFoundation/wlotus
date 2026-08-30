import {
  findCatalogEntryById,
  findCatalogEntryByName,
  foldSpecialName,
} from '../../../../src/params/templeSpecialCatalog.js';
import {
  lunarMonthLastSolarYmd,
  lunarYmdToSolarYmd,
  nextMonthlyLunarWindow,
  solarYmdInMonthlyLunar,
  type MonthlyLunarSpec,
} from '../../../../src/lib/lunarCalendar.js';
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

/** Current month → today; any other month → the 1st. */
export function defaultSelectedYmdForMonth(
  year: number,
  month: number,
  now = new Date(),
): string {
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    return todayYmd(now);
  }
  return ymdKey(year, month, 1);
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

function catalogForSpecial(
  special: TempleSpecialProfileUi,
  year: number,
) {
  return (
    findCatalogEntryById(special.id, year) ||
    findCatalogEntryByName(special.name, year)
  );
}

function monthlyLunarSpec(
  special: TempleSpecialProfileUi,
  locale = 'vi',
): MonthlyLunarSpec | null {
  const day = monthlyLunarDay(special, locale);
  if (day == null) return null;
  const today = todayYmd();
  const year = parseYmd(today)?.y ?? 2026;
  const catalog = catalogForSpecial(special, year);
  return {
    peakDay: day,
    includeEve: catalog?.monthlyEve !== false,
    skipLunarMonths: catalog?.skipLunarMonths,
  };
}

function monthlyWindowFrom(
  spec: MonthlyLunarSpec,
  fromYmd: string,
  locale: string,
): SpecialWindow | null {
  const w = nextMonthlyLunarWindow(fromYmd, spec, lunarTimeZone(locale));
  if (!w) return null;
  return { start: w.start, end: w.end, peak: w.peak };
}

function monthlyLunarDay(
  special: TempleSpecialProfileUi,
  locale = 'vi',
): number | null {
  const today = todayYmd();
  const year = parseYmd(today)?.y ?? 2026;
  const catalog = catalogForSpecial(special, year);
  const rec =
    special.eventRecurrence || catalog?.eventRecurrence || '';
  if (rec !== 'monthly-lunar') return null;
  const date = catalog?.eventDate || special.eventDate || '';
  return parseYmd(date)?.d ?? null;
}

function usesLunarMonthEnd(
  special: TempleSpecialProfileUi,
  year: number,
): boolean {
  if (special.lunarMonthEnd) return true;
  return Boolean(catalogForSpecial(special, year)?.lunarMonthEnd);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function solarYmdInYear(ymd: string, year: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const last = lastDayOfMonth(year, p.m);
  return ymdKey(year, p.m, Math.min(p.d, last));
}

export interface SpecialWindow {
  start: string;
  end: string;
  peak: string;
}

function orderedWindow(start: string, end: string, peak: string): SpecialWindow {
  if (start <= end) return { start, end, peak };
  return { start: end, end: start, peak };
}

/**
 * Recurring window for this special in a given civil year.
 * Lunar festivals convert that year's lunar month/day; solar ones reuse
 * month/day (or the catalog row, so Qingming / Memorial Day stay correct).
 */
export function specialWindowInYear(
  special: TempleSpecialProfileUi,
  year: number,
  locale = 'vi',
): SpecialWindow | null {
  const monthly = monthlyLunarSpec(special, locale);
  if (monthly) {
    const occ = monthlyWindowFrom(monthly, `${year}-01-01`, locale);
    if (!occ) return null;
    const startY = parseYmd(occ.start)?.y;
    const peakY = parseYmd(occ.peak)?.y;
    if (startY !== year && peakY !== year) return null;
    return occ;
  }

  // Trust the server window for this civil year. The SPA catalog can be a
  // deploy behind mint-api (web path filters used to miss src/**).
  const apiPeak = (special.effectiveEventDate || '').trim();
  const apiStart = (special.effectiveStartDate || apiPeak).trim();
  const apiEnd = (special.effectiveEndDate || apiPeak).trim();
  const apiPeakP = parseYmd(apiPeak);
  if (
    apiPeakP?.y === year &&
    parseYmd(apiStart) &&
    parseYmd(apiEnd)
  ) {
    return orderedWindow(apiStart, apiEnd, apiPeak);
  }

  const catalog =
    findCatalogEntryById(special.id, year) ||
    findCatalogEntryByName(special.name, year);
  if (catalog) {
    const peakRaw = catalog.eventDate;
    const startRaw = catalog.eventStart || peakRaw;
    const endRaw = catalog.eventEnd || peakRaw;
    if (catalog.eventCalendar === 'lunar') {
      const tz = lunarTimeZone(locale);
      const convert = (raw: string): string | null => {
        if (catalog.lunarMonthEnd || usesLunarMonthEnd(special, year)) {
          const p = parseYmd(raw);
          if (!p) return null;
          return lunarMonthLastSolarYmd(p.y, p.m, tz);
        }
        return lunarYmdToSolarYmd(raw, tz);
      };
      const start = convert(startRaw);
      const end = convert(endRaw);
      const peak = convert(peakRaw);
      if (!start || !end || !peak) return null;
      return orderedWindow(start, end, peak);
    }
    if (!parseYmd(startRaw) || !parseYmd(endRaw) || !parseYmd(peakRaw)) {
      return null;
    }
    return orderedWindow(startRaw, endRaw, peakRaw);
  }

  const cal = (special.eventCalendar || '').toLowerCase();
  const srcStart = (
    special.effectiveStartDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    ''
  ).trim();
  const srcEnd = (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    srcStart
  ).trim();
  const srcPeak = (
    special.effectiveEventDate ||
    special.eventDate ||
    srcStart
  ).trim();
  const startP = parseYmd(srcStart);
  if (!startP) return null;
  const endP = parseYmd(srcEnd) ?? startP;
  const peakP = parseYmd(srcPeak) ?? startP;
  const tz = lunarTimeZone(locale);

  if (cal === 'lunar') {
    const eventP = parseYmd((special.eventDate || '').trim());
    const startL = solarToLunar(startP.d, startP.m, startP.y, tz);
    const endL = solarToLunar(endP.d, endP.m, endP.y, tz);
    const peakL = eventP
      ? { month: eventP.m, day: eventP.d }
      : solarToLunar(peakP.d, peakP.m, peakP.y, tz);
    const start = lunarYmdToSolarYmd(
      `${year}-${pad2(startL.month)}-${pad2(startL.day)}`,
      tz,
    );
    const end = lunarYmdToSolarYmd(
      `${year}-${pad2(endL.month)}-${pad2(endL.day)}`,
      tz,
    );
    const peak = lunarYmdToSolarYmd(
      `${year}-${pad2(peakL.month)}-${pad2(peakL.day)}`,
      tz,
    );
    if (!start || !end || !peak) return null;
    return orderedWindow(start, end, peak);
  }

  const start = solarYmdInYear(srcStart, year);
  const end = solarYmdInYear(srcEnd, year);
  const peak = solarYmdInYear(srcPeak, year);
  if (!start || !end || !peak) return null;
  return orderedWindow(start, end, peak);
}

/** Next window whose end is today or later (this year, else next). */
export function nextSpecialWindow(
  special: TempleSpecialProfileUi,
  today: string,
  locale = 'vi',
): SpecialWindow | null {
  const monthly = monthlyLunarSpec(special, locale);
  if (monthly) {
    return monthlyWindowFrom(monthly, today, locale);
  }
  const p = parseYmd(today);
  if (!p) return null;
  for (let y = p.y - 1; y <= p.y + 2; y++) {
    const w = specialWindowInYear(special, y, locale);
    if (w && w.end >= today) return w;
  }
  return null;
}

export function projectSpecialWindow(
  special: TempleSpecialProfileUi,
  window: SpecialWindow,
  today = todayYmd(),
): TempleSpecialProfileUi {
  const inWindow = today >= window.start && today <= window.end;
  return {
    ...special,
    effectiveStartDate: window.start,
    effectiveEndDate: window.end,
    effectiveEventDate: window.peak,
    active: inWindow,
  };
}

export function specialCoversYmd(
  special: TempleSpecialProfileUi,
  ymd: string,
  locale = 'vi',
): boolean {
  const monthly = monthlyLunarSpec(special, locale);
  if (monthly) {
    return solarYmdInMonthlyLunar(ymd, monthly, lunarTimeZone(locale));
  }
  const p = parseYmd(ymd);
  if (!p) return false;
  for (const y of [p.y - 1, p.y, p.y + 1]) {
    const w = specialWindowInYear(special, y, locale);
    if (w && ymd >= w.start && ymd <= w.end) return true;
  }
  return false;
}

export function specialsOnYmd(
  specials: TempleSpecialProfileUi[] | null | undefined,
  ymd: string,
  locale = 'vi',
): TempleSpecialProfileUi[] {
  return (specials ?? []).filter(s => specialCoversYmd(s, ymd, locale));
}

function specialStartYmd(special: TempleSpecialProfileUi): string {
  return (
    special.effectiveStartDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    ''
  ).trim();
}

function specialEndYmd(special: TempleSpecialProfileUi): string {
  return (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    specialStartYmd(special)
  ).trim();
}

/** True when the special is still on or after the selected day. */
export function specialOnOrAfterYmd(
  special: TempleSpecialProfileUi,
  ymd: string,
  locale = 'vi',
): boolean {
  if (specialCoversYmd(special, ymd, locale)) return true;
  const end = specialEndYmd(special);
  return Boolean(end && end >= ymd);
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

/** Special's recurring window overlaps this solar month. */
export function specialOverlapsMonth(
  special: TempleSpecialProfileUi,
  year: number,
  month: number,
  locale = 'vi',
): boolean {
  const monthly = monthlyLunarSpec(special, locale);
  const { start: monthStart, end: monthEnd } = monthStartEnd(year, month);
  if (monthly) {
    const occ = monthlyWindowFrom(monthly, monthStart, locale);
    return Boolean(occ && occ.start <= monthEnd && occ.end >= monthStart);
  }
  for (const y of [year - 1, year, year + 1]) {
    const w = specialWindowInYear(special, y, locale);
    if (w && w.start <= monthEnd && w.end >= monthStart) return true;
  }
  return false;
}

export function specialsInMonth(
  specials: TempleSpecialProfileUi[] | null | undefined,
  year: number,
  month: number,
  locale = 'vi',
  today = todayYmd(),
): TempleSpecialProfileUi[] {
  const { start: monthStart, end: monthEnd } = monthStartEnd(year, month);
  const out: TempleSpecialProfileUi[] = [];
  const seen = new Set<string>();
  for (const s of specials ?? []) {
    const key = (s.id || s.profileId || s.name || '').trim().toLowerCase();
    const monthly = monthlyLunarSpec(s, locale);
    if (monthly) {
      const occ = monthlyWindowFrom(monthly, monthStart, locale);
      if (occ && occ.start <= monthEnd && occ.end >= monthStart) {
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        out.push(projectSpecialWindow(s, occ, today));
      }
      continue;
    }
    for (const y of [year - 1, year, year + 1]) {
      const w = specialWindowInYear(s, y, locale);
      if (!w || w.start > monthEnd || w.end < monthStart) continue;
      if (key && seen.has(key)) break;
      if (key) seen.add(key);
      out.push(projectSpecialWindow(s, w, today));
      break;
    }
  }
  return out;
}

/** Selected-day specials first, then later days in the month. Past days omitted. */
export function orderMonthSpecials(
  specials: TempleSpecialProfileUi[],
  selectedYmd: string,
  locale = 'vi',
): TempleSpecialProfileUi[] {
  const upcoming = specials.filter(s =>
    specialOnOrAfterYmd(s, selectedYmd, locale),
  );
  const onDay: TempleSpecialProfileUi[] = [];
  const rest: TempleSpecialProfileUi[] = [];
  for (const s of upcoming) {
    if (specialCoversYmd(s, selectedYmd, locale)) onDay.push(s);
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

/** Lunar giỗ or solar death anniversary falls on this grid day. */
export function memorialOnYmd(
  memorial: CalendarMemorial,
  day: CalendarDay,
  locale: string,
): boolean {
  const p = parseYmd(memorial.deathYmd);
  if (!p) return false;
  if (p.m === day.solarM && p.d === day.solarD) return true;
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

/** Unique giỗ from the selected day onward in this month; selected day first. */
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
    if (day.ymd < selectedYmd) continue;
    for (const m of memorials) {
      if (!memorialOnYmd(m, day, locale)) continue;
      const key =
        `${m.parentTxid.trim().toLowerCase() || m.name}:${day.ymd}`;
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

/** Empty copy under the calendar: remaining month vs this solar day. */
export type CalendarEmptyKind = 'month' | 'day' | null;

export function calendarEmptyKind(
  remainingCount: number,
  selectedDayCount: number,
): CalendarEmptyKind {
  if (remainingCount <= 0) return 'month';
  if (selectedDayCount <= 0) return 'day';
  return null;
}

export type AppTab = 'home' | 'calendar';

function hashPath(hash: string): string {
  return hash.replace(/^#\/?/, '').trim();
}

export function tabFromHash(hash: string): AppTab {
  const h = hashPath(hash).toLowerCase();
  return h === 'calendar' || h.startsWith('calendar/') ? 'calendar' : 'home';
}

export function calendarYmdFromHash(hash: string): string | null {
  const m = /^calendar\/(\d{4}-\d{2}-\d{2})$/i.exec(hashPath(hash));
  if (!m) return null;
  const parsed = parseYmd(m[1]);
  if (!parsed || parsed.m < 1 || parsed.m > 12 || parsed.d < 1 || parsed.d > 31) {
    return null;
  }
  return m[1];
}

export function hashForTab(tab: AppTab): string {
  return tab === 'calendar' ? '#/calendar' : '#/';
}

export function hashForCalendar(ymd?: string): string {
  return calendarYmdFromHash(`#/calendar/${ymd ?? ''}`)
    ? `#/calendar/${ymd}`
    : '#/calendar';
}
