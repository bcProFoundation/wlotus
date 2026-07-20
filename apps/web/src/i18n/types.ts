export type Locale = 'en' | 'vi' | 'zh';

export const LOCALES: readonly Locale[] = ['en', 'vi', 'zh'] as const;

export const LOCALE_STORAGE_KEY = 'wlotus.locale';

export interface LocaleOption {
  locale: Locale;
  /** ISO country flag emoji used as the switcher mark. */
  flag: string;
  /** Short label in that language. */
  label: string;
  /** English name for accessibility. */
  nameEn: string;
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { locale: 'en', flag: '🇬🇧', label: 'EN', nameEn: 'English' },
  { locale: 'vi', flag: '🇻🇳', label: 'VI', nameEn: 'Vietnamese' },
  { locale: 'zh', flag: '🇨🇳', label: '中文', nameEn: 'Chinese' },
] as const;
