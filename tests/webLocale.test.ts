import { describe, expect, it } from 'vitest';
import {
  localeFromCountryCode,
  localeFromNavigator,
} from '../apps/web/src/i18n/detectLocale.js';
import { interpolate, MESSAGES } from '../apps/web/src/i18n/messages.js';

describe('web locale detect', () => {
  it('maps VN → vi and CN/TW/HK → zh', () => {
    expect(localeFromCountryCode('VN')).toBe('vi');
    expect(localeFromCountryCode('cn')).toBe('zh');
    expect(localeFromCountryCode('TW')).toBe('zh');
    expect(localeFromCountryCode('US')).toBeNull();
  });

  it('reads navigator language tags', () => {
    expect(localeFromNavigator(['vi-VN', 'en'])).toBe('vi');
    expect(localeFromNavigator(['zh-CN'])).toBe('zh');
    expect(localeFromNavigator(['fr-FR'])).toBe('en');
  });
});

describe('web messages', () => {
  it('has the same keys in en/vi/zh', () => {
    const keys = Object.keys(MESSAGES.en).sort();
    expect(Object.keys(MESSAGES.vi).sort()).toEqual(keys);
    expect(Object.keys(MESSAGES.zh).sort()).toEqual(keys);
  });

  it('interpolates placeholders', () => {
    expect(interpolate('Mine {ticker}', { ticker: 'dWLOTUS' })).toBe(
      'Mine dWLOTUS',
    );
  });
});
