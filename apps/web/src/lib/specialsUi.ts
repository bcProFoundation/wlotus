import { solarToLunar } from './lunarCalendar.js';
import { specialVisibleToViewer } from './specialCountries.js';
import {
  nextSpecialWindow,
  projectSpecialWindow,
  todayYmd,
} from './calendarMonth.js';

/**
 * Temple specials UI helpers — kind-driven copy + story during soft pray.
 * Status comes from GET /api/status → templeSpecials.
 */

export type TempleSpecialKindUi = 'ghost' | 'hero' | 'event';

export interface TempleSpecialProfileUi {
  id?: string;
  profileId: string;
  kind: TempleSpecialKindUi;
  name: string | null;
  active: boolean;
  eventDate?: string;
  eventCalendar?: string;
  effectiveEventDate?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  storyTitle?: string | null;
  storyBody?: string | null;
  storyTitleEn?: string | null;
  storyBodyEn?: string | null;
  storyTitleZh?: string | null;
  storyBodyZh?: string | null;
  /** ISO country codes. Empty / omitted = Global. */
  countries?: string[];
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

export function isBoundSpecialRoot(profileId: string | null | undefined): boolean {
  return /^[0-9a-f]{64}$/i.test((profileId ?? '').trim());
}
export function filterSpecialsForViewer(
  profiles: TempleSpecialProfileUi[] | null | undefined,
  opts: { countryCode?: string | null; locale?: string | null },
): TempleSpecialProfileUi[] {
  return (profiles ?? []).filter(p =>
    specialVisibleToViewer(p.countries, opts),
  );
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
    if (locale.startsWith('vi')) {
      return special.storyTitle || special.name;
    }
    if (locale.startsWith('zh')) {
      return special.storyTitleZh || special.storyTitleEn || special.name;
    }
    return special.storyTitleEn || special.storyTitle || special.name;
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
  const zh = locale.startsWith('zh');
  const en = locale.startsWith('en');
  const title = zh
    ? special.storyTitleZh || special.storyTitleEn || special.storyTitle
    : en
      ? special.storyTitleEn || special.storyTitle
      : special.storyTitle || special.storyTitleEn;
  const body = zh
    ? special.storyBodyZh || special.storyBodyEn || special.storyBody
    : en
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
  /**
   * Anchor day for display/debug: start when known, else peak/end.
   * Ranking no longer uses “later date first”.
   */
  sortDate: string;
  /** Public or local offering count under this profile root. */
  offerCount: number;
}

/**
 * Top specials for the home ranking list — what’s next / what’s now.
 * Past windows are omitted (forward-looking only).
 *
 * Order:
 *   1. Happening now (active / in window) before upcoming
 *   2. Within a tier: closer in time first
 *        - upcoming → soonest start first
 *        - active   → most offerings first (same day competition, e.g. 15/7)
 *   3. Tie-break: offerCount desc, then name
 *
 * Example (before 2/7 lunar): Cô Hồn (starts sooner) above Vu Lan.
 * On 15/7 when both active: higher burn count on top.
 */
export function rankTempleSpecials(
  profiles: TempleSpecialProfileUi[] | null | undefined,
  offerCountByProfileId: Record<string, number> | Map<string, number>,
  limit = 5,
  now: Date = new Date(),
  locale = 'vi',
): RankedTempleSpecial[] {
  const list = profiles ?? [];
  const getCount = (id: string): number => {
    const key = id.toLowerCase();
    if (offerCountByProfileId instanceof Map) {
      return offerCountByProfileId.get(key) ?? 0;
    }
    return offerCountByProfileId[key] ?? 0;
  };

  const today = todayYmd(now);
  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const parseYmd = (ymd: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  type Tier = 0 | 1 | 2; // 0 active, 1 upcoming, 2 past (dropped)

  const ranked: RankedTempleSpecial[] = [];
  for (const p of list) {
    const window = nextSpecialWindow(p, today, locale);
    if (!window) continue;
    const projected = projectSpecialWindow(p, window, today);
    ranked.push({
      ...projected,
      sortDate: window.start,
      offerCount: getCount(p.profileId),
    });
  }

  const meta = (p: RankedTempleSpecial): { tier: Tier; days: number } => {
    const start = (
      p.effectiveStartDate ||
      p.effectiveEventDate ||
      p.eventDate ||
      ''
    ).trim();
    const end = (
      p.effectiveEndDate ||
      p.effectiveEventDate ||
      start
    ).trim();
    const startMs = parseYmd(start);
    const endMs = parseYmd(end) ?? startMs;
    if (startMs == null || endMs == null) {
      return { tier: 2, days: Number.POSITIVE_INFINITY };
    }
    // Prefer status.active when server already computed the window
    if (p.active || (todayUtc >= startMs && todayUtc <= endMs)) {
      return { tier: 0, days: 0 };
    }
    if (todayUtc < startMs) {
      return {
        tier: 1,
        days: Math.round((startMs - todayUtc) / 86_400_000),
      };
    }
    return {
      tier: 2,
      days: Math.round((todayUtc - endMs) / 86_400_000),
    };
  };

  const forward = ranked.filter(p => meta(p).tier !== 2);

  forward.sort((a, b) => {
    const ma = meta(a);
    const mb = meta(b);
    if (ma.tier !== mb.tier) return ma.tier - mb.tier;
    if (ma.tier === 0) {
      if (a.offerCount !== b.offerCount) return b.offerCount - a.offerCount;
    } else if (ma.days !== mb.days) {
      return ma.days - mb.days;
    } else if (a.offerCount !== b.offerCount) {
      return b.offerCount - a.offerCount;
    }
    return (a.name || '').localeCompare(b.name || '', 'vi');
  });

  return forward.slice(0, Math.max(0, limit));
}

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
