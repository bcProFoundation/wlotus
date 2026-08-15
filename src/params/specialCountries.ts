/**
 * Country targeting for temple specials.
 *
 * Source of truth is the off-chain registry (`countries` on TEMPLE_SPECIALS_JSON),
 * not the on-chain altar `birthPlace` slot:
 *   - Existing Vu Lan / Cô Hồn roots have empty birthPlace and cannot be rewritten.
 *   - birthPlace is free-text quê quán, not ISO codes — poor for matching.
 *   - Multi-country needs a list; the DANA note has a single birthPlace string.
 *
 * Convention:
 *   - [] / omitted / "*", "GLOBAL" → Global (every viewer).
 *   - ["VN"] → Vietnam only.
 *   - ["VN","CN"] → multi-country.
 *
 * Visibility (home events list only — share links and burns stay open):
 *   Global → everyone
 *   Else → selected language's region, then that country if IP is in-region.
 *   Picking English must not keep Vietnamese *or* Chinese events.
 *   Singapore is on both ZH and EN catalog lists (bilingual) but must not
 *   be implied by locale, or `en` matches every Chinese special via SG.
 */

/** Tokens that mean "show everywhere". */
export const GLOBAL_COUNTRY_TOKENS = new Set([
  '*',
  'GLOBAL',
  'ALL',
  'WW',
  'WORLD',
]);

/** Vietnam home-list targeting. */
export const VIETNAM_COUNTRIES = ['VN'] as const;

/** Chinese-language regions (and Singapore). */
export const CHINESE_SPEAKING_COUNTRIES = [
  'CN',
  'TW',
  'HK',
  'MO',
  'SG',
] as const;

/**
 * English-speaking countries for All Souls / Remembrance.
 * Singapore is also in the Chinese catalog list (bilingual).
 */
export const ENGLISH_SPEAKING_COUNTRIES = [
  'US',
  'GB',
  'CA',
  'AU',
  'NZ',
  'IE',
  'ZA',
  'PH',
  'SG',
] as const;

/**
 * Do not imply SG from `en` / `zh`. Catalog rows still list SG so an
 * in-region IP can narrow; locale overlap would leak ZH events into English
 * (and EN events into Chinese) for anyone whose IP is outside the region
 * (typical: Vietnam user with English UI).
 */
const LOCALE_SKIP_OVERLAP = new Set(['SG']);

/** Common names → ISO 3166-1 alpha-2. Unknown 2-letter codes pass through. */
const COUNTRY_ALIASES: Record<string, string> = {
  VN: 'VN',
  VIETNAM: 'VN',
  'VIET NAM': 'VN',
  'VIỆT NAM': 'VN',
  CN: 'CN',
  CHINA: 'CN',
  PRC: 'CN',
  'TRUNG QUỐC': 'CN',
  TW: 'TW',
  TAIWAN: 'TW',
  HK: 'HK',
  'HONG KONG': 'HK',
  MO: 'MO',
  MACAU: 'MO',
  MACAO: 'MO',
  SG: 'SG',
  SINGAPORE: 'SG',
  KH: 'KH',
  CAMBODIA: 'KH',
  LA: 'LA',
  LAOS: 'LA',
  TH: 'TH',
  THAILAND: 'TH',
  US: 'US',
  USA: 'US',
  'UNITED STATES': 'US',
  GB: 'GB',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  BRITAIN: 'GB',
  CA: 'CA',
  CANADA: 'CA',
  AU: 'AU',
  AUSTRALIA: 'AU',
  NZ: 'NZ',
  'NEW ZEALAND': 'NZ',
  IE: 'IE',
  IRELAND: 'IE',
  ZA: 'ZA',
  'SOUTH AFRICA': 'ZA',
  PH: 'PH',
  PHILIPPINES: 'PH',
};

export function canonicalizeCountryCode(
  raw: string | null | undefined,
): string | '*' | null {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFC');
  if (!t) return null;
  if (GLOBAL_COUNTRY_TOKENS.has(t)) return '*';
  if (/^[A-Z]{2}$/.test(t)) return COUNTRY_ALIASES[t] ?? t;
  return COUNTRY_ALIASES[t] ?? null;
}

/**
 * Parse JSON `countries` / `country` into ISO codes.
 * Empty array = Global.
 */
export function normalizeSpecialCountries(raw: unknown): string[] {
  const items: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      for (const x of v) push(x);
      return;
    }
    const s = String(v).trim();
    if (!s) return;
    for (const part of s.split(/[,/;|]+/)) {
      const p = part.trim();
      if (p) items.push(p);
    }
  };
  push(raw);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const code = canonicalizeCountryCode(item);
    if (!code) continue;
    if (code === '*') return [];
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Locale → countries that should see that language's local specials. */
export function countriesFromLocale(
  locale: string | null | undefined,
): string[] {
  const l = String(locale ?? '')
    .trim()
    .toLowerCase();
  if (l.startsWith('vi')) return [...VIETNAM_COUNTRIES];
  if (l.startsWith('zh')) {
    return CHINESE_SPEAKING_COUNTRIES.filter(c => !LOCALE_SKIP_OVERLAP.has(c));
  }
  if (l.startsWith('en')) {
    return ENGLISH_SPEAKING_COUNTRIES.filter(c => !LOCALE_SKIP_OVERLAP.has(c));
  }
  return [];
}

/**
 * Whether a special should appear on the home events list for this viewer.
 * Share links / re-offers are not gated.
 *
 * Language is the region lens. Do not union IP with locale — that made
 * Vietnamese events stay on the list after the user picked English.
 * If IP is inside the language region, keep only that country's specials
 * (US English sees Memorial Day, not ANZAC).
 */
export function specialVisibleToViewer(
  countries: string[] | null | undefined,
  opts: { countryCode?: string | null; locale?: string | null } = {},
): boolean {
  const list = countries ?? [];
  if (list.length === 0) return true;

  const region = countriesFromLocale(opts.locale);
  const ip = canonicalizeCountryCode(opts.countryCode);
  const ipCode = ip && ip !== '*' ? ip : null;

  if (region.length > 0) {
    if (!list.some(c => region.includes(c))) return false;
    if (ipCode && region.includes(ipCode)) return list.includes(ipCode);
    return true;
  }

  if (ipCode) return list.includes(ipCode);
  return false;
}
