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
