import {
  hourInTimeZone,
  memorialOccursOnYmd,
  ymdInTimeZone,
} from '../src/lib/memorialDay.js';
import { solarYmdToLunarYmd, lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';

describe('memorialOccursOnYmd', () => {
  it('matches the same solar month and day in a later year', () => {
    expect(memorialOccursOnYmd('2001-10-20', '2026-10-20', 'vi')).toBe(true);
    expect(memorialOccursOnYmd('2001-10-20', '2026-10-21', 'vi')).toBe(false);
  });

  it('matches the lunar month and day on a different solar date', () => {
    const death = '2024-08-18';
    const lunar = solarYmdToLunarYmd(death, 7);
    expect(lunar).toBeTruthy();
    const nextYear = lunar!.replace(/^\d{4}/, '2025');
    const solarNext = lunarYmdToSolarYmd(nextYear, 7);
    expect(solarNext).toBeTruthy();
    expect(solarNext).not.toBe(death);
    expect(memorialOccursOnYmd(death, solarNext!, 'vi')).toBe(true);
  });
});

describe('time zone civil clock', () => {
  it('reads UTC date and hour', () => {
    const noon = new Date('2026-10-20T07:15:00.000Z');
    expect(ymdInTimeZone(noon, 'UTC')).toBe('2026-10-20');
    expect(hourInTimeZone(noon, 'UTC')).toBe(7);
  });
});
