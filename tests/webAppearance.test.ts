import {
  defaultAppearance,
  documentTheme,
  effectiveAppearance,
  themeColorFor,
} from '../apps/web/src/i18n/appearance.js';

describe('appearance defaults', () => {
  it('VN defaults to light; EN and CN default to dark', () => {
    expect(defaultAppearance('vi')).toBe('light');
    expect(defaultAppearance('en')).toBe('dark');
    expect(defaultAppearance('zh')).toBe('dark');
  });

  it('stored override wins over locale default', () => {
    expect(effectiveAppearance('vi', 'dark')).toBe('dark');
    expect(effectiveAppearance('en', 'light')).toBe('light');
    expect(effectiveAppearance('zh', null)).toBe('dark');
    expect(effectiveAppearance('vi', null)).toBe('light');
  });
});

describe('document theme', () => {
  it('one light skin for every locale', () => {
    expect(documentTheme('en', 'light')).toBe('light');
    expect(documentTheme('vi', 'light')).toBe('light');
    expect(documentTheme('zh', 'light')).toBe('light');
  });

  it('EN dark is black; VI and CN dark are rosewood', () => {
    expect(documentTheme('en', 'dark')).toBe('dark');
    expect(documentTheme('vi', 'dark')).toBe('wood');
    expect(documentTheme('zh', 'dark')).toBe('wood');
  });

  it('offering ritual forces dark (black or wood)', () => {
    expect(documentTheme('vi', 'light', true)).toBe('wood');
    expect(documentTheme('zh', 'light', true)).toBe('wood');
    expect(documentTheme('en', 'light', true)).toBe('dark');
  });

  it('theme-color matches each skin', () => {
    expect(themeColorFor('light')).toBe('#f3ebe0');
    expect(themeColorFor('wood')).toBe('#140c08');
    expect(themeColorFor('dark')).toBe('#050505');
  });
});
