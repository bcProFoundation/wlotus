import type { Locale } from './types.js';

/** User-facing light/dark. Dark skin depends on locale (black vs rosewood). */
export type Appearance = 'light' | 'dark';

/** Applied `data-theme` on <html>. */
export type DocumentTheme = 'light' | 'dark' | 'wood';

export const APPEARANCE_STORAGE_KEY = 'wlotus.appearance';

/** VN → light cream; EN / CN → dark. VI/ZH dark skin is rosewood; EN dark is black. */
export function defaultAppearance(locale: Locale): Appearance {
  return locale === 'vi' ? 'light' : 'dark';
}

export function readStoredAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)?.trim().toLowerCase();
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  } catch {
    /* ignore */
  }
}

export function clearStoredAppearance(): void {
  try {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function effectiveAppearance(
  locale: Locale,
  stored: Appearance | null,
): Appearance {
  return stored ?? defaultAppearance(locale);
}

/**
 * Map appearance + locale to a document theme.
 * One light skin (cream). Dark: EN black, VI/ZH rosewood.
 * `ritualDark` forces dark during the offering session.
 */
export function documentTheme(
  locale: Locale,
  appearance: Appearance,
  ritualDark = false,
): DocumentTheme {
  const mode = ritualDark ? 'dark' : appearance;
  if (mode === 'light') return 'light';
  return locale === 'en' ? 'dark' : 'wood';
}

export function themeColorFor(theme: DocumentTheme): string {
  if (theme === 'light') return '#f3ebe0';
  if (theme === 'wood') return '#1c120c';
  return '#050505';
}

export function applyDocumentTheme(theme: DocumentTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColorFor(theme));
}
