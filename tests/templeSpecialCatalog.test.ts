import {
  findCatalogEntryByName,
  memorialDaySolarYmd,
  qingmingSolarYmd,
  templeSpecialCatalog,
} from '../src/params/templeSpecialCatalog.js';
import { lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';
import {
  CHINESE_SPEAKING_COUNTRIES,
  ENGLISH_SPEAKING_COUNTRIES,
  VIETNAM_COUNTRIES,
} from '../src/params/specialCountries.js';

describe('temple special catalog', () => {
  it('has VN, Chinese, and English-speaking events, heroes, and ghosts', () => {
    const cat = templeSpecialCatalog(2026);
    const byId = Object.fromEntries(cat.map(e => [e.id, e]));
    expect(byId['vu-lan']!.countries).toEqual([...VIETNAM_COUNTRIES]);
    expect(byId['co-hon']!.kind).toBe('ghost');
    expect(byId['thanh-minh']!.eventDate).toBe('2026-04-05');
    expect(byId['hung-kings']!.eventDate).toBe('2026-03-10');
    expect(byId['hai-ba-trung']!.kind).toBe('hero');
    expect(byId['ho-chi-minh']!.eventCalendar).toBe('lunar');
    expect(byId['ho-chi-minh']!.eventDate).toBe('2026-07-21');
    expect(byId['ho-chi-minh-birthday']!.eventCalendar).toBe('solar');
    expect(byId['ho-chi-minh-birthday']!.eventDate).toBe('2026-05-19');
    expect(byId['yulanpen']!.countries).toEqual([...CHINESE_SPEAKING_COUNTRIES]);
    expect(byId['zhongyuan']!.eventStart).toBe('2026-07-01');
    expect(byId['qingming']!.eventCalendar).toBe('solar');
    expect(byId['hanyi']!.eventDate).toBe('2026-10-01');
    expect(byId['dongzhi']!.eventDate).toBe('2026-12-22');
    expect(byId['guan-yu']!.kind).toBe('hero');
    expect(byId['mazu']!.eventDate).toBe('2026-03-23');
    expect(byId['halloween']!.kind).toBe('ghost');
    expect(byId['all-souls']!.eventDate).toBe('2026-11-02');
    expect(byId['remembrance']!.eventDate).toBe('2026-11-11');
    expect(byId['all-souls']!.countries).toEqual([...ENGLISH_SPEAKING_COUNTRIES]);
    expect(byId['memorial-day']!.eventDate).toBe('2026-05-25');
    expect(byId['memorial-day']!.countries).toEqual(['US']);
    expect(byId['anzac']!.countries).toEqual(['AU', 'NZ']);
    expect(cat.length).toBeGreaterThanOrEqual(19);
  });

  it('says Cô Hồn offering is sharing, not fear', () => {
    const co = templeSpecialCatalog(2026).find(e => e.id === 'co-hon');
    expect(co?.story.body).toContain(
      'Cúng cô hồn không phải sợ hãi mà là sẻ chia',
    );
    expect(co?.story.body).toContain('nguyện cho nhà nhà được bình an');
  });

  it('splits Hồ Chí Minh giỗ (lunar 21/7) from birthday (solar 19 May)', () => {
    const gio = templeSpecialCatalog(2026).find(e => e.id === 'ho-chi-minh');
    const bday = templeSpecialCatalog(2026).find(
      e => e.id === 'ho-chi-minh-birthday',
    );
    expect(gio?.story.body).toContain('21 tháng Bảy');
    expect(gio?.story.body).toContain('2 tháng 9 năm 1969');
    expect(bday?.story.body).toContain('19 tháng 5');
  });

  it('ends each special story with a lotus prayer for peace', () => {
    for (const e of templeSpecialCatalog(2026)) {
      const texts = [e.story.body, e.story.bodyEn, e.story.bodyZh].filter(
        (t): t is string => Boolean(t?.trim()),
      );
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) {
        const last = t.trim().split(/\n\n+/).pop() ?? '';
        expect(last).toMatch(/lời nguyện|prayer|一句愿/);
        expect(last).toMatch(/bình an|peace|安宁|平安/);
      }
    }
  });

  it('matches live Vu Lan / Cô Hồn names and extra aliases', () => {
    expect(findCatalogEntryByName('Vu Lan')?.id).toBe('vu-lan');
    expect(findCatalogEntryByName('Cô Hồn')?.id).toBe('co-hon');
    expect(findCatalogEntryByName('盂兰盆')?.id).toBe('yulanpen');
    expect(findCatalogEntryByName("All Souls' Day")?.id).toBe('all-souls');
    expect(findCatalogEntryByName('Halloween')?.id).toBe('halloween');
    expect(findCatalogEntryByName('Giỗ Tổ Hùng Vương')?.id).toBe('hung-kings');
    expect(findCatalogEntryByName('Hồ Chí Minh')?.id).toBe('ho-chi-minh');
    expect(findCatalogEntryByName('Ngày sinh Hồ Chí Minh')?.id).toBe(
      'ho-chi-minh-birthday',
    );
    expect(findCatalogEntryByName('关公')?.id).toBe('guan-yu');
  });

  it('2026 lunar 15/7 is 27 Aug (VN UTC+7)', () => {
    expect(lunarYmdToSolarYmd('2026-07-15', 7)).toBe('2026-08-27');
    expect(lunarYmdToSolarYmd('2026-07-02', 7)).toBe('2026-08-14');
    expect(lunarYmdToSolarYmd('2026-07-01', 7)).toBe('2026-08-13');
    expect(lunarYmdToSolarYmd('2026-07-21', 7)).toBe('2026-09-02');
    expect(qingmingSolarYmd(2026)).toBe('2026-04-05');
    expect(memorialDaySolarYmd(2026)).toBe('2026-05-25');
  });
});
