import {
  canonicalizeCountryCode,
  countriesFromLocale,
  ENGLISH_SPEAKING_COUNTRIES,
  normalizeSpecialCountries,
  specialVisibleToViewer,
} from '../src/params/specialCountries.js';

describe('specialCountries', () => {
  it('canonicalizes ISO codes and aliases', () => {
    expect(canonicalizeCountryCode('vn')).toBe('VN');
    expect(canonicalizeCountryCode('Việt Nam')).toBe('VN');
    expect(canonicalizeCountryCode('UK')).toBe('GB');
    expect(canonicalizeCountryCode('*')).toBe('*');
    expect(canonicalizeCountryCode('GLOBAL')).toBe('*');
    expect(canonicalizeCountryCode('Mỹ Thành, Phù Mỹ')).toBeNull();
  });

  it('treats omitted / * / GLOBAL as empty (Global)', () => {
    expect(normalizeSpecialCountries(undefined)).toEqual([]);
    expect(normalizeSpecialCountries('*')).toEqual([]);
    expect(normalizeSpecialCountries(['GLOBAL'])).toEqual([]);
    expect(normalizeSpecialCountries('VN')).toEqual(['VN']);
    expect(normalizeSpecialCountries(['vn', 'CN', 'VN'])).toEqual(['VN', 'CN']);
    expect(normalizeSpecialCountries('VN, CN')).toEqual(['VN', 'CN']);
  });

  it('maps locale to local countries for that language region', () => {
    expect(countriesFromLocale('vi')).toEqual(['VN']);
    expect(countriesFromLocale('zh-Hans')).toEqual(['CN', 'TW', 'HK', 'MO']);
    expect(countriesFromLocale('en')).toEqual(
      ENGLISH_SPEAKING_COUNTRIES.filter(c => c !== 'SG'),
    );
    expect(countriesFromLocale('en')).not.toContain('SG');
    expect(countriesFromLocale('zh')).not.toContain('SG');
  });

  it('shows Global specials to everyone', () => {
    expect(specialVisibleToViewer([], { countryCode: 'US', locale: 'en' })).toBe(
      true,
    );
    expect(specialVisibleToViewer(undefined, { locale: 'zh' })).toBe(true);
  });

  it('uses the selected language as the region, not IP ∪ locale', () => {
    const vn = ['VN'];
    const zh = ['CN', 'TW', 'HK', 'MO', 'SG'];
    // Language switch must drop the other country's calendar.
    expect(specialVisibleToViewer(vn, { countryCode: 'VN', locale: 'en' })).toBe(
      false,
    );
    expect(specialVisibleToViewer(zh, { countryCode: 'VN', locale: 'vi' })).toBe(
      false,
    );
    expect(specialVisibleToViewer(vn, { countryCode: 'VN', locale: 'vi' })).toBe(
      true,
    );
    expect(specialVisibleToViewer(zh, { countryCode: 'VN', locale: 'zh' })).toBe(
      true,
    );
    // Diaspora: vi in the US still sees Vietnam, not US-only events.
    expect(specialVisibleToViewer(vn, { countryCode: 'US', locale: 'vi' })).toBe(
      true,
    );
    expect(
      specialVisibleToViewer(['US'], { countryCode: 'US', locale: 'vi' }),
    ).toBe(false);
    expect(specialVisibleToViewer(vn, { countryCode: 'US', locale: 'en' })).toBe(
      false,
    );
    expect(specialVisibleToViewer(['CN'], { locale: 'zh' })).toBe(true);
    expect(
      specialVisibleToViewer(['US'], { countryCode: null, locale: 'en' }),
    ).toBe(true);
    expect(
      specialVisibleToViewer(vn, { countryCode: null, locale: 'en' }),
    ).toBe(false);
  });

  it('narrows to IP country when it sits in the language region', () => {
    expect(
      specialVisibleToViewer(['US'], { countryCode: 'US', locale: 'en' }),
    ).toBe(true);
    expect(
      specialVisibleToViewer(['AU', 'NZ'], { countryCode: 'US', locale: 'en' }),
    ).toBe(false);
    expect(
      specialVisibleToViewer(['AU', 'NZ'], { countryCode: 'AU', locale: 'en' }),
    ).toBe(true);
    expect(
      specialVisibleToViewer(['US'], { countryCode: 'AU', locale: 'en' }),
    ).toBe(false);
    // English-speaking list still matches a US viewer (Halloween / All Souls).
    expect(
      specialVisibleToViewer([...ENGLISH_SPEAKING_COUNTRIES], {
        countryCode: 'US',
        locale: 'en',
      }),
    ).toBe(true);
  });

  it('does not show Chinese events in English (Singapore overlap)', () => {
    const zh = ['CN', 'TW', 'HK', 'MO', 'SG'];
    const en = [...ENGLISH_SPEAKING_COUNTRIES];
    expect(
      specialVisibleToViewer(zh, { countryCode: 'US', locale: 'en' }),
    ).toBe(false);
    expect(
      specialVisibleToViewer(zh, { countryCode: null, locale: 'en' }),
    ).toBe(false);
    // Vietnam (or any out-of-region IP) + English must not pick up ZH via SG.
    expect(
      specialVisibleToViewer(zh, { countryCode: 'VN', locale: 'en' }),
    ).toBe(false);
    expect(
      specialVisibleToViewer(en, { countryCode: 'VN', locale: 'zh' }),
    ).toBe(false);
    expect(
      specialVisibleToViewer(zh, { countryCode: 'VN', locale: 'zh' }),
    ).toBe(true);
  });
});
