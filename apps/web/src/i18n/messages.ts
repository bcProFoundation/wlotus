import type { Locale } from './types.js';

/** Flat UI strings. Use `{name}` placeholders. */
export type MessageKey =
  | 'brand'
  | 'tagline'
  | 'offerTitle'
  | 'hintPrayMine'
  | 'hintKeepScreen'
  | 'searchCta'
  | 'homeEventsTitle'
  | 'homeEventsOfferings'
  | 'altarEventDate'
  | 'altarEventDateLunar'
  | 'altarEventDateSolar'
  | 'RECOVERY_INCOMPLETE';

type Dict = Record<MessageKey, string>;

const en: Dict = {
  brand: 'W Lotus',
  tagline: 'A flower of eternal remembrance.',
  offerTitle: 'Offer',
  hintPrayMine: 'Pray to find lotus flowers.',
  hintKeepScreen: 'Keep the screen on.',
  searchCta: 'Search',
  homeEventsTitle: 'Events',
  homeEventsOfferings: '{n} offerings',
  altarEventDate: 'Festival day',
  altarEventDateLunar: 'Festival day (lunar)',
  altarEventDateSolar: 'Festival day (solar)',
  RECOVERY_INCOMPLETE: 'INCOMPLETE - restore full messages from artifacts',
};

const vi: Dict = {
  brand: 'W Lotus',
  tagline: 'Hoa sen tưởng niệm vĩnh hằng.',
  offerTitle: 'Dâng hoa',
  hintPrayMine: 'Cầu nguyện để tìm hoa sen.',
  hintKeepScreen: 'Giữ màn hình sáng.',
  searchCta: 'Tìm kiếm',
  homeEventsTitle: 'Sự kiện',
  homeEventsOfferings: '{n} dâng hoa',
  altarEventDate: 'Ngày lễ',
  altarEventDateLunar: 'Ngày lễ (Âm lịch)',
  altarEventDateSolar: 'Ngày lễ (Dương lịch)',
  RECOVERY_INCOMPLETE: 'INCOMPLETE',
};

const zh: Dict = {
  brand: 'W Lotus',
  tagline: '永恒的纪念之花。',
  offerTitle: '供花',
  hintPrayMine: '祈祷以寻找莲花。',
  hintKeepScreen: '保持屏幕开启。',
  searchCta: '搜索',
  homeEventsTitle: '活动',
  homeEventsOfferings: '{n} 次供奉',
  altarEventDate: '节日',
  altarEventDateLunar: '节日（农历）',
  altarEventDateSolar: '节日（公历）',
  RECOVERY_INCOMPLETE: 'INCOMPLETE',
};

const tables: Record<Locale, Dict> = { en, vi, zh };

export function formatMessage(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = tables[locale]?.[key] ?? tables.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v == null ? `{${k}}` : String(v);
  });
}
