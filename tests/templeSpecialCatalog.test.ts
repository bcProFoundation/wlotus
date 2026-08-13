import {
  findCatalogEntryByName,
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
  it('has VN, Chinese, and English-speaking events', () => {
    const cat = templeSpecialCatalog(2026);
    const byId = Object.fromEntries(cat.map(e => [e.id, e]));
    expect(byId['vu-lan']!.countries).toEqual([...VIETNAM_COUNTRIES]);
    expect(byId['co-hon']!.kind).toBe('ghost');
    expect(byId['thanh-minh']!.eventDate).toBe('2026-04-05');
    expect(byId['yulanpen']!.countries).toEqual([...CHINESE_SPEAKING_COUNTRIES]);
    expect(byId['zhongyuan']!.eventStart).toBe('2026-07-01');
    expect(byId['qingming']!.eventCalendar).toBe('solar');
    expect(byId['all-souls']!.eventDate).toBe('2026-11-02');
    expect(byId['remembrance']!.eventDate).toBe('2026-11-11');
    expect(byId['all-souls']!.countries).toEqual([...ENGLISH_SPEAKING_COUNTRIES]);
  });

  it('matches live Vu Lan / Cô Hồn names', () => {
    expect(findCatalogEntryByName('Vu Lan')?.id).toBe('vu-lan');
    expect(findCatalogEntryByName('Cô Hồn')?.id).toBe('co-hon');
    expect(findCatalogEntryByName('盂兰盆')?.id).toBe('yulanpen');
    expect(findCatalogEntryByName("All Souls' Day")?.id).toBe('all-souls');
  });

  it('2026 lunar 15/7 is 27 Aug (VN UTC+7)', () => {
    expect(lunarYmdToSolarYmd('2026-07-15', 7)).toBe('2026-08-27');
    expect(lunarYmdToSolarYmd('2026-07-02', 7)).toBe('2026-08-14');
    expect(lunarYmdToSolarYmd('2026-07-01', 7)).toBe('2026-08-13');
    expect(qingmingSolarYmd(2026)).toBe('2026-04-05');
  });
});
