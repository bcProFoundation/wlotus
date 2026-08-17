/**
 * Regional temple-special catalog (2026 launch year).
 *
 * Home Events filters by JSON `countries` (see specialCountries.ts).
 * Each entry is an off-chain catalog row. The first visitor's offering
 * becomes the on-chain root.
 *
 * Research (memorial / ancestral offering days that fit W Lotus):
 *   VN  — Tết, Ông Táo, Giao thừa, tiễn ông bà, mùng 1, rằm, Nguyên Tiêu,
 *         Đoan Ngọ, Trung Thu, Phật Đản, Phật thành đạo, Phật nhập Niết-bàn,
 *         Vu Lan, Cô Hồn, Tết Thanh Minh, Giỗ Tổ Hùng Vương, Thương binh liệt sĩ,
 *         Trần Hưng Đạo, Hồ Chí Minh, Hai Bà Trưng.
 *   ZH  — 春节, 祭灶, 除夕, 元宵, 初一, 十五, 中秋, 佛诞, 佛成道, 佛涅槃,
 *         盂兰盆, 中元节, 清明节, 寒衣节, 重阳节, 冬至, 孔子, 关羽, 妈祖.
 *   EN  — Vesak, All Hallows' Eve, All Saints', All Souls', Remembrance,
 *         Memorial Day (US), ANZAC Day (AU/NZ).
 *
 * Catalog rows are unbound until a visitor's first offering claims the root.
 * Temple does not pre-burn.
 *
 * 2026 solar anchors:
 *   Lunar 23/12/2025 → 10 Feb (Ông Táo before Tết 2026)
 *   Last day Chạp 2025 → 16 Feb (Giao thừa; month has 29 days)
 *   Lunar 1/1 → 17 Feb (Tết Nguyên Đán 2026)
 *   Lunar 3/1 → 19 Feb (tiễn ông bà / hóa vàng)
 *   Lunar 15/1 → 3 Mar (Rằm tháng Giêng / Nguyên Tiêu)
 *   Lunar 15/2 → 2 Apr (Mahayana Parinirvana)
 *   Lunar 8/4  → 24 May (Bắc tông Phật Đản / 佛诞; start of VN Phật Đản week)
 *   Lunar 15/4 → 31 May (Vesakha full moon / GHPGVN chính lễ / UN Vesak 2026)
 *   Lunar 1/7  → 13 Aug (ghost-month open, Chinese calendar)
 *   Lunar 2/7  → 14 Aug (VN Cô Hồn start, Hồ Ngọc Đức UTC+7)
 *   Lunar 15/7 → 27 Aug (Vu Lan / Ullambana / Zhongyuan peak)
 *   Lunar 21/7 → 2 Sep 2026 (Hồ Chí Minh giỗ; died 2 Sep 1969)
 *   Lunar 8/12 → 15 Jan 2027 (Mahayana Bodhi / 成道 of lunar year 2026)
 *   Qingming / Thanh Minh → 5 Apr 2026 (solar term; PRC holiday 4–6 Apr)
 *   US Memorial Day → 25 May 2026 (last Monday)
 *   All Souls' → 2 Nov 2026
 *   Remembrance / Veterans → 11 Nov 2026
 *   冬至 → 22 Dec 2026
 */
import type {
  TempleEventCalendar,
  TempleEventRecurrence,
  TempleSpecialKind,
} from './templeSpecials.js';
import {
  CHINESE_SPEAKING_COUNTRIES,
  ENGLISH_SPEAKING_COUNTRIES,
  VIETNAM_COUNTRIES,
} from './specialCountries.js';

export interface TempleSpecialStory {
  title?: string;
  body: string;
  titleEn?: string;
  bodyEn?: string;
  titleZh?: string;
  bodyZh?: string;
}

export interface TempleSpecialCatalogEntry {
  /** Stable slug for matching live JSON / skip-existing burns. */
  id: string;
  /** Display + registry `name` (also used to match existing Vu Lan / Cô Hồn). */
  name: string;
  /** Extra names that should resolve to this entry. */
  aliases?: string[];
  kind: TempleSpecialKind;
  eventCalendar: TempleEventCalendar;
  eventDate: string;
  eventStart?: string;
  eventEnd?: string;
  eventEndHour?: number;
  /** Default yearly. `monthly-lunar` = every mùng 1 or rằm. */
  eventRecurrence?: TempleEventRecurrence;
  /** Last day of the lunar month in `eventDate` (Giao thừa / 除夕). */
  lunarMonthEnd?: boolean;
  /**
   * Monthly sóc/vọng: include the eve (14 before rằm, 29/30 before mùng 1).
   * Folk custom: many households burn on the afternoon before, not only the
   * named morning.
   */
  monthlyEve?: boolean;
  /**
   * Lunar months where this monthly row is hidden because a named festival
   * already covers that rằm/sóc (1 Nguyên Tiêu/Tết, 7 Vu Lan–Cô Hồn, 8 Trung Thu).
   */
  skipLunarMonths?: number[];
  countries: string[];
  /** On-chain altar birthPlace (quê quán label). */
  birthPlace: string;
  /** Optional solar birth date for heroes. */
  birthDate?: string;
  altarName: string;
  /** Short OP_RETURN note. */
  note: string;
  story: TempleSpecialStory;
}

/** Qingming / Thanh Minh solar-term day (falls 4–6 Apr). */
const QINGMING_SOLAR: Record<number, string> = {
  2026: '2026-04-05',
  2027: '2027-04-05',
  2028: '2028-04-04',
};

export function qingmingSolarYmd(year: number): string {
  return QINGMING_SOLAR[year] ?? `${year}-04-05`;
}

