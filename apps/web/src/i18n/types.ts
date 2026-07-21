export type Locale = 'en' | 'vi' | 'zh';

export const LOCALES: readonly Locale[] = ['en', 'vi', 'zh'] as const;

export const LOCALE_STORAGE_KEY = 'wlotus.locale';

export interface LocaleOption {
  locale: Locale;
  /** Short text label shown in the switcher (no flags — colors clash on dark UI). */
  label: string;
  /** English name for accessibility / menu secondary. */
  nameEn: string;
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { locale: 'en', label: 'EN', nameEn: 'English' },
  { locale: 'vi', label: 'VI', nameEn: 'Vietnamese' },
  { locale: 'zh', label: '中文', nameEn: 'Chinese' },
] as const;
