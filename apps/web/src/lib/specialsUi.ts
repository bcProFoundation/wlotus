import { solarToLunar } from './lunarCalendar.js';

/**
 * Temple specials UI helpers — kind-driven copy + story during soft pray.
 * Status comes from GET /api/status → templeSpecials.
 */

export type TempleSpecialKindUi = 'ghost' | 'hero' | 'event';

export interface TempleSpecialProfileUi {
  profileId: string;
  kind: TempleSpecialKindUi;
  name: string | null;
  active: boolean;
  eventDate?: string;
  eventCalendar?: string;
  effectiveEventDate?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  storyTitle?: string | null;
  storyBody?: string | null;
  storyTitleEn?: string | null;
  storyBodyEn?: string | null;
}

export interface TempleSpecialsStatusUi {
  enabled?: boolean;
  deskKeep?: number;
  burnAtoms?: string;
  profiles?: TempleSpecialProfileUi[];
  active?: TempleSpecialProfileUi[];
}

export function findSpecialForParent(
  status: TempleSpecialsStatusUi | null | undefined,
  parentBurnTxid: string | undefined | null,
): TempleSpecialProfileUi | null {
  const id = (parentBurnTxid ?? '').trim().toLowerCase();
  if (!id || id.length !== 64) return null;
  const list = status?.profiles ?? status?.active ?? [];
  return list.find(p => p.profileId.toLowerCase() === id) ?? null;
}

/** True when this parent is currently in an active special window. */
export function isActiveSpecialParent(
  status: TempleSpecialsStatusUi | null | undefined,
  parentBurnTxid: string | undefined | null,
): boolean {
  const id = (parentBurnTxid ?? '').trim().toLowerCase();
  if (!id) return false;
  return (status?.active ?? []).some(p => p.profileId.toLowerCase() === id);
}

/**
 * Primary action button label key selection.
 * ghost → Cúng; event/hero/default → Dâng Hoa (normal offer).
 */
export function specialOfferButtonKind(
  special: TempleSpecialProfileUi | null,
): 'cung' | 'offer' {
  if (special?.active && special.kind === 'ghost') return 'cung';
  return 'offer';
}

/** Session / popup title preference for an active special. */
export function specialSessionTitle(
  special: TempleSpecialProfileUi | null,
  locale: string,
): string | null {
  if (!special?.active) return null;
  if (special.kind === 'event') {
    if (locale.startsWith('vi')) return special.storyTitle || 'Vu Lan Báo Hiếu';
    if (locale.startsWith('zh')) return special.storyTitleEn || '盂兰盆 — 报恩';
    return special.storyTitleEn || special.storyTitle || 'Vu Lan — Filial Gratitude';
  }
  if (special.kind === 'ghost') {
    return special.name || (locale.startsWith('vi') ? 'Cô Hồn' : 'Hungry Ghosts');
  }
  return special.name;
}

/** Story body for soft-pray reading (prefer locale). */
export function specialStoryForLocale(
  special: TempleSpecialProfileUi | null,
  locale: string,
): { title: string; body: string } | null {
  if (!special) return null;
  const useEn = locale.startsWith('en') || locale.startsWith('zh');
  const title = useEn
    ? special.storyTitleEn || special.storyTitle
    : special.storyTitle || special.storyTitleEn;
  const body = useEn
    ? special.storyBodyEn || special.storyBody
    : special.storyBody || special.storyBodyEn;
  if (!body?.trim()) return null;
  return { title: (title || special.name || '').trim(), body: body.trim() };
}

/**
 * Section label above AltarDetails in offer/session UI.
 * ghost/event → null (no "Ban thờ"); hero/default → normal altar/profile label.
 */
export function specialHidesAltarSectionLabel(
  special: TempleSpecialProfileUi | null,
): boolean {
  if (!special) return false;
  return special.kind === 'ghost' || special.kind === 'event';
}

export interface RankedTempleSpecial extends TempleSpecialProfileUi {
  /** Peak / end event day used for ranking (solar YYYY-MM-DD when known). */
  sortDate: string;
  /** Public or local offering count under this profile root. */
  offerCount: number;
}

/**
 * Top specials for the home ranking list.
 * Sort: event date (later first), then offering count (desc) on the same day.
 */
export function rankTempleSpecials(
  profiles: TempleSpecialProfileUi[] | null | undefined,
  offerCountByProfileId: Record<string, number> | Map<string, number>,
  limit = 5,
): RankedTempleSpecial[] {
  const list = profiles ?? [];
  const getCount = (id: string): number => {
    const key = id.toLowerCase();
    if (offerCountByProfileId instanceof Map) {
      return offerCountByProfileId.get(key) ?? 0;
    }
    return offerCountByProfileId[key] ?? 0;
  };

  const ranked: RankedTempleSpecial[] = list.map(p => {
    const sortDate = (
      p.effectiveEventDate ||
      p.effectiveEndDate ||
      p.eventDate ||
      ''
    ).trim();
    return {
      ...p,
      sortDate,
      offerCount: getCount(p.profileId),
    };
  });

  ranked.sort((a, b) => {
    if (a.sortDate !== b.sortDate) {
      if (!a.sortDate) return 1;
      if (!b.sortDate) return -1;
      return b.sortDate.localeCompare(a.sortDate);
    }
    if (a.offerCount !== b.offerCount) return b.offerCount - a.offerCount;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '', 'vi');
  });

  return ranked.slice(0, Math.max(0, limit));
}

