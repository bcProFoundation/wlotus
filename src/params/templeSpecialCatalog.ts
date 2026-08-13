/**
 * Regional temple-special catalog (2026 launch year).
 *
 * Home Events filters by JSON `countries` (see specialCountries.ts).
 * Each entry is a distinct on-chain root + off-chain registry row.
 *
 * Research (memorial / ancestral offering days that fit W Lotus):
 *   VN  — Vu Lan (filial Ullambana), Cô Hồn (hungry-ghost month),
 *         Tết Thanh Minh (grave visiting; same solar term as Qingming).
 *   ZH  — 盂兰盆 (Ullambana), 中元节 (Ghost Festival / Zhongyuan),
 *         清明节 (Tomb-Sweeping). Chinese-speaking: CN, TW, HK, MO, SG.
 *   EN  — All Souls' Day (2 Nov, prayers for the dead),
 *         Remembrance Day (11 Nov; Veterans Day in the US).
 *
 * 2026 solar anchors:
 *   Lunar 1/7  → 13 Aug (ghost-month open, Chinese calendar)
 *   Lunar 2/7  → 14 Aug (VN Cô Hồn start, Hồ Ngọc Đức UTC+7)
 *   Lunar 15/7 → 27 Aug (Vu Lan / Ullambana / Zhongyuan peak)
 *   Qingming / Thanh Minh → 5 Apr 2026 (solar term; PRC holiday 4–6 Apr)
 *   All Souls' → 2 Nov 2026
 *   Remembrance / Veterans → 11 Nov 2026
 */
import type { TempleEventCalendar, TempleSpecialKind } from './templeSpecials.js';
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
  countries: string[];
  /** On-chain altar birthPlace (quê quán label). */
  birthPlace: string;
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

