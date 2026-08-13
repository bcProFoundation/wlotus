import {
  canonicalizeCountryCode,
  countriesFromLocale,
  normalizeSpecialCountries,
  specialVisibleToViewer,
} from '../src/params/specialCountries.js';

describe('specialCountries', () => {
  it('canonicalizes ISO codes and aliases', () => {
    expect(canonicalizeCountryCode('vn')).toBe('VN');
    expect(canonicalizeCountryCode('Việt Nam')).toBe('VN');
    expect(canonicalizeCountryCode('Vietnam')).toBe('VN');
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

  it('maps locale to local countries for diaspora', () => {
    expect(countriesFromLocale('vi')).toEqual(['VN']);
    expect(countriesFromLocale('zh-Hans')).toEqual([
      'CN',
      'TW',
      'HK',
      'MO',
      'SG',
    ]);
    expect(countriesFromLocale('en')).toEqual([]);
  });

  it('shows Global specials to everyone', () => {
    expect(specialVisibleToViewer([], { countryCode: 'US', locale: 'en' })).toBe(
      true,
    );
    expect(specialVisibleToViewer(undefined, { locale: 'zh' })).toBe(true);
  });

  it('matches IP country or locale-implied country', () => {
    const vn = ['VN'];
    expect(specialVisibleToViewer(vn, { countryCode: 'VN', locale: 'en' })).toBe(
      true,
    );
    expect(specialVisibleToViewer(vn, { countryCode: 'US', locale: 'vi' })).toBe(
      true,
    );
    expect(specialVisibleToViewer(vn, { countryCode: 'US', locale: 'en' })).toBe(
      false,
    );
    expect(specialVisibleToViewer(['VN', 'CN'], { locale: 'zh' })).toBe(true);
    expect(
      specialVisibleToViewer(vn, { countryCode: null, locale: 'en' }),
    ).toBe(false);
  });
});