/**
 * Display the event day in the calendar the special is defined on.
 * lunar → lunar YMD label; solar → solar YYYY-MM-DD (effective when known).
 */
/**
 * Event date label in the special's own calendar.
 * Multi-day windows → "start–end" range (prefers start over peak/finish alone).
 * Lunar calendar: convert effective solar bounds back to lunar day/month.
 */
export function formatSpecialEventDateLabel(
  special: TempleSpecialProfileUi,
  locale: string,
): string {
  const cal = (special.eventCalendar || 'solar').toLowerCase();
  const startSolar = (
    special.effectiveStartDate ||
    special.effectiveEventDate ||
    special.eventDate ||
    ''
  ).trim();
  const endSolar = (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    startSolar
  ).trim();

  const parseYmd = (
    ymd: string,
  ): { y: number; m: number; d: number } | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  };

  const formatSolar = (ymd: string): string => ymd;

  const formatLunarFromSolar = (ymd: string): string | null => {
    const p = parseYmd(ymd);
    if (!p) return null;
    // VN lunar tradition ≈ UTC+7; zh ≈ UTC+8
    const tz = locale.startsWith('zh') ? 8 : 7;
    try {
      const lunar = solarToLunar(p.d, p.m, p.y, tz);
      if (locale.startsWith('vi')) {
        const leap = lunar.leap ? ' (nhuận)' : '';
        return `${lunar.day}/${lunar.month}${leap}`;
      }
      if (locale.startsWith('zh')) {
        const leap = lunar.leap ? '闰' : '';
        return `${leap}${lunar.month}月${lunar.day}日`;
      }
      return `Lunar ${lunar.year}-${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  // Prefer stored lunar eventDate only for single-day when no solar range
  const singleLunarStored = (): string | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((special.eventDate || '').trim());
    if (!m) return null;
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (locale.startsWith('vi')) return `${d}/${mo} Âm lịch`;
    if (locale.startsWith('zh')) return `农历${mo}月${d}日`;
    return `Lunar ${m[1]}-${m[2]}-${m[3]}`;
  };

  if (cal === 'lunar') {
    const a = startSolar ? formatLunarFromSolar(startSolar) : null;
    const b =
      endSolar && endSolar !== startSolar
        ? formatLunarFromSolar(endSolar)
        : null;
    if (a && b) {
      if (locale.startsWith('vi')) return `${a}–${b} Âm lịch`;
      if (locale.startsWith('zh')) return `农历${a}–${b}`;
      return `${a} – ${b}`;
    }
    if (a) {
      if (locale.startsWith('vi')) return `${a} Âm lịch`;
      if (locale.startsWith('zh')) return `农历${a}`;
      return a;
    }
    return singleLunarStored() || startSolar || '';
  }

  // Solar calendar
  if (startSolar && endSolar && startSolar !== endSolar) {
    return `${formatSolar(startSolar)} – ${formatSolar(endSolar)}`;
  }
  return formatSolar(startSolar || endSolar || (special.eventDate || '').trim());
}

export type SpecialCountdown =
  | { kind: 'days'; days: number }
  | { kind: 'today' }
  | { kind: 'ongoing' }
  | { kind: 'past'; days: number }
  | { kind: 'none' };

/**
 * Days from local today to the special window.
 * Uses effectiveStartDate when present (range events like Cô Hồn),
 * else effectiveEventDate / eventDate.
 * Inside [start, end] → ongoing; on start day before end → today if single day.
 */
export function specialCountdown(
  special: TempleSpecialProfileUi,
  now: Date = new Date(),
): SpecialCountdown {
  const start =
    (special.effectiveStartDate || special.effectiveEventDate || '').trim();
  const end = (
    special.effectiveEndDate ||
    special.effectiveEventDate ||
    start
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { kind: 'none' };

  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const parse = (ymd: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const startMs = parse(start);
  const endMs = parse(end) ?? startMs;
  if (startMs == null || endMs == null) return { kind: 'none' };

  if (todayUtc < startMs) {
    return {
      kind: 'days',
      days: Math.round((startMs - todayUtc) / 86_400_000),
    };
  }
  if (todayUtc > endMs) {
    return {
      kind: 'past',
      days: Math.round((todayUtc - endMs) / 86_400_000),
    };
  }
  // Inside window
  if (startMs === endMs) return { kind: 'today' };
  return { kind: 'ongoing' };
}