function foldName(raw: string): string {
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
          'Ngày xưa, Tôn giả Mục Kiền Liên — đệ tử thần thông đệ nhất của Đức Phật — dùng thiên nhãn tìm mẹ. Ngài thấy mẹ đang chịu kiếp ngạ quỷ: cổ họng nhỏ như kim, bụng đói không no. Ngài dâng cơm, nhưng thức ăn hóa thành lửa.\n\nĐức Phật dạy: một mình không đủ. Hãy đợi Rằm tháng Bảy, ngày chư Tăng tự tứ, thiết lễ Vu Lan Bồn — nhờ sức chúng tăng mười phương, mẹ mới được siêu thoát.\n\nTừ đó, Rằm tháng Bảy là ngày Báo Hiếu: dâng hoa, tưởng nhớ ông bà cha mẹ, hồi hướng công đức. Một bông sen W Lotus bạn dâng hôm nay cũng là một lời tri ân — hoa tưởng niệm không tàn.',
        titleEn: 'Vu Lan — Filial Gratitude',
        bodyEn:
          'Long ago, Venerable Maudgalyayana — foremost in supernatural power among the Buddha’s disciples — sought his mother with the divine eye. He found her reborn as a hungry ghost: throat thin as a needle, never sated. Food he offered turned to fire.\n\nThe Buddha taught: one person alone cannot lift such karma. Wait for the full moon of the seventh lunar month, when the Sangha completes the rains retreat. Offer the Ullambana rite; with the merit of the community of monastics, her suffering can be eased.\n\nSo the fifteenth of the seventh month became a day of filial gratitude: flowers, remembrance of parents and ancestors, dedication of merit. The lotus you offer on W Lotus is one more word of thanks — a flower of remembrance that does not fade.',
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
          'Tháng Bảy âm lịch, dân gian gọi là tháng cô hồn. Cửa Quỷ Môn mở: những vong hồn không nơi nương tựa — chết oan, lạc lối, không người thờ cúng — được trở về cõi dương một thời.\n\nNgười sống bày mâm chay, cháo, muối… bố thí ngoài trời, không chỉ cho tổ tiên nhà mình mà cho cả những linh hồn lang thang. Đó là lòng từ bi: dù tội nghiệp nặng đến đâu, vẫn có ngày được xá, được no một bữa, được nhớ tới.\n\nCúng cô hồn không phải sợ hãi — là sẻ chia. Một bông sen dâng lên hôm nay cũng là một lời nguyện: nguyện cho mọi hương linh được siêu thoát, nguyện cho nhà nhà bình an.',
        titleEn: 'Pardon for Wandering Spirits',
        bodyEn:
          'In the seventh lunar month, folk tradition speaks of the Hungry Ghost season. The ghost gate opens: spirits without a home — the wronged, the lost, those with no one to offer incense — may walk the living world for a time.\n\nPeople set out simple vegetarian offerings outdoors — not only for their own ancestors, but for every wandering soul. It is compassion: even heavy karma is granted a day of pardon, a meal, a moment of being remembered.\n\nOffering to lonely spirits is not fear — it is sharing. The lotus you offer today is also a wish: that every spirit finds peace, and every home finds calm.',
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
          'Tiết Thanh Minh — trời trong, cây cỏ đâm chồi. Người Việt sửa sang phần mộ ông bà: nhổ cỏ, đắp đất, thắp hương, dâng hoa. Không phải ngày sợ hãi, mà là ngày về nhà với người đã khuất.\n\nTảo mộ rồi, cả nhà ngồi lại, kể chuyện người xưa, nhắc con cháu đừng quên nguồn cội. Một nắm đất, một nén hương, một bông hoa — đủ để nói: chúng con vẫn nhớ.\n\nSen W Lotus dâng hôm nay cũng là một lần tảo mộ trên chuỗi khối: hoa không tàn theo mưa nắng, lời tưởng niệm còn lại cho đời sau.',
        titleEn: 'Thanh Minh — Visiting the Graves',
        bodyEn:
          'Thanh Minh is the clear-and-bright solar term, when families in Vietnam tend ancestral graves: pull weeds, add earth, light incense, offer flowers. It is not a day of fear, but a homecoming with those who came before.\n\nAfter the tombs are swept, people sit together and tell the old stories so children will not forget their roots. A handful of soil, a stick of incense, a flower — enough to say: we still remember.\n\nThe lotus you offer on W Lotus is one more grave-visit on the chain: a flower that rain cannot fade, a remembrance that remains.',
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
          '昔日目连尊者以天眼寻母，见其堕饿鬼道：咽细如针，腹饥难饱。目连奉食，食至口边即化为火。\n\n佛言：一人之力不足。待七月十五僧自恣日，设盂兰盆供，仗十方众僧威德，母得解脱。\n\n自此七月十五成为报恩之日：供花、忆念父母祖先、回向功德。你在 W Lotus 献上的一朵莲花，也是一句谢谢——不凋的纪念。',
        bodyZh:
          '昔日目连尊者以天眼寻母，见其堕饿鬼道：咽细如针，腹饥难饱。目连奉食，食至口边即化为火。\n\n佛言：一人之力不足。待七月十五僧自恣日，设盂兰盆供，仗十方众僧威德，母得解脱。\n\n自此七月十五成为报恩之日：供花、忆念父母祖先、回向功德。你在 W Lotus 献上的一朵莲花，也是一句谢谢——不凋的纪念。',
        titleEn: 'Ullambana — Filial Gratitude',
        bodyEn:
          'Maudgalyayana searched for his mother with the divine eye and found her among the hungry ghosts. Food he offered turned to fire.\n\nThe Buddha taught him to wait for the fifteenth of the seventh lunar month, when the Sangha completes the rains retreat, and to offer the Ullambana rite so the merit of the community could ease her suffering.\n\nThat full moon became a day of filial gratitude. The lotus you offer on W Lotus is one more word of thanks — a flower of remembrance that does not fade.',
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
          '农历七月，民间称为鬼月。鬼门开，无祀孤魂——枉死、迷路、无人奉祀者——得返阳间一时。中元节在七月十五，是这月的高峰。\n\n活人在户外设素食、香烛，不只祭自家祖先，也布施一切流浪的灵魂。这是慈悲：再重的业，也有一日得赦、得一餐、被人想起。\n\n供孤不是恐惧，是分享。今日一朵莲花，也是愿一切有情得安、家家得宁。',
        bodyZh:
          '农历七月，民间称为鬼月。鬼门开，无祀孤魂——枉死、迷路、无人奉祀者——得返阳间一时。中元节在七月十五，是这月的高峰。\n\n活人在户外设素食、香烛，不只祭自家祖先，也布施一切流浪的灵魂。这是慈悲：再重的业，也有一日得赦、得一餐、被人想起。\n\n供孤不是恐惧，是分享。今日一朵莲花，也是愿一切有情得安、家家得宁。',
        titleEn: 'Zhongyuan — Feeding Lonely Spirits',
        bodyEn:
          'The seventh lunar month is Ghost Month. The gate opens: unattended spirits — the wronged, the lost, those with no one to offer incense — may walk among the living for a time. Zhongyuan on the fifteenth is the peak of that month.\n\nPeople set out simple vegetarian offerings outdoors, not only for their own ancestors but for every wandering soul. It is compassion: even heavy karma is granted a day of pardon, a meal, a moment of being remembered.\n\nOffering to lonely spirits is not fear — it is sharing. The lotus you offer today is also a wish that every being finds peace.',
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
          '清明时节，春草发、天色清。家人上坟：除草、培土、献花、上香。不是哀伤的节日，而是与先人的一次团聚。\n\n扫墓之后，把旧事讲给孩子听，让根还在。一抔土、一炷香、一枝花，已足够说：我们还记得。\n\nW Lotus 上的莲花，是链上的一次扫墓——雨打不凋，纪念仍在。',
        bodyZh:
          '清明时节，春草发、天色清。家人上坟：除草、培土、献花、上香。不是哀伤的节日，而是与先人的一次团聚。\n\n扫墓之后，把旧事讲给孩子听，让根还在。一抔土、一炷香、一枝花，已足够说：我们还记得。\n\nW Lotus 上的莲花，是链上的一次扫墓——雨打不凋，纪念仍在。',
        titleEn: 'Qingming — Tomb Sweeping',
        bodyEn:
          'At Qingming the air clears and spring returns. Families visit ancestral graves: pull weeds, add earth, offer flowers and incense. It is not only mourning — it is a reunion with those who came before.\n\nAfter the tombs are swept, the old stories are told so children will not forget their roots. A handful of soil, incense, a flower — enough to say: we still remember.\n\nThe lotus you offer on W Lotus is a tomb-sweeping on the chain: a flower rain cannot fade.',
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
          'On the second of November, churches and families remember all the dead — not only the famous, but every soul still held in love. People visit graves, light candles, and lay flowers.\n\nThe day follows All Saints. Together they say: the living and the dead remain one household. A prayer, a name spoken aloud, a flower on the stone.\n\nThe lotus you offer on W Lotus is that flower kept: a remembrance that does not wilt, for every soul you still carry.',
        bodyEn:
          'On the second of November, churches and families remember all the dead — not only the famous, but every soul still held in love. People visit graves, light candles, and lay flowers.\n\nThe day follows All Saints. Together they say: the living and the dead remain one household. A prayer, a name spoken aloud, a flower on the stone.\n\nThe lotus you offer on W Lotus is that flower kept: a remembrance that does not wilt, for every soul you still carry.',
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
          'At the eleventh hour of the eleventh day of the eleventh month, many English-speaking countries fall silent for those who died in war. In the United States the same date is Veterans Day; across the Commonwealth it is Remembrance Day.\n\nA poppy, a name on a wall, a minute of quiet. The point is not victory — it is not forgetting people who did not come home.\n\nA lotus on W Lotus can stand with that silence: one more flower for the dead, kept on the chain.',
        bodyEn:
          'At the eleventh hour of the eleventh day of the eleventh month, many English-speaking countries fall silent for those who died in war. In the United States the same date is Veterans Day; across the Commonwealth it is Remembrance Day.\n\nA poppy, a name on a wall, a minute of quiet. The point is not victory — it is not forgetting people who did not come home.\n\nA lotus on W Lotus can stand with that silence: one more flower for the dead, kept on the chain.',
      },
    },
  ];
}

export function findCatalogEntryByName(
  name: string | null | undefined,
  year = 2026,
): TempleSpecialCatalogEntry | undefined {
  const key = foldName(name ?? '');
  if (!key) return undefined;
  return templeSpecialCatalog(year).find(e => {
    if (foldName(e.id) === key || foldName(e.name) === key) return true;
    return (e.aliases ?? []).some(a => foldName(a) === key);
  });
}
