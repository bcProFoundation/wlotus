import {
  formatActualDurationLocale,
  formatOfferedAtLocale,
} from '../apps/web/src/i18n/format.js';
import { interpolate, MESSAGES } from '../apps/web/src/i18n/messages.js';

describe('formatOfferedAtLocale', () => {
  const at = Date.UTC(2026, 7, 22, 11, 25, 0);

  it('returns a date and time for each locale', () => {
    for (const locale of ['en', 'vi', 'zh'] as const) {
      const s = formatOfferedAtLocale(at, locale);
      expect(s).toMatch(/2026/);
      expect(s.length).toBeGreaterThan(8);
    }
  });

  it('falls back for non-finite timestamps', () => {
    expect(formatOfferedAtLocale(Number.NaN, 'vi')).toBe('—');
  });

  it('labels the timestamp in Vietnamese', () => {
    expect(
      interpolate(MESSAGES.vi.offerSuccessWhen, { when: '22/08/2026, 19:25' }),
    ).toBe('Dâng lúc 22/08/2026, 19:25');
  });
});

describe('formatActualDurationLocale', () => {
  it('uses Vietnamese units', () => {
    expect(formatActualDurationLocale(90, 'vi')).toBe('1.5 phút');
  });
});
