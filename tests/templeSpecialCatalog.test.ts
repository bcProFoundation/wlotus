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
    expect(byId['phat-dan']!.eventCalendar).toBe('lunar');
    expect(byId['phat-dan']!.eventDate).toBe('2026-04-15');
    expect(byId['phat-dan']!.eventStart).toBe('2026-04-08');
    expect(byId['phat-dan']!.eventEnd).toBe('2026-04-15');
    expect(byId['phat-dan']!.countries).toEqual([...VIETNAM_COUNTRIES]);
    expect(byId['fo-dan']!.eventDate).toBe('2026-04-08');
    expect(byId['fo-dan']!.countries).toEqual([...CHINESE_SPEAKING_COUNTRIES]);
    expect(byId['vesak']!.eventDate).toBe('2026-04-15');
    expect(byId['vesak']!.countries).toEqual([...ENGLISH_SPEAKING_COUNTRIES]);
    expect(byId['phat-niet-ban']!.eventDate).toBe('2026-02-15');
    expect(byId['phat-thanh-dao']!.eventDate).toBe('2026-12-08');
    expect(byId['fo-niepan']!.eventDate).toBe('2026-02-15');
    expect(byId['fo-chengdao']!.eventDate).toBe('2026-12-08');
    expect(byId['ong-tao']!.eventDate).toBe('2026-12-23');
    expect(byId['giao-thua']!.lunarMonthEnd).toBe(true);
    expect(byId['tet']!.eventStart).toBe('2026-01-01');
    expect(byId['tet']!.eventEnd).toBe('2026-01-03');
    expect(byId['tien-ong-ba']!.eventDate).toBe('2026-01-03');
    expect(byId['nguyen-tieu']!.eventDate).toBe('2026-01-15');
    expect(byId['nguyen-tieu']!.eventStart).toBe('2026-01-14');
    expect(byId['mung-1']!.eventRecurrence).toBe('monthly-lunar');
    expect(byId['mung-1']!.monthlyEve).toBe(true);
    expect(byId['mung-1']!.skipLunarMonths).toEqual([1]);
    expect(byId['ram']!.eventRecurrence).toBe('monthly-lunar');
    expect(byId['ram']!.monthlyEve).toBe(true);
    expect(byId['ram']!.skipLunarMonths).toEqual([1, 7, 8]);
    expect(byId['doan-ngo']!.eventDate).toBe('2026-05-05');
    expect(byId['trung-thu']!.eventDate).toBe('2026-08-15');
    expect(byId['trung-thu']!.eventStart).toBe('2026-08-14');
    expect(byId['jizao']!.eventEnd).toBe('2026-12-24');
    expect(byId['chuxi']!.lunarMonthEnd).toBe(true);
    expect(byId['chunjie']!.eventEnd).toBe('2026-01-03');
    expect(byId['yuanxiao']!.eventStart).toBe('2026-01-14');
    expect(byId['chu-yi']!.eventRecurrence).toBe('monthly-lunar');
    expect(byId['chu-yi']!.skipLunarMonths).toEqual([1]);
    expect(byId['shi-wu']!.eventRecurrence).toBe('monthly-lunar');
    expect(byId['shi-wu']!.skipLunarMonths).toEqual([1, 7, 8]);
    expect(byId['zhongqiu']!.eventDate).toBe('2026-08-15');
    expect(byId['zhongqiu']!.eventStart).toBe('2026-08-14');
    expect(cat.length).toBeGreaterThanOrEqual(42);
  });

  it('keeps Ông Táo and Tết copy on the middle way', () => {
    const preachy = /Khói giấy thì không|không cần đốt|bỏ đống khói|不必再烧|去掉烟/;
    const tao = templeSpecialCatalog(2026).find(e => e.id === 'ong-tao');
    expect(tao?.story.body).toContain('Tùy tâm');
    expect(tao?.story.body).not.toMatch(preachy);
    const tet = templeSpecialCatalog(2026).find(e => e.id === 'tet');
    expect(tet?.story.body).toContain('tùy tâm');
    expect(tet?.story.body).not.toMatch(preachy);
    const mung = templeSpecialCatalog(2026).find(e => e.id === 'mung-1');
    expect(mung?.story.body).toMatch(/30|29/);
    expect(mung?.story.body).toContain('tùy tâm');
    const ram = templeSpecialCatalog(2026).find(e => e.id === 'ram');
    expect(ram?.story.body).toContain('14');
    expect(ram?.story.body).toContain('tùy tâm');
    expect(ram?.story.body).not.toMatch(preachy);
    const jizao = templeSpecialCatalog(2026).find(e => e.id === 'jizao');
    expect(jizao?.story.bodyZh).toContain('随心');
    expect(jizao?.story.bodyZh).not.toMatch(preachy);
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
    expect(findCatalogEntryByName('Phật Đản')?.id).toBe('phat-dan');
    expect(findCatalogEntryByName('Lễ Phật Đản')?.id).toBe('phat-dan');
    expect(findCatalogEntryByName('佛诞')?.id).toBe('fo-dan');
    expect(findCatalogEntryByName('浴佛节')?.id).toBe('fo-dan');
    expect(findCatalogEntryByName('Vesak')?.id).toBe('vesak');
    expect(findCatalogEntryByName('Wesak')?.id).toBe('vesak');
    expect(findCatalogEntryByName('Phật nhập Niết-bàn')?.id).toBe(
      'phat-niet-ban',
    );
    expect(findCatalogEntryByName('佛涅槃')?.id).toBe('fo-niepan');
    expect(findCatalogEntryByName('Phật thành đạo')?.id).toBe('phat-thanh-dao');
    expect(findCatalogEntryByName('腊八')?.id).toBe('fo-chengdao');
    expect(findCatalogEntryByName('Ông Công Ông Táo')?.id).toBe('ong-tao');
    expect(findCatalogEntryByName('Tết Nguyên Đán')?.id).toBe('tet');
    expect(findCatalogEntryByName('Giao thừa')?.id).toBe('giao-thua');
    expect(findCatalogEntryByName('Tiễn ông bà')?.id).toBe('tien-ong-ba');
    expect(findCatalogEntryByName('Mùng 1')?.id).toBe('mung-1');
    expect(findCatalogEntryByName('Ngày rằm')?.id).toBe('ram');
    expect(findCatalogEntryByName('Tết Nguyên Tiêu')?.id).toBe('nguyen-tieu');
    expect(findCatalogEntryByName('春节')?.id).toBe('chunjie');
    expect(findCatalogEntryByName('祭灶')?.id).toBe('jizao');
    expect(findCatalogEntryByName('除夕')?.id).toBe('chuxi');
    expect(findCatalogEntryByName('元宵节')?.id).toBe('yuanxiao');
    expect(findCatalogEntryByName('中秋节')?.id).toBe('zhongqiu');
  });

  it('2026 lunar 15/7 is 27 Aug (VN UTC+7)', () => {
    expect(lunarYmdToSolarYmd('2026-07-15', 7)).toBe('2026-08-27');
    expect(lunarYmdToSolarYmd('2026-07-02', 7)).toBe('2026-08-14');
    expect(lunarYmdToSolarYmd('2026-07-01', 7)).toBe('2026-08-13');
    expect(lunarYmdToSolarYmd('2026-07-21', 7)).toBe('2026-09-02');
    expect(lunarYmdToSolarYmd('2026-04-08', 7)).toBe('2026-05-24');
    expect(lunarYmdToSolarYmd('2026-04-15', 7)).toBe('2026-05-31');
    expect(lunarYmdToSolarYmd('2026-02-15', 7)).toBe('2026-04-02');
    expect(lunarYmdToSolarYmd('2026-12-08', 7)).toBe('2027-01-15');
    expect(lunarYmdToSolarYmd('2026-01-01', 7)).toBe('2026-02-17');
    expect(lunarYmdToSolarYmd('2026-01-03', 7)).toBe('2026-02-19');
    expect(lunarYmdToSolarYmd('2026-01-15', 7)).toBe('2026-03-03');
    expect(lunarYmdToSolarYmd('2025-12-23', 7)).toBe('2026-02-10');
    expect(qingmingSolarYmd(2026)).toBe('2026-04-05');
    expect(memorialDaySolarYmd(2026)).toBe('2026-05-25');
  });
});
