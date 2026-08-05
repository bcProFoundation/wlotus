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