/** US Memorial Day — last Monday in May. */
export function memorialDaySolarYmd(year: number): string {
  const d = new Date(Date.UTC(year, 4, 31));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-05-${dd}`;
}

/** Winter solstice (冬至) — ancestral offerings; Dec 21 or 22. */
const DONGZHI_SOLAR: Record<number, string> = {
  2026: '2026-12-22',
  2027: '2027-12-22',
  2028: '2028-12-21',
};

export function dongzhiSolarYmd(year: number): string {
  return DONGZHI_SOLAR[year] ?? `${year}-12-22`;
}

export function foldSpecialName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

export function templeSpecialCatalog(year = 2026): TempleSpecialCatalogEntry[] {
  const y = String(year);
  const lunarPeak = `${y}-07-15`;
  const lunarGhostVn = `${y}-07-02`;
  const lunarGhostZh = `${y}-07-01`;
  const qingming = qingmingSolarYmd(year);
  const vn = [...VIETNAM_COUNTRIES];
  const zh = [...CHINESE_SPEAKING_COUNTRIES];
  const en = [...ENGLISH_SPEAKING_COUNTRIES];
  const skipRamMonths = [1, 7, 8];
  const skipSocMonths = [1];

  return [
    {
      id: 'vu-lan',
      name: 'Vu Lan',
      aliases: ['vu lan bao hieu', 'ullambana vn'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: lunarPeak,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Vu Lan',
      note: 'Vu Lan Báo Hiếu',
      story: {
        title: 'Vu Lan Báo Hiếu',
        body:
          'Ngày xưa, Tôn giả Mục Kiền Liên — đệ tử thần thông đệ nhất của Đức Phật — dùng thiên nhãn tìm mẹ. Ngài thấy mẹ đang chịu kiếp ngạ quỷ: cổ họng nhỏ như kim, bụng đói không no. Ngài dâng cơm, nhưng thức ăn hóa thành lửa.\n\nĐức Phật dạy: một mình không đủ. Hãy đợi Rằm tháng Bảy, ngày chư Tăng tự tứ, thiết lễ Vu Lan Bồn — nhờ sức chúng tăng mười phương, mẹ mới được siêu thoát.\n\nTừ đó, Rằm tháng Bảy là ngày Báo Hiếu: dâng hoa, tưởng nhớ ông bà cha mẹ, hồi hướng công đức. Mỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông bà cha mẹ được siêu thoát, nguyện cho nhà nhà được bình an.',
        titleEn: 'Vu Lan — Filial Gratitude',
        bodyEn:
          'Long ago, Venerable Maudgalyayana — foremost in supernatural power among the Buddha’s disciples — sought his mother with the divine eye. He found her reborn as a hungry ghost: throat thin as a needle, never sated. Food he offered turned to fire.\n\nThe Buddha taught: one person alone cannot lift such karma. Wait for the full moon of the seventh lunar month, when the Sangha completes the rains retreat. Offer the Ullambana rite; with the merit of the community of monastics, her suffering can be eased.\n\nSo the fifteenth of the seventh month became a day of filial gratitude: flowers, remembrance of parents and ancestors, dedication of merit. Each lotus offered today is also a prayer: that parents and ancestors may be at peace, and that every home may find peace.',
      },
    },
    {
      id: 'co-hon',
      name: 'Cô Hồn',
      aliases: ['co hon', 'thang co hon', 'xa toi vong nhan'],
      kind: 'ghost',
      eventCalendar: 'lunar',
      eventDate: lunarPeak,
      eventStart: lunarGhostVn,
      eventEnd: lunarPeak,
      eventEndHour: 12,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Cô Hồn',
      note: 'Cúng Cô Hồn',
      story: {
        title: 'Xá Tội Vong Nhân',
        body:
          'Tháng Bảy âm lịch, dân gian gọi là tháng cô hồn. Cửa Quỷ Môn mở: những vong hồn không nơi nương tựa — chết oan, lạc lối, không người thờ cúng — được trở về cõi dương một thời.\n\nNgười sống bày mâm chay, cháo, muối… bố thí ngoài trời, không chỉ cho tổ tiên nhà mình mà cho cả những linh hồn lang thang. Đó là lòng từ bi: dù tội nghiệp nặng đến đâu, vẫn có ngày được xá, được no một bữa, được nhớ tới.\n\nCúng cô hồn không phải sợ hãi mà là sẻ chia. Mỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện cho mọi hương linh được siêu thoát, nguyện cho nhà nhà được bình an.',
        titleEn: 'Pardon for Wandering Spirits',
        bodyEn:
          'In the seventh lunar month, folk tradition speaks of the Hungry Ghost season. The ghost gate opens: spirits without a home — the wronged, the lost, those with no one to offer incense — may walk the living world for a time.\n\nPeople set out simple vegetarian offerings outdoors — not only for their own ancestors, but for every wandering soul. It is compassion: even heavy karma is granted a day of pardon, a meal, a moment of being remembered.\n\nOffering to lonely spirits is not fear but sharing. Each lotus offered today is also a prayer: that every spirit may be at peace, and that every home may find peace.',
      },
    },
    {
      id: 'phat-dan',
      name: 'Phật Đản',
      aliases: [
        'le phat dan',
        'le phat an',
        'phat dan',
        'vesak vn',
        'buddha birthday vn',
        'tam phat',
        'Lễ Phật Đản',
      ],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-04-15`,
      eventStart: `${y}-04-08`,
      eventEnd: `${y}-04-15`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Phật Đản',
      note: 'Lễ Phật Đản',
      story: {
        title: 'Lễ Phật Đản',
        body:
          'Theo âm lịch (không phải Phật lịch đếm năm): Bắc tông nhớ ngày đản sinh vào mùng tám tháng Tư; Giáo hội Phật giáo Việt Nam lấy rằm tháng Tư — ngày trăng tròn tháng Vesak — làm chính lễ, tuần lễ từ mùng 8 đến rằm. Tắm Phật, dâng hoa, nhớ một người đã tìm ra con đường hết khổ.\n\nTruyền rằng khi Thái tử đản sinh, hoa sen nở dưới mỗi bước chân. Dâng sen hôm nay không phải thần thoại, mà là nhắc mình: từ bi bắt đầu từ một đời người.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ơn Phật còn được nhớ, nguyện cho nhà nhà được bình an.',
        titleEn: 'Buddha’s Birthday',
        bodyEn:
          'On the East Asian lunar calendar (not Buddhist Era year-counting): Mahayana remembers the birth on the eighth of the fourth month; Vietnam’s sangha, with the 1950 Vesak agreement, keeps the full moon (the 15th) as the main day, with observances from the 8th to the 15th. Bathing the image, offering flowers: remembering someone who looked for a way out of suffering.\n\nLegend says lotuses opened under the infant’s steps. A lotus today is not that myth — it is a reminder that compassion begins in one human life.\n\nEach lotus offered today is also a prayer: that this birth is still remembered, and that every home may find peace.',
      },
    },
    {
      id: 'phat-niet-ban',
      name: 'Phật nhập Niết-bàn',
      aliases: [
        'phat nhap niet ban',
        'le phat tiet',
        'parinirvana vn',
        'nirvana day vn',
      ],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-02-15`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Phật nhập Niết-bàn',
      note: 'Phật nhập Niết-bàn',
      story: {
        title: 'Phật nhập Niết-bàn',
        body:
          'Rằm tháng Hai âm lịch, nhiều chùa làm lễ Phật nhập Niết-bàn — ngày Đức Phật tịch. Không phải ngày hội, mà là giỗ của bậc thầy: nhớ người đã đi hết con đường, rồi nằm nghiêng bên gốc sala.\n\nMột bông sen trên ban thờ hôm ấy là lời tiễn và lời cảm ơn.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ơn thầy còn được giữ, nguyện cho nhà nhà được bình an.',
        titleEn: 'Parinirvana — the Buddha’s Passing',
        bodyEn:
          'On the full moon of the second lunar month, many Mahayana temples keep the Buddha’s Parinirvana — the day he died. Not a festival: a teacher’s memorial, remembering a life that walked the path to the end.\n\nA lotus on the shrine that day is both farewell and thanks.\n\nEach lotus offered today is also a prayer: that this teacher is still kept, and that every home may find peace.',
      },
    },
    {
      id: 'phat-thanh-dao',
      name: 'Phật thành đạo',
      aliases: [
        'le phat thanh dao',
        'thanh dao',
        'bodhi day vn',
        'bo de',
      ],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-08`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Phật thành đạo',
      note: 'Lễ Phật thành đạo',
      story: {
        title: 'Lễ Phật thành đạo',
        body:
          'Mùng tám tháng Chạp âm lịch là lễ Phật thành đạo — đêm Thái tử ngồi dưới cội Bồ-đề, thấy rõ khổ và lối ra.\n\nNgười tới chùa dâng hoa, thắp đèn, nhớ phút tỉnh thức ấy không thuộc riêng một dân tộc.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện còn chỗ để tỉnh, nguyện cho nhà nhà được bình an.',
        titleEn: 'Bodhi Day — the Buddha’s Awakening',
        bodyEn:
          'On the eighth of the twelfth lunar month, temples keep the Buddha’s awakening — the night under the Bodhi tree when he saw suffering clearly, and a way out.\n\nPeople offer flowers and light, remembering an hour that does not belong to one nation.\n\nEach lotus offered today is also a prayer: that there is still a place to wake, and that every home may find peace.',
      },
    },
    {
      id: 'thanh-minh',
      name: 'Tết Thanh Minh',
      aliases: ['thanh minh', 'tao mo'],
      kind: 'event',
      eventCalendar: 'solar',
      eventDate: qingming,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Thanh Minh',
      note: 'Tảo mộ Thanh Minh',
      story: {
        title: 'Tết Thanh Minh',
        body:
          'Tiết Thanh Minh — trời trong, cây cỏ đâm chồi. Người Việt sửa sang phần mộ ông bà: nhổ cỏ, đắp đất, thắp hương, dâng hoa. Không phải ngày sợ hãi, mà là ngày về nhà với người đã khuất.\n\nTảo mộ rồi, cả nhà ngồi lại, kể chuyện người xưa, nhắc con cháu đừng quên nguồn cội. Một nắm đất, một nén hương, một bông hoa — đủ để nói: chúng con vẫn nhớ.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông bà được nhớ, nguyện cho nhà nhà được bình an.',
        titleEn: 'Thanh Minh — Visiting the Graves',
        bodyEn:
          'Thanh Minh is the clear-and-bright solar term, when families in Vietnam tend ancestral graves: pull weeds, add earth, light incense, offer flowers. It is not a day of fear, but a homecoming with those who came before.\n\nAfter the tombs are swept, people sit together and tell the old stories so children will not forget their roots. A handful of soil, a stick of incense, a flower — enough to say: we still remember.\n\nEach lotus offered today is also a prayer: that those who came before are remembered, and that every home may find peace.',
      },
    },
    {
      id: 'ong-tao',
      name: 'Ông Công Ông Táo',
      aliases: [
        'ong tao',
        'ong cong ong tao',
        'tao quan',
        'tien ong tao',
        '23 thang chap',
      ],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-23`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Ông Táo',
      note: 'Ông Công Ông Táo',
      story: {
        title: 'Tiễn Ông Công Ông Táo',
        body:
          'Ngày 23 tháng Chạp, nhiều nhà làm lễ tiễn Ông Công Ông Táo về trời: cá chép, mũ áo, vàng mã — mỗi nhà một cách.\n\nSen nếu muốn, cũng là lời tiễn. Tùy tâm mà đổi.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông Táo lên đường thanh thản, nguyện cho nhà nhà được bình an.',
        titleEn: 'Kitchen Gods — sending off',
        bodyEn:
          'On the twenty-third of the twelfth lunar month, Vietnamese households send the Kitchen Gods to heaven: paper carp, clothes, joss paper — each home in its own way.\n\nA lotus, if you wish, is also a sending-off. Change only as the heart allows.\n\nEach lotus offered today is also a prayer: that they go in peace, and that every home may find peace.',
      },
    },
    {
      id: 'giao-thua',
      name: 'Giao thừa',
      aliases: ['giao thua', 'tat nien', 'dem 30 tet', 'cung giao thua'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-30`,
      lunarMonthEnd: true,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Giao thừa',
      note: 'Giao thừa',
      story: {
        title: 'Giao thừa',
        body:
          'Đêm cuối năm — 29 hoặc 30 tháng Chạp — nhiều nhà thắp hương đón năm mới: cúng trời đất, cúng ông bà, rước ông Táo về. Giao thừa là phút cửa nhà mở cho người sống và người đã khuất.\n\nSen cũng là lời tiễn năm cũ, đón năm mới — nếu muốn. Tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện năm cũ được tiễn, nguyện cho nhà nhà được bình an.',
        titleEn: 'New Year’s Eve — Giao thừa',
        bodyEn:
          'The last night of the lunar year — the 29th or 30th of the twelfth month — many households offer incense to heaven and earth, to ancestors, and welcome the Kitchen Gods home. The year turns with the door open to the living and the dead.\n\nA lotus is also a farewell to the old year and a welcome to the new — if you wish. As the heart allows.\n\nEach lotus offered today is also a prayer: that the year is seen out in peace, and that every home may find peace.',
      },
    },
    {
      id: 'tet',
      name: 'Tết Nguyên Đán',
      aliases: ['tet', 'tet nguyen dan', 'mung 1 tet', 'nam moi'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-01`,
      eventStart: `${y}-01-01`,
      eventEnd: `${y}-01-03`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Tết',
      note: 'Tết Nguyên Đán',
      story: {
        title: 'Tết Nguyên Đán',
        body:
          'Mùng 1 đến mùng 3, bàn thờ nhà Việt thường không tắt hương. Ông bà được đón về ăn Tết với con cháu.\n\nNhớ người là đủ. Dâng sen hay dâng hoa nhà — tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông bà về ăn Tết, nguyện cho nhà nhà được bình an.',
        titleEn: 'Tết — Lunar New Year',
        bodyEn:
          'From the first to the third of the first lunar month, Vietnamese ancestral altars often stay lit. Ancestors are welcomed home for Tết.\n\nRemembering is enough. Offer a lotus or flowers from the house — as the heart allows.\n\nEach lotus offered today is also a prayer: that those who came before share this New Year, and that every home may find peace.',
      },
    },
    {
      id: 'tien-ong-ba',
      name: 'Tiễn ông bà',
      aliases: ['tien ong ba', 'hoa vang', 'ha neu', 'mung 3 tet'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-03`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Tiễn ông bà',
      note: 'Tiễn ông bà',
      story: {
        title: 'Tiễn ông bà',
        body:
          'Mùng 3 Tết (nhiều nhà mùng 4 hoặc mùng 7), nhiều nhà làm lễ tiễn ông bà về, rồi dọn bàn, hạ nêu, Tết khép lại.\n\nLễ đưa tùy nhà: hương hoa, vàng mã, hay một đóa sen.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông bà về thanh thản, nguyện cho nhà nhà được bình an.',
        titleEn: 'Seeing ancestors off',
        bodyEn:
          'On the third of Tết (some homes the fourth or seventh), many families see ancestors off, then clear the altar, take down the nêu pole, and close Tết.\n\nThe farewell is each household’s own: incense and flowers, joss paper, or a lotus.\n\nEach lotus offered today is also a prayer: that those who visited go home in peace, and that every home may find peace.',
      },
    },
    {
      id: 'nguyen-tieu',
      name: 'Tết Nguyên Tiêu',
      aliases: ['nguyen tieu', 'ram thang gieng', 'tet nguyen tieu', 'hoa dang'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-15`,
      eventStart: `${y}-01-14`,
      eventEnd: `${y}-01-15`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Nguyên Tiêu',
      note: 'Rằm tháng Giêng',
      story: {
        title: 'Rằm tháng Giêng',
        body:
          'Rằm tháng Giêng — Tết Nguyên Tiêu. Nhiều nhà lễ từ chiều 14; sáng rằm tới chùa, thắp hương, hoa đăng, cầu an cho cả năm.\n\nSen tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện năm mới được mở bằng một bông sen, nguyện cho nhà nhà được bình an.',
        titleEn: 'First Full Moon — Nguyên Tiêu',
        bodyEn:
          'The fifteenth of the first lunar month is Nguyên Tiêu, the year’s first full moon. Many households begin on the afternoon of the fourteenth; on the fifteenth people go to the temple, light incense, hang lanterns, and ask peace for the year.\n\nA lotus, if you wish.\n\nEach lotus offered today is also a prayer: that the year opens with a lotus, and that every home may find peace.',
      },
    },
    {
      id: 'mung-1',
      name: 'Mùng 1',
      aliases: ['mung mot', 'soc', 'ngay mung 1', 'so 1 am lich'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-01`,
      eventRecurrence: 'monthly-lunar',
      monthlyEve: true,
      skipLunarMonths: skipSocMonths,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Mùng 1',
      note: 'Mùng 1 âm lịch',
      story: {
        title: 'Mùng 1 âm lịch',
        body:
          'Nhiều nhà lễ sóc từ chiều 30 (hoặc 29 nếu tháng thiếu); sáng mùng 1 thắp hương ông bà. Tháng Giêng đã có Tết nên không nhắc lại mùng 1 riêng.\n\nAi muốn đổi sang sen, tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện ông bà được nhớ mỗi tháng, nguyện cho nhà nhà được bình an.',
        titleEn: 'First of the lunar month',
        bodyEn:
          'Many households begin the new-moon offering on the afternoon of the 30th (or the 29th in a short month); on the first, incense for ancestors. The first lunar month already has Tết, so this row is not shown then.\n\nIf you wish to offer a lotus instead, as the heart allows.\n\nEach lotus offered today is also a prayer: that ancestors are remembered each month, and that every home may find peace.',
      },
    },
    {
      id: 'ram',
      name: 'Ngày rằm',
      aliases: ['ram', 'ngay ram', 'vong', 'ram am lich', '15 am lich'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-15`,
      eventRecurrence: 'monthly-lunar',
      monthlyEve: true,
      skipLunarMonths: skipRamMonths,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Ngày rằm',
      note: 'Ngày rằm',
      story: {
        title: 'Ngày rằm',
        body:
          'Bắc thường hóa từ chiều 14; Nam nhiều nhà chờ sáng rằm. Cả hai ngày đều được. Tháng Giêng, tháng 7 và tháng 8 đã có lễ riêng nên không nhắc rằm thường.\n\nSen nếu muốn — tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện mỗi rằm còn một bông sen, nguyện cho nhà nhà được bình an.',
        titleEn: 'Full-moon day',
        bodyEn:
          'In the north many households offer from the afternoon of the fourteenth; in the south many wait until the morning of the fifteenth. Both days count. The first, seventh, and eighth lunar months already have named festivals, so the ordinary rằm is not listed then.\n\nA lotus, if you wish — as the heart allows.\n\nEach lotus offered today is also a prayer: that each full moon still has a lotus, and that every home may find peace.',
      },
    },
    {
      id: 'doan-ngo',
      name: 'Tết Đoan Ngọ',
      aliases: ['doan ngo', 'tet doan ngo', 'mung 5 thang 5', 'doan duong'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-05-05`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Đoan Ngọ',
      note: 'Tết Đoan Ngọ',
      story: {
        title: 'Tết Đoan Ngọ',
        body:
          'Mùng 5 tháng 5 âm lịch, Tết Đoan Ngọ. Nhiều nhà rượu nếp, quả, lá — cúng ông bà giữa năm, diệt sâu, cầu an.\n\nSen nếu muốn. Tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện giữa năm được an, nguyện cho nhà nhà được bình an.',
        titleEn: 'Dragon Boat / Đoan Ngọ',
        bodyEn:
          'On the fifth of the fifth lunar month, Tết Đoan Ngọ. Sticky-rice wine, fruit, herbs — offered to ancestors at mid-year, for health and a quiet house.\n\nA lotus, if you wish. As the heart allows.\n\nEach lotus offered today is also a prayer: for a peaceful mid-year, and that every home may find peace.',
      },
    },
    {
      id: 'trung-thu',
      name: 'Tết Trung Thu',
      aliases: ['trung thu', 'tet trung thu', 'ram thang 8', 'children moon'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-08-15`,
      eventStart: `${y}-08-14`,
      eventEnd: `${y}-08-15`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Trung Thu',
      note: 'Tết Trung Thu',
      story: {
        title: 'Tết Trung Thu',
        body:
          'Rằm tháng Tám, Tết Trung Thu. Đèn, bánh, trẻ con — nhiều nhà lễ từ chiều 14, thắp hương ông bà dưới trăng.\n\nSen tùy tâm.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện trăng rằm còn chỗ cho ông bà, nguyện cho nhà nhà được bình an.',
        titleEn: 'Mid-Autumn Festival',
        bodyEn:
          'The fifteenth of the eighth lunar month is Tết Trung Thu. Lanterns, cakes, children — and many households begin on the afternoon of the fourteenth, offering incense to ancestors under the moon.\n\nA lotus, if you wish.\n\nEach lotus offered today is also a prayer: that the full moon still has a place for those who came before, and that every home may find peace.',
      },
    },
    {
      id: 'yulanpen',
      name: '盂兰盆',
      aliases: ['yulanpen', 'yulan', 'ullambana', '盂兰盆节', '盂蘭盆'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: lunarPeak,
      countries: zh,
      birthPlace: '中国',
      altarName: '盂兰盆',
      note: '盂兰盆节',
      story: {
        title: '盂兰盆 — 报恩',
        titleZh: '盂兰盆 — 报恩',
        body:
          '昔日目连尊者以天眼寻母，见其堕饿鬼道：咽细如针，腹饥难饱。目连奉食，食至口边即化为火。\n\n佛言：一人之力不足。待七月十五僧自恣日，设盂兰盆供，仗十方众僧威德，母得解脱。\n\n自此七月十五成为报恩之日：供花、忆念父母祖先、回向功德。今日每一朵莲花，也是一句愿：愿父母祖先得安，愿家家得安宁。',
        bodyZh:
          '昔日目连尊者以天眼寻母，见其堕饿鬼道：咽细如针，腹饥难饱。目连奉食，食至口边即化为火。\n\n佛言：一人之力不足。待七月十五僧自恣日，设盂兰盆供，仗十方众僧威德，母得解脱。\n\n自此七月十五成为报恩之日：供花、忆念父母祖先、回向功德。今日每一朵莲花，也是一句愿：愿父母祖先得安，愿家家得安宁。',
        titleEn: 'Ullambana — Filial Gratitude',
        bodyEn:
          'Maudgalyayana searched for his mother with the divine eye and found her among the hungry ghosts. Food he offered turned to fire.\n\nThe Buddha taught him to wait for the fifteenth of the seventh lunar month, when the Sangha completes the rains retreat, and to offer the Ullambana rite so the merit of the community could ease her suffering.\n\nThat full moon became a day of filial gratitude. Each lotus offered today is also a prayer: that parents and ancestors may be at peace, and that every home may find peace.',
      },
    },
    {
      id: 'zhongyuan',
      name: '中元节',
      aliases: ['zhongyuan', 'ghost festival', 'hungry ghost', '鬼节', '七月半'],
      kind: 'ghost',
      eventCalendar: 'lunar',
      eventDate: lunarPeak,
      eventStart: lunarGhostZh,
      eventEnd: lunarPeak,
      eventEndHour: 12,
      countries: zh,
      birthPlace: '中国',
      altarName: '中元节',
      note: '中元节',
      story: {
        title: '中元 — 普度',
        titleZh: '中元 — 普度',
        body:
          '农历七月，民间称为鬼月。鬼门开，无祀孤魂——枉死、迷路、无人奉祀者——得返阳间一时。中元节在七月十五，是这月的高峰。\n\n活人在户外设素食、香烛，不只祭自家祖先，也布施一切流浪的灵魂。这是慈悲：再重的业，也有一日得赦、得一餐、被人想起。\n\n供孤不是恐惧，而是分享。今日每一朵莲花，也是一句愿：愿一切有情得安，愿家家得安宁。',
        bodyZh:
          '农历七月，民间称为鬼月。鬼门开，无祀孤魂——枉死、迷路、无人奉祀者——得返阳间一时。中元节在七月十五，是这月的高峰。\n\n活人在户外设素食、香烛，不只祭自家祖先，也布施一切流浪的灵魂。这是慈悲：再重的业，也有一日得赦、得一餐、被人想起。\n\n供孤不是恐惧，而是分享。今日每一朵莲花，也是一句愿：愿一切有情得安，愿家家得安宁。',
        titleEn: 'Zhongyuan — Feeding Lonely Spirits',
        bodyEn:
          'The seventh lunar month is Ghost Month. The gate opens: unattended spirits — the wronged, the lost, those with no one to offer incense — may walk among the living for a time. Zhongyuan on the fifteenth is the peak of that month.\n\nPeople set out simple vegetarian offerings outdoors, not only for their own ancestors but for every wandering soul. It is compassion: even heavy karma is granted a day of pardon, a meal, a moment of being remembered.\n\nOffering to lonely spirits is not fear but sharing. Each lotus offered today is also a prayer: that every being may be at peace, and that every home may find peace.',
      },
    },
    {
      id: 'qingming',
      name: '清明节',
      aliases: ['qingming', 'ching ming', 'tomb sweeping', '清明'],
      kind: 'event',
      eventCalendar: 'solar',
      eventDate: qingming,
      countries: zh,
      birthPlace: '中国',
      altarName: '清明节',
      note: '清明节',
      story: {
        title: '清明 — 扫墓',
        titleZh: '清明 — 扫墓',
        body:
          '清明时节，春草发、天色清。家人上坟：除草、培土、献花、上香。不是哀伤的节日，而是与先人的一次团聚。\n\n扫墓之后，把旧事讲给孩子听，让根还在。一抔土、一炷香、一枝花，已足够说：我们还记得。\n\n今日每一朵莲花，也是一句愿：愿先人被记得，愿家家得安宁。',
        bodyZh:
          '清明时节，春草发、天色清。家人上坟：除草、培土、献花、上香。不是哀伤的节日，而是与先人的一次团聚。\n\n扫墓之后，把旧事讲给孩子听，让根还在。一抔土、一炷香、一枝花，已足够说：我们还记得。\n\n今日每一朵莲花，也是一句愿：愿先人被记得，愿家家得安宁。',
        titleEn: 'Qingming — Tomb Sweeping',
        bodyEn:
          'At Qingming the air clears and spring returns. Families visit ancestral graves: pull weeds, add earth, offer flowers and incense. It is not only mourning — it is a reunion with those who came before.\n\nAfter the tombs are swept, the old stories are told so children will not forget their roots. A handful of soil, incense, a flower — enough to say: we still remember.\n\nEach lotus offered today is also a prayer: that those who came before are remembered, and that every home may find peace.',
      },
    },
    {
      id: 'jizao',
      name: '祭灶',
      aliases: ['ji zao', 'xiao nian', '小年', '灶神', '送灶'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-23`,
      eventStart: `${y}-12-23`,
      eventEnd: `${y}-12-24`,
      countries: zh,
      birthPlace: '中国',
      altarName: '祭灶',
      note: '祭灶',
      story: {
        title: '祭灶 — 小年',
        titleZh: '祭灶 — 小年',
        body:
          '腊月二十三或二十四，送灶神上天。纸马、糖瓜、烧纸——各家各礼。\n\n想献莲，随心。\n\n今日每一朵莲花，也是一句愿：愿灶神路上平安，愿家家得安宁。',
        bodyZh:
          '腊月二十三或二十四，送灶神上天。纸马、糖瓜、烧纸——各家各礼。\n\n想献莲，随心。\n\n今日每一朵莲花，也是一句愿：愿灶神路上平安，愿家家得安宁。',
        titleEn: 'Kitchen God — Little New Year',
        bodyEn:
          'On the twenty-third or twenty-fourth of the twelfth lunar month, households send the Kitchen God to heaven. Paper horses, candy, joss paper — each home in its own way.\n\nA lotus, if you wish. As the heart allows.\n\nEach lotus offered today is also a prayer: for a peaceful road, and that every home may find peace.',
      },
    },
    {
      id: 'chuxi',
      name: '除夕',
      aliases: ['chu xi', 'new year eve zh', '年夜', '大年三十'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-30`,
      lunarMonthEnd: true,
      countries: zh,
      birthPlace: '中国',
      altarName: '除夕',
      note: '除夕',
      story: {
        title: '除夕',
        titleZh: '除夕',
        body:
          '一年最后一夜。接灶、祭祖、守岁。香烛、一桌给还在的人和已经走的人。\n\n莲花也是辞旧迎新，若愿意。随心。\n\n今日每一朵莲花，也是一句愿：愿旧年被好好送走，愿家家得安宁。',
        bodyZh:
          '一年最后一夜。接灶、祭祖、守岁。香烛、一桌给还在的人和已经走的人。\n\n莲花也是辞旧迎新，若愿意。随心。\n\n今日每一朵莲花，也是一句愿：愿旧年被好好送走，愿家家得安宁。',
        titleEn: 'New Year’s Eve — Chúxī',
        bodyEn:
          'The last night of the year. Welcome the Kitchen God home, honour ancestors, stay up. Incense, a table for the living and the dead.\n\nA lotus is also a farewell to the old year — if you wish. As the heart allows.\n\nEach lotus offered today is also a prayer: that the year is seen out in peace, and that every home may find peace.',
      },
    },
    {
      id: 'chunjie',
      name: '春节',
      aliases: ['chun jie', 'spring festival', 'chinese new year', '大年初一'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-01`,
      eventStart: `${y}-01-01`,
      eventEnd: `${y}-01-03`,
      countries: zh,
      birthPlace: '中国',
      altarName: '春节',
      note: '春节',
      story: {
        title: '春节',
        titleZh: '春节',
        body:
          '正月初一到初三，香火不断。先人被请回家过年。\n\n记得就好。献莲或家花，随心。\n\n今日每一朵莲花，也是一句愿：愿先人回家过年，愿家家得安宁。',
        bodyZh:
          '正月初一到初三，香火不断。先人被请回家过年。\n\n记得就好。献莲或家花，随心。\n\n今日每一朵莲花，也是一句愿：愿先人回家过年，愿家家得安宁。',
        titleEn: 'Spring Festival',
        bodyEn:
          'From the first to the third of the first lunar month, incense stays lit. Ancestors are asked home for the New Year.\n\nRemembering is enough. Offer a lotus or flowers from the house — as the heart allows.\n\nEach lotus offered today is also a prayer: that those who came before share this New Year, and that every home may find peace.',
      },
    },
    {
      id: 'yuanxiao',
      name: '元宵节',
      aliases: ['yuan xiao', 'lantern festival', '正月十五', '上元'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-15`,
      eventStart: `${y}-01-14`,
      eventEnd: `${y}-01-15`,
      countries: zh,
      birthPlace: '中国',
      altarName: '元宵节',
      note: '元宵节',
      story: {
        title: '元宵 — 上元',
        titleZh: '元宵 — 上元',
        body:
          '正月十四到十五，一年第一个满月。灯、汤圆、上香。不少人家从十四下午起祭。\n\n随心献莲。\n\n今日每一朵莲花，也是一句愿：愿新年以莲花开场，愿家家得安宁。',
        bodyZh:
          '正月十四到十五，一年第一个满月。灯、汤圆、上香。不少人家从十四下午起祭。\n\n随心献莲。\n\n今日每一朵莲花，也是一句愿：愿新年以莲花开场，愿家家得安宁。',
        titleEn: 'Lantern Festival',
        bodyEn:
          'The fourteenth to fifteenth of the first lunar month is the year’s first full moon. Lanterns, tangyuan, incense. Many households begin on the afternoon of the fourteenth.\n\nA lotus, if you wish.\n\nEach lotus offered today is also a prayer: that the year opens with a lotus, and that every home may find peace.',
      },
    },
    {
      id: 'chu-yi',
      name: '初一',
      aliases: ['chu yi', '朔', '每月初一', '农历初一'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-01`,
      eventRecurrence: 'monthly-lunar',
      monthlyEve: true,
      skipLunarMonths: skipSocMonths,
      countries: zh,
      birthPlace: '中国',
      altarName: '初一',
      note: '每月初一',
      story: {
        title: '每月初一',
        titleZh: '每月初一',
        body:
          '多从月末傍晚起祭，初一早晨上香。正月已有春节，不再单列初一。\n\n想换莲花，随心。\n\n今日每一朵莲花，也是一句愿：愿先人每月被记得，愿家家得安宁。',
        bodyZh:
          '多从月末傍晚起祭，初一早晨上香。正月已有春节，不再单列初一。\n\n想换莲花，随心。\n\n今日每一朵莲花，也是一句愿：愿先人每月被记得，愿家家得安宁。',
        titleEn: 'First of the lunar month',
        bodyEn:
          'Many households begin on the last afternoon of the month; on the first, incense in the morning. The first lunar month already has Spring Festival, so this row is not listed then.\n\nIf you wish to offer a lotus, as the heart allows.\n\nEach lotus offered today is also a prayer: that ancestors are remembered each month, and that every home may find peace.',
      },
    },
    {
      id: 'shi-wu',
      name: '十五',
      aliases: ['shi wu', '望', '每月十五', '农历十五'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-01-15`,
      eventRecurrence: 'monthly-lunar',
      monthlyEve: true,
      skipLunarMonths: skipRamMonths,
      countries: zh,
      birthPlace: '中国',
      altarName: '十五',
      note: '每月十五',
      story: {
        title: '每月十五',
        titleZh: '每月十五',
        body:
          '北方多十四下午，南方多十五早上。两天都行。正月、七月、八月已有专节，不再单列十五。\n\n想献莲，随心。\n\n今日每一朵莲花，也是一句愿：愿每月十五仍有一朵莲，愿家家得安宁。',
        bodyZh:
          '北方多十四下午，南方多十五早上。两天都行。正月、七月、八月已有专节，不再单列十五。\n\n想献莲，随心。\n\n今日每一朵莲花，也是一句愿：愿每月十五仍有一朵莲，愿家家得安宁。',
        titleEn: 'Fifteenth of the lunar month',
        bodyEn:
          'In the north many offer from the afternoon of the fourteenth; in the south many wait until the morning of the fifteenth. Both days count. The first, seventh, and eighth lunar months already have named festivals, so the ordinary fifteenth is not listed then.\n\nA lotus, if you wish.\n\nEach lotus offered today is also a prayer: that each fifteenth still has a lotus, and that every home may find peace.',
      },
    },
    {
      id: 'zhongqiu',
      name: '中秋节',
      aliases: ['zhong qiu', 'mid autumn', '八月十五', '中秋'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-08-15`,
      eventStart: `${y}-08-14`,
      eventEnd: `${y}-08-15`,
      countries: zh,
      birthPlace: '中国',
      altarName: '中秋节',
      note: '中秋节',
      story: {
        title: '中秋',
        titleZh: '中秋',
        body:
          '八月十四到十五，月圆。灯、月饼、团圆——不少人家从十四起给祖先上香。\n\n随心献莲。\n\n今日每一朵莲花，也是一句愿：愿圆月仍给先人留位，愿家家得安宁。',
        bodyZh:
          '八月十四到十五，月圆。灯、月饼、团圆——不少人家从十四起给祖先上香。\n\n随心献莲。\n\n今日每一朵莲花，也是一句愿：愿圆月仍给先人留位，愿家家得安宁。',
        titleEn: 'Mid-Autumn Festival',
        bodyEn:
          'The fourteenth to fifteenth of the eighth lunar month is the Mid-Autumn full moon. Lanterns, mooncakes, reunion — and many households begin offering incense to ancestors from the fourteenth.\n\nA lotus, if you wish.\n\nEach lotus offered today is also a prayer: that the full moon still has a place for those who came before, and that every home may find peace.',
      },
    },
    {
      id: 'fo-dan',
      name: '佛诞',
      aliases: ['fo dan', '浴佛节', '浴佛', '佛誕', 'buddha birthday zh'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-04-08`,
      countries: zh,
      birthPlace: '中国',
      altarName: '佛诞',
      note: '浴佛节',
      story: {
        title: '佛诞 — 浴佛',
        titleZh: '佛诞 — 浴佛',
        body:
          '农历四月初八，浴佛节。纪念释迦牟尼诞生：以香水浴佛、献花，记得有一个人走出王宫，去找离苦的路。\n\n传说太子诞生时，步步生莲。今日献莲不是神话，而是提醒：慈悲始于一个生命。\n\n今日每一朵莲花，也是一句愿：愿佛恩被记得，愿家家得安宁。',
        bodyZh:
          '农历四月初八，浴佛节。纪念释迦牟尼诞生：以香水浴佛、献花，记得有一个人走出王宫，去找离苦的路。\n\n传说太子诞生时，步步生莲。今日献莲不是神话，而是提醒：慈悲始于一个生命。\n\n今日每一朵莲花，也是一句愿：愿佛恩被记得，愿家家得安宁。',
        titleEn: 'Buddha’s Birthday — Bathing the Buddha',
        bodyEn:
          'On the eighth of the fourth lunar month, Chinese-speaking temples keep the Buddha’s birthday: bathing the image, offering flowers, remembering someone who left the palace to look for a way out of suffering.\n\nLegend says lotuses opened under each infant step. A lotus today is not that myth — it is a reminder that compassion begins in one life.\n\nEach lotus offered today is also a prayer: that this birth is still remembered, and that every home may find peace.',
      },
    },
    {
      id: 'fo-niepan',
      name: '佛涅槃',
      aliases: ['niepan', '涅槃节', '佛入涅槃', 'parinirvana zh'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-02-15`,
      countries: zh,
      birthPlace: '中国',
      altarName: '佛涅槃',
      note: '佛涅槃',
      story: {
        title: '佛涅槃',
        titleZh: '佛涅槃',
        body:
          '农历二月十五，纪念佛陀入涅槃。不是欢庆，而是老师的忌日：记得那个人走完了路，在娑罗树下侧卧而逝。\n\n一朵莲花，是送别，也是感恩。\n\n今日每一朵莲花，也是一句愿：愿师恩被记得，愿家家得安宁。',
        bodyZh:
          '农历二月十五，纪念佛陀入涅槃。不是欢庆，而是老师的忌日：记得那个人走完了路，在娑罗树下侧卧而逝。\n\n一朵莲花，是送别，也是感恩。\n\n今日每一朵莲花，也是一句愿：愿师恩被记得，愿家家得安宁。',
        titleEn: 'Parinirvana',
        bodyEn:
          'On the fifteenth of the second lunar month, Mahayana temples remember the Buddha’s passing. Not a festival: a teacher’s death day — a life that walked the path to the end.\n\nA lotus is farewell and thanks.\n\nEach lotus offered today is also a prayer: that this teacher is still kept, and that every home may find peace.',
      },
    },
    {
      id: 'fo-chengdao',
      name: '佛成道',
      aliases: ['chengdao', '成道', '腊八', '臘八', 'bodhi day zh'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-12-08`,
      countries: zh,
      birthPlace: '中国',
      altarName: '佛成道',
      note: '佛成道',
      story: {
        title: '佛成道',
        titleZh: '佛成道',
        body:
          '农历十二月初八，成道日——也是腊八。纪念佛陀在菩提树下觉悟：看清苦，也看见出路。\n\n献花、燃灯，记得那一夜不属于一个国家。\n\n今日每一朵莲花，也是一句愿：愿仍有醒处，愿家家得安宁。',
        bodyZh:
          '农历十二月初八，成道日——也是腊八。纪念佛陀在菩提树下觉悟：看清苦，也看见出路。\n\n献花、燃灯，记得那一夜不属于一个国家。\n\n今日每一朵莲花，也是一句愿：愿仍有醒处，愿家家得安宁。',
        titleEn: 'Bodhi Day',
        bodyEn:
          'On the eighth of the twelfth lunar month — Laba in folk calendars — temples keep the Buddha’s awakening under the Bodhi tree: suffering seen clearly, and a way out.\n\nFlowers and lamps remember an hour that does not belong to one nation.\n\nEach lotus offered today is also a prayer: that there is still a place to wake, and that every home may find peace.',
      },
    },
    {
      id: 'vesak',
      name: 'Vesak',
      aliases: [
        'vesakha',
        'wesak',
        'buddha day',
        'buddha birthday',
        'visakha puja',
      ],
      kind: 'event',
      eventCalendar: 'lunar',
      // East Asian âm lịch 15/4 ≈ Vesakha full moon (SG/MY/TH/UN 2024–2028).
      // Phật lịch is year numbering only. Myanmar/India may differ by a day.
      eventDate: `${y}-04-15`,
      countries: en,
      birthPlace: '',
      altarName: 'Vesak',
      note: 'Vesak',
      story: {
        title: 'Vesak',
        titleEn: 'Vesak',
        body:
          'On the full moon of the fourth lunar month (Vesakha), many Buddhist communities remember the Buddha’s birth, enlightenment, and passing — three moments, one day of flowers.\n\nA lotus on the shrine is the old offering: not a slogan. Presence, and a life that pointed a way out of suffering.\n\nEach lotus offered today is also a prayer: that this remembrance is kept, and that every home may find peace.',
        bodyEn:
          'On the full moon of the fourth lunar month (Vesakha), many Buddhist communities remember the Buddha’s birth, enlightenment, and passing — three moments, one day of flowers.\n\nA lotus on the shrine is the old offering: not a slogan. Presence, and a life that pointed a way out of suffering.\n\nEach lotus offered today is also a prayer: that this remembrance is kept, and that every home may find peace.',
      },
    },
    {
      id: 'all-souls',
      name: "All Souls' Day",
      aliases: ['all souls', 'all souls day', 'commemoration of all the faithful departed'],
      kind: 'event',
      eventCalendar: 'solar',
      eventDate: `${y}-11-02`,
      countries: en,
      birthPlace: '',
      altarName: "All Souls' Day",
      note: "All Souls' Day",
      story: {
        title: "All Souls' Day",
        titleEn: "All Souls' Day",
        body:
          'On the second of November, churches and families remember all the dead — not only the famous, but every soul still held in love. People visit graves, light candles, and lay flowers.\n\nThe day follows All Saints. Together they say: the living and the dead remain one household. A prayer, a name spoken aloud, a flower on the stone.\n\nEach lotus offered today is also a prayer: for every soul still held in love, and that every home may find peace.',
        bodyEn:
          'On the second of November, churches and families remember all the dead — not only the famous, but every soul still held in love. People visit graves, light candles, and lay flowers.\n\nThe day follows All Saints. Together they say: the living and the dead remain one household. A prayer, a name spoken aloud, a flower on the stone.\n\nEach lotus offered today is also a prayer: for every soul still held in love, and that every home may find peace.',
      },
    },
    {
      id: 'remembrance',
      name: 'Remembrance Day',
      aliases: ['veterans day', 'armistice day', 'poppy day', 'remembrance sunday'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-11-11`,
      countries: en,
      birthPlace: '',
      altarName: 'Remembrance Day',
      note: 'Remembrance Day',
      story: {
        title: 'Remembrance Day',
        titleEn: 'Remembrance Day',
        body:
          'At the eleventh hour of the eleventh day of the eleventh month, many English-speaking countries fall silent for those who died in war. In the United States the same date is Veterans Day; across the Commonwealth it is Remembrance Day.\n\nA poppy, a name on a wall, a minute of quiet. The point is not victory — it is not forgetting people who did not come home.\n\nEach lotus offered today is also a prayer: that they are not forgotten, and that every home may find peace.',
        bodyEn:
          'At the eleventh hour of the eleventh day of the eleventh month, many English-speaking countries fall silent for those who died in war. In the United States the same date is Veterans Day; across the Commonwealth it is Remembrance Day.\n\nA poppy, a name on a wall, a minute of quiet. The point is not victory — it is not forgetting people who did not come home.\n\nEach lotus offered today is also a prayer: that they are not forgotten, and that every home may find peace.',
      },
    },
    {
      id: 'hung-kings',
      name: 'Giỗ Tổ Hùng Vương',
      aliases: ['hung kings', 'gio to hung vuong', 'vua hung'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-03-10`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Hùng Vương',
      note: 'Giỗ Tổ Hùng Vương',
      story: {
        title: 'Giỗ Tổ Hùng Vương',
        body:
          'Mùng mười tháng Ba âm lịch, người Việt nhớ các Vua Hùng — tổ của giống nòi. Không phải giỗ một người, mà giỗ nguồn cội: đất Phong Châu, trăm trứng, núi Nghĩa Lĩnh.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện nhớ tổ tiên chung, nguyện cho nhà nhà được bình an.',
        titleEn: 'Hung Kings’ Anniversary',
        bodyEn:
          'On the tenth of the third lunar month, Vietnamese people remember the Hùng Kings — the ancestral founders. It is not one person’s death day, but a day for the shared origin of the people.\n\nEach lotus offered today is also a prayer: for those first ancestors, and that every home may find peace.',
      },
    },
    {
      id: 'war-martyrs',
      name: 'Thương binh liệt sĩ',
      aliases: ['ngay thuong binh liet si', '27/7', 'war invalids and martyrs'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-07-27`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Liệt sĩ',
      note: 'Thương binh liệt sĩ',
      story: {
        title: 'Ngày Thương binh liệt sĩ',
        body:
          '27 tháng 7, cả nước thắp hương cho người ngã xuống vì chiến tranh — liệt sĩ không tên và người còn sống mang thương tích.\n\nMột bông sen không hỏi phe phái. Mỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện người đã khuất được nhớ, nguyện cho nhà nhà được bình an.',
        titleEn: 'War Invalids and Martyrs Day',
        bodyEn:
          'On 27 July, Vietnam remembers those who fell in war — named and unnamed — and those who came home wounded.\n\nA lotus does not ask which side. Each lotus offered today is also a prayer: that those who did not return are remembered, and that every home may find peace.',
      },
    },
    {
      id: 'tran-hung-dao',
      name: 'Trần Hưng Đạo',
      aliases: ['hung dao vuong', 'tran quoc tuan', 'duc thanh tran'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-08-20`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Trần Hưng Đạo',
      note: 'Giỗ Trần Hưng Đạo',
      story: {
        title: 'Đức Thánh Trần',
        body:
          'Ngày 20 tháng Tám âm lịch là giỗ Hưng Đạo Vương Trần Quốc Tuấn. Dân gian thờ Ngài như Đức Thánh Trần — vị anh hùng thành thần, người ta cầu bình an hơn là kể chiến công.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện được che chở, nguyện cho nhà nhà được bình an.',
        titleEn: 'Trần Hưng Đạo',
        bodyEn:
          'The twentieth of the eighth lunar month is the memorial of Prince Trần Hưng Đạo. Folk tradition honours him as Đức Thánh Trần — a hero who became a guardian, asked for peace more than for victory.\n\nEach lotus offered today is also a prayer: for that refuge, and that every home may find peace.',
      },
    },
    {
      id: 'ho-chi-minh',
      name: 'Hồ Chí Minh',
      aliases: ['bac ho', 'chu tich ho chi minh', 'ngay gio bac ho'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-07-21`,
      birthDate: '1890-05-19',
      countries: vn,
      birthPlace: 'Kim Liên, Nam Đàn, Nghệ An',
      altarName: 'Hồ Chí Minh',
      note: 'Giỗ Hồ Chí Minh',
      story: {
        title: 'Giỗ Hồ Chí Minh',
        body:
          'Ngày 21 tháng Bảy âm lịch là giỗ Chủ tịch Hồ Chí Minh — Người mất ngày 2 tháng 9 năm 1969 (âm lịch 21/7 năm Kỷ Dậu). Nhiều nhà vẫn thắp hương như giỗ một người ông của đất nước — không ồn, chỉ một nén hương và bông hoa.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện giữ lời tưởng niệm, nguyện cho nhà nhà được bình an.',
        titleEn: 'Hồ Chí Minh — Death Anniversary',
        bodyEn:
          'The twenty-first of the seventh lunar month is the death anniversary of President Hồ Chí Minh, who died on 2 September 1969 (lunar 21/7 of the Kỷ Dậu year). Many households still offer incense as they would for a grandfather of the country — quietly, with a flower.\n\nEach lotus offered today is also a prayer: that this remembrance is kept, and that every home may find peace.',
      },
    },
    {
      id: 'ho-chi-minh-birthday',
      name: 'Ngày sinh Hồ Chí Minh',
      aliases: ['ngay sinh chu tich ho chi minh', 'sinh nhat bac ho'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-05-19`,
      birthDate: '1890-05-19',
      countries: vn,
      birthPlace: 'Kim Liên, Nam Đàn, Nghệ An',
      altarName: 'Ngày sinh Hồ Chí Minh',
      note: 'Ngày sinh Hồ Chí Minh',
      story: {
        title: 'Ngày sinh Hồ Chí Minh',
        body:
          '19 tháng 5 là ngày sinh Chủ tịch Hồ Chí Minh. Nhiều nhà vẫn thắp hương như giỗ một người ông của đất nước — không ồn, chỉ một nén hương và bông hoa.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện giữ lời tưởng niệm, nguyện cho nhà nhà được bình an.',
        titleEn: 'Hồ Chí Minh — Birthday',
        bodyEn:
          '19 May is the birthday of President Hồ Chí Minh. Many households still offer incense as they would for a grandfather of the country — quietly, with a flower.\n\nEach lotus offered today is also a prayer: that this remembrance is kept, and that every home may find peace.',
      },
    },
    {
      id: 'hai-ba-trung',
      name: 'Hai Bà Trưng',
      aliases: ['trung sisters', 'ba trung', 'trung trac', 'trung nhi'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-02-06`,
      countries: vn,
      birthPlace: 'Việt Nam',
      altarName: 'Hai Bà Trưng',
      note: 'Giỗ Hai Bà Trưng',
      story: {
        title: 'Hai Bà Trưng',
        body:
          'Mùng sáu tháng Hai âm lịch, nhiều nơi giỗ Hai Bà Trưng — Trưng Trắc và Trưng Nhị. Không chỉ kể trận, mà nhớ hai người phụ nữ thành chỗ dựa thiêng cho nhiều nhà.\n\nMỗi bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện tên còn được giữ, nguyện cho nhà nhà được bình an.',
        titleEn: 'The Trưng Sisters',
        bodyEn:
          'On the sixth of the second lunar month, many places remember the Trưng sisters — Trưng Trắc and Trưng Nhị. Not only a battle story: two women who became a refuge in folk memory.\n\nEach lotus offered today is also a prayer: that these names are still kept, and that every home may find peace.',
      },
    },
    {
      id: 'hanyi',
      name: '寒衣节',
      aliases: ['han yi', 'cold clothes festival', '十月一', '祭祖送寒衣'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-10-01`,
      countries: zh,
      birthPlace: '中国',
      altarName: '寒衣节',
      note: '寒衣节',
      story: {
        title: '寒衣节',
        titleZh: '寒衣节',
        body:
          '农历十月初一，入冬。生者给亡者送寒衣——烧纸衣、纸钱，怕路上冷。\n\n今日每一朵莲花，也是一句愿：愿亡者不孤，愿家家得安宁。',
        bodyZh:
          '农历十月初一，入冬。生者给亡者送寒衣——烧纸衣、纸钱，怕路上冷。\n\n今日每一朵莲花，也是一句愿：愿亡者不孤，愿家家得安宁。',
        titleEn: 'Cold Clothes Festival',
        bodyEn:
          'On the first of the tenth lunar month, winter begins. The living send warm clothes to the dead — paper garments, paper money — so the road is less cold.\n\nEach lotus offered today is also a prayer: that those who are remembered are not alone, and that every home may find peace.',
      },
    },
    {
      id: 'chongyang',
      name: '重阳节',
      aliases: ['chong yang', 'double ninth', '登高', '敬老'],
      kind: 'event',
      eventCalendar: 'lunar',
      eventDate: `${y}-09-09`,
      countries: zh,
      birthPlace: '中国',
      altarName: '重阳节',
      note: '重阳节',
      story: {
        title: '重阳节',
        titleZh: '重阳节',
        body:
          '九月九，登高、敬老。有的地方也在这一天扫墓，把秋天的花带给先人。\n\n今日每一朵莲花，也是一句愿：愿长者安康，愿家家得安宁。',
        bodyZh:
          '九月九，登高、敬老。有的地方也在这一天扫墓，把秋天的花带给先人。\n\n今日每一朵莲花，也是一句愿：愿长者安康，愿家家得安宁。',
        titleEn: 'Double Ninth Festival',
        bodyEn:
          'On the ninth of the ninth lunar month people climb high and honour elders. In some regions they also visit graves and bring autumn flowers.\n\nEach lotus offered today is also a prayer: for elders still here and those gone ahead, and that every home may find peace.',
      },
    },
    {
      id: 'dongzhi',
      name: '冬至',
      aliases: ['dong zhi', 'winter solstice', '冬至节'],
      kind: 'event',
      eventCalendar: 'solar',
      eventDate: dongzhiSolarYmd(year),
      countries: zh,
      birthPlace: '中国',
      altarName: '冬至',
      note: '冬至',
      story: {
        title: '冬至',
        titleZh: '冬至',
        body:
          '一年最长的夜。不少人家在这一天祭祖、吃汤圆，把还活着的人和已经走的人算进同一桌。\n\n今日每一朵莲花，也是一句愿：愿这一桌团圆，愿家家得安宁。',
        bodyZh:
          '一年最长的夜。不少人家在这一天祭祖、吃汤圆，把还活着的人和已经走的人算进同一桌。\n\n今日每一朵莲花，也是一句愿：愿这一桌团圆，愿家家得安宁。',
        titleEn: 'Winter Solstice',
        bodyEn:
          'The longest night of the year. Many households honour ancestors, share tangyuan, and count the living and the dead at one table.\n\nEach lotus offered today is also a prayer: for the empty place at that table, and that every home may find peace.',
      },
    },
    {
      id: 'confucius',
      name: '孔子',
      aliases: ['kongzi', 'teacher day', '孔子诞辰', '孔圣诞'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-09-28`,
      countries: zh,
      birthPlace: '曲阜',
      altarName: '孔子',
      note: '孔子诞辰',
      story: {
        title: '孔子诞辰',
        titleZh: '孔子诞辰',
        body:
          '九月二十八，祭祀至圣先师。不是帝王的忌日，是老师的生日：有教无类，慎终追远。\n\n今日每一朵莲花，也是一句愿：愿慎终追远，愿家家得安宁。',
        bodyZh:
          '九月二十八，祭祀至圣先师。不是帝王的忌日，是老师的生日：有教无类，慎终追远。\n\n今日每一朵莲花，也是一句愿：愿慎终追远，愿家家得安宁。',
        titleEn: 'Confucius’s Birthday',
        bodyEn:
          '28 September honours Confucius, the teacher — not an emperor’s death day, but a birthday: education without class, and remembrance of ancestors.\n\nEach lotus offered today is also a prayer: that remembrance is taught on, and that every home may find peace.',
      },
    },
    {
      id: 'guan-yu',
      name: '关羽',
      aliases: ['guanyu', 'guan gong', '关公', '关帝'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-06-24`,
      countries: zh,
      birthPlace: '中国',
      altarName: '关羽',
      note: '关公诞',
      story: {
        title: '关公诞',
        titleZh: '关公诞',
        body:
          '六月廿四，祭祀关羽。英雄成神：人家求的是信义与平安，不只是战场。\n\n今日每一朵莲花，也是一句愿：愿信义长在，愿家家得安宁。',
        bodyZh:
          '六月廿四，祭祀关羽。英雄成神：人家求的是信义与平安，不只是战场。\n\n今日每一朵莲花，也是一句愿：愿信义长在，愿家家得安宁。',
        titleEn: 'Guan Yu',
        bodyEn:
          'The twenty-fourth of the sixth lunar month honours Guan Yu. A hero who became a guardian: households ask for trust and peace, not only victory.\n\nEach lotus offered today is also a prayer: for honour and trust, and that every home may find peace.',
      },
    },
    {
      id: 'mazu',
      name: '妈祖',
      aliases: ['ma zu', 'tin hau', '天后', '天上圣母'],
      kind: 'hero',
      eventCalendar: 'lunar',
      eventDate: `${y}-03-23`,
      countries: zh,
      birthPlace: '湄洲',
      altarName: '妈祖',
      note: '妈祖诞',
      story: {
        title: '妈祖诞',
        titleZh: '妈祖诞',
        body:
          '三月廿三，祭祀妈祖。沿海人家记得她护佑出海的人——有的回来，有的没有。\n\n今日每一朵莲花，也是一句愿：愿出海的人平安归来，愿家家得安宁。',
        bodyZh:
          '三月廿三，祭祀妈祖。沿海人家记得她护佑出海的人——有的回来，有的没有。\n\n今日每一朵莲花，也是一句愿：愿出海的人平安归来，愿家家得安宁。',
        titleEn: 'Mazu',
        bodyEn:
          'The twenty-third of the third lunar month honours Mazu. Coastal households remember her as a guardian of those at sea — some who returned, and some who did not.\n\nEach lotus offered today is also a prayer: for those at sea and those who did not come home, and that every home may find peace.',
      },
    },
    {
      id: 'halloween',
      name: "All Hallows' Eve",
      aliases: ['halloween', 'samhain', 'all hallows eve'],
      kind: 'ghost',
      eventCalendar: 'solar',
      eventDate: `${y}-10-31`,
      countries: en,
      birthPlace: '',
      altarName: "All Hallows' Eve",
      note: "All Hallows' Eve",
      story: {
        title: "All Hallows' Eve",
        titleEn: "All Hallows' Eve",
        body:
          'The night before All Saints, old Europe said the veil between living and dead grew thin. Lanterns, names, a place at the table for those who had gone.\n\nA lotus here is not a costume. Each lotus offered today is also a prayer: a light for wandering souls, and that every home may find peace.',
        bodyEn:
          'The night before All Saints, old Europe said the veil between living and dead grew thin. Lanterns, names, a place at the table for those who had gone.\n\nA lotus here is not a costume. Each lotus offered today is also a prayer: a light for wandering souls, and that every home may find peace.',
      },
    },
    {
      id: 'all-saints',
      name: "All Saints' Day",
      aliases: ['all saints', 'all saints day', 'hallowmas'],
      kind: 'event',
      eventCalendar: 'solar',
      eventDate: `${y}-11-01`,
      countries: en,
      birthPlace: '',
      altarName: "All Saints' Day",
      note: "All Saints' Day",
      story: {
        title: "All Saints' Day",
        titleEn: "All Saints' Day",
        body:
          '1 November remembers all the holy dead — famous and forgotten. Graves are visited, candles lit, flowers laid, the day before All Souls.\n\nEach lotus offered today is also a prayer: for every name the calendar cannot list, and that every home may find peace.',
        bodyEn:
          '1 November remembers all the holy dead — famous and forgotten. Graves are visited, candles lit, flowers laid, the day before All Souls.\n\nEach lotus offered today is also a prayer: for every name the calendar cannot list, and that every home may find peace.',
      },
    },
    {
      id: 'memorial-day',
      name: 'Memorial Day',
      aliases: ['us memorial day', 'decoration day'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: memorialDaySolarYmd(year),
      countries: ['US'],
      birthPlace: '',
      altarName: 'Memorial Day',
      note: 'Memorial Day',
      story: {
        title: 'Memorial Day',
        titleEn: 'Memorial Day',
        body:
          'The last Monday in May, the United States remembers those who died in military service. Flags, graves, a weekend that began as Decoration Day — flowers on stones.\n\nEach lotus offered today is also a prayer: that names are kept, and that every home may find peace.',
        bodyEn:
          'The last Monday in May, the United States remembers those who died in military service. Flags, graves, a weekend that began as Decoration Day — flowers on stones.\n\nEach lotus offered today is also a prayer: that names are kept, and that every home may find peace.',
      },
    },
    {
      id: 'anzac',
      name: 'ANZAC Day',
      aliases: ['anzac', 'april 25'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-04-25`,
      countries: ['AU', 'NZ'],
      birthPlace: '',
      altarName: 'ANZAC Day',
      note: 'ANZAC Day',
      story: {
        title: 'ANZAC Day',
        titleEn: 'ANZAC Day',
        body:
          '25 April, Australia and New Zealand stand at dawn for those who served and those who did not come home. A minute of silence; a sprig of rosemary.\n\nEach lotus offered today is also a prayer: that this silence is kept, and that every home may find peace.',
        bodyEn:
          '25 April, Australia and New Zealand stand at dawn for those who served and those who did not come home. A minute of silence; a sprig of rosemary.\n\nEach lotus offered today is also a prayer: that this silence is kept, and that every home may find peace.',
      },
    },
  ];
}

export function findCatalogEntryByName(
  name: string | null | undefined,
  year = 2026,
): TempleSpecialCatalogEntry | undefined {
  const key = foldSpecialName(name ?? '');
  if (!key) return undefined;
  return templeSpecialCatalog(year).find(e => {
    if (foldSpecialName(e.id) === key || foldSpecialName(e.name) === key) {
      return true;
    }
    return (e.aliases ?? []).some(a => foldSpecialName(a) === key);
  });
}

export function findCatalogEntryById(
  id: string | null | undefined,
  year = 2026,
): TempleSpecialCatalogEntry | undefined {
  const key = String(id ?? '')
    .trim()
    .toLowerCase();
  if (!key) return undefined;
  return templeSpecialCatalog(year).find(e => e.id === key);
}
