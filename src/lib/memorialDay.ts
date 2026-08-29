/**
 * Whether a memorial/event date falls on a civil day — same rule as the
 * in-app calendar (solar month/day OR lunar month/day).
 */

import { solarToLunar } from './lunarCalendar.js';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(
  ymd: string,
): { y: number; m: number; d: number } | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Vietnam UTC+7; Chinese locales UTC+8. */
export function lunarTimeZoneHours(locale: string): 7 | 8 {
  return locale.trim().toLowerCase().startsWith('zh') ? 8 : 7;
}

export function memorialOccursOnYmd(
  deathYmd: string,
  onYmd: string,
  locale = 'vi',
): boolean {
  const death = parseYmd(deathYmd);
  const on = parseYmd(onYmd);
  if (!death || !on) return false;
  if (death.m === on.m && death.d === on.d) return true;
  const tz = lunarTimeZoneHours(locale);
  const deathLunar = solarToLunar(death.d, death.m, death.y, tz);
  const onLunar = solarToLunar(on.d, on.m, on.y, tz);
  return (
    deathLunar.day === onLunar.day && deathLunar.month === onLunar.month
  );
}

export function ymdInTimeZone(now: Date, timeZone: string): string {
  const tz = timeZone.trim() || 'Asia/Ho_Chi_Minh';
  const fmt = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return y && m && d ? `${y}-${m}-${d}` : '';
  };
  try {
    return fmt(tz) || fmt('Asia/Ho_Chi_Minh');
  } catch {
    return fmt('Asia/Ho_Chi_Minh');
  }
}

export function hourInTimeZone(now: Date, timeZone: string): number {
  const tz = timeZone.trim() || 'Asia/Ho_Chi_Minh';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = parts.find(p => p.type === 'hour')?.value;
    const n = Number.parseInt(hour || '', 10);
    return Number.isFinite(n) ? n : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}
