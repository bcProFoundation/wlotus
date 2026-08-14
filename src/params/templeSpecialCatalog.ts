/**
 * Regional temple-special catalog (2026 launch year).
 *
 * Home Events filters by JSON `countries` (see specialCountries.ts).
 * Each entry is an off-chain catalog row. The first visitor's offering
 * becomes the on-chain root.
 *
 * Research (memorial / ancestral offering days that fit W Lotus):
 *   VN  — Vu Lan, Cô Hồn, Tết Thanh Minh, Giỗ Tổ Hùng Vương,
 *         Thương binh liệt sĩ, Trần Hưng Đạo, Hồ Chí Minh, Hai Bà Trưng.
 *   ZH  — 盂兰盆, 中元节, 清明节, 寒衣节, 重阳节, 冬至, 孔子, 关羽, 妈祖.
 *         Chinese-speaking: CN, TW, HK, MO, SG.
 *   EN  — All Hallows' Eve, All Saints', All Souls', Remembrance,
 *         Memorial Day (US), ANZAC Day (AU/NZ).
 *
 * Catalog rows are unbound until a visitor's first offering claims the root.
 * Temple does not pre-burn.
 *
 * 2026 solar anchors:
 *   Lunar 1/7  → 13 Aug (ghost-month open, Chinese calendar)
 *   Lunar 2/7  → 14 Aug (VN Cô Hồn start, Hồ Ngọc Đức UTC+7)
 *   Lunar 15/7 → 27 Aug (Vu Lan / Ullambana / Zhongyuan peak)
 *   Qingming / Thanh Minh → 5 Apr 2026 (solar term; PRC holiday 4–6 Apr)
 *   US Memorial Day → 25 May 2026 (last Monday)
 *   All Souls' → 2 Nov 2026
 *   Remembrance / Veterans → 11 Nov 2026
 *   冬至 → 22 Dec 2026
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
          'Mùng mười tháng Ba âm lịch, người Việt nhớ các Vua Hùng — tổ của giống nòi. Không phải giỗ một người, mà giỗ nguồn cội: đất Phong Châu, trăm trứng, núi Nghĩa Lĩnh.\n\nDâng hoa hôm nay là nhớ tổ tiên chung, trước khi nhớ ông bà nhà mình.',
        titleEn: 'Hung Kings’ Anniversary',
        bodyEn:
          'On the tenth of the third lunar month, Vietnamese people remember the Hùng Kings — the ancestral founders. It is not one person’s death day, but a day for the shared origin of the people.\n\nThe lotus you offer is for those first ancestors, before the ancestors of your own house.',
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
          '27 tháng 7, cả nước thắp hương cho người ngã xuống vì chiến tranh — liệt sĩ không tên và người còn sống mang thương tích.\n\nMột bông sen không hỏi phe phái. Chỉ nhớ: có người không về, và gia đình họ vẫn thắp đèn.',
        titleEn: 'War Invalids and Martyrs Day',
        bodyEn:
          'On 27 July, Vietnam remembers those who fell in war — named and unnamed — and those who came home wounded.\n\nA lotus does not ask which side. It only remembers that someone did not return, and a family still lights a lamp.',
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
          'Ngày 20 tháng Tám âm lịch là giỗ Hưng Đạo Vương Trần Quốc Tuấn. Dân gian thờ Ngài như Đức Thánh Trần — vị anh hùng thành thần, người ta cầu bình an hơn là kể chiến công.\n\nDâng sen là nhớ một người đã thành chỗ dựa thiêng cho nhiều nhà.',
        titleEn: 'Trần Hưng Đạo',
        bodyEn:
          'The twentieth of the eighth lunar month is the memorial of Prince Trần Hưng Đạo. Folk tradition honours him as Đức Thánh Trần — a hero who became a guardian, asked for peace more than for victory.\n\nA lotus here is for a name that many households still keep as a refuge.',
      },
    },
    {
      id: 'ho-chi-minh',
      name: 'Hồ Chí Minh',
      aliases: ['bac ho', 'ngay sinh chu tich ho chi minh'],
      kind: 'hero',
      eventCalendar: 'solar',
      eventDate: `${y}-05-19`,
      birthDate: '1890-05-19',
      countries: vn,
      birthPlace: 'Kim Liên, Nam Đàn, Nghệ An',
      altarName: 'Hồ Chí Minh',
      note: 'Hồ Chí Minh',
      story: {
        title: 'Hồ Chí Minh',
        body:
          '19 tháng 5 là ngày sinh Chủ tịch Hồ Chí Minh. Nhiều nhà vẫn thắp hương như giỗ một người ông của đất nước — không ồn, chỉ một nén hương và bông hoa.\n\nSen W Lotus giữ lời tưởng niệm đó trên chuỗi khối.',
        titleEn: 'Hồ Chí Minh',
        bodyEn:
          '19 May is the birthday of President Hồ Chí Minh. Many households still offer incense as they would for a grandfather of the country — quietly, with a flower.\n\nThe lotus on W Lotus keeps that remembrance on the chain.',
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
          'Mùng sáu tháng Hai âm lịch, nhiều nơi giỗ Hai Bà Trưng — Trưng Trắc và Trưng Nhị. Không chỉ kể trận, mà nhớ hai người phụ nữ thành chỗ dựa thiêng cho nhiều nhà.\n\nSen dâng hôm nay là một nén hương cho tên còn được giữ.',
        titleEn: 'The Trưng Sisters',
        bodyEn:
          'On the sixth of the second lunar month, many places remember the Trưng sisters — Trưng Trắc and Trưng Nhị. Not only a battle story: two women who became a refuge in folk memory.\n\nA lotus here is incense for names still kept.',
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
          '农历十月初一，入冬。生者给亡者送寒衣——烧纸衣、纸钱，怕路上冷。\n\n一朵莲花也可以是一件寒衣：让被记得的人，冬天里不孤。',
        bodyZh:
          '农历十月初一，入冬。生者给亡者送寒衣——烧纸衣、纸钱，怕路上冷。\n\n一朵莲花也可以是一件寒衣：让被记得的人，冬天里不孤。',
        titleEn: 'Cold Clothes Festival',
        bodyEn:
          'On the first of the tenth lunar month, winter begins. The living send warm clothes to the dead — paper garments, paper money — so the road is less cold.\n\nA lotus can be that garment: so those who are remembered are not alone in winter.',
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
          '九月九，登高、敬老。有的地方也在这一天扫墓，把秋天的花带给先人。\n\n莲花是给还在的老人，也是给已经走远的老人。',
        bodyZh:
          '九月九，登高、敬老。有的地方也在这一天扫墓，把秋天的花带给先人。\n\n莲花是给还在的老人，也是给已经走远的老人。',
        titleEn: 'Double Ninth Festival',
        bodyEn:
          'On the ninth of the ninth lunar month people climb high and honour elders. In some regions they also visit graves and bring autumn flowers.\n\nA lotus is for the old who are still here, and for the old who have already gone ahead.',
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
          '一年最长的夜。不少人家在这一天祭祖、吃汤圆，把还活着的人和已经走的人算进同一桌。\n\n莲花是给这一桌空着的位子。',
        bodyZh:
          '一年最长的夜。不少人家在这一天祭祖、吃汤圆，把还活着的人和已经走的人算进同一桌。\n\n莲花是给这一桌空着的位子。',
        titleEn: 'Winter Solstice',
        bodyEn:
          'The longest night of the year. Many households honour ancestors, share tangyuan, and count the living and the dead at one table.\n\nA lotus is for the empty place at that table.',
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
          '九月二十八，祭祀至圣先师。不是帝王的忌日，是老师的生日：有教无类，慎终追远。\n\n一朵莲花，献给把“祭”教给后人的人。',
        bodyZh:
          '九月二十八，祭祀至圣先师。不是帝王的忌日，是老师的生日：有教无类，慎终追远。\n\n一朵莲花，献给把“祭”教给后人的人。',
        titleEn: 'Confucius’s Birthday',
        bodyEn:
          '28 September honours Confucius, the teacher — not an emperor’s death day, but a birthday: education without class, and remembrance of ancestors.\n\nA lotus for the person who taught later generations how to honour the dead.',
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
          '六月廿四，祭祀关羽。英雄成神：人家求的是信义与平安，不只是战场。\n\n一朵莲花，献给仍被称作“关公”的名字。',
        bodyZh:
          '六月廿四，祭祀关羽。英雄成神：人家求的是信义与平安，不只是战场。\n\n一朵莲花，献给仍被称作“关公”的名字。',
        titleEn: 'Guan Yu',
        bodyEn:
          'The twenty-fourth of the sixth lunar month honours Guan Yu. A hero who became a guardian: households ask for trust and peace, not only victory.\n\nA lotus for the name still called Lord Guan.',
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
          '三月廿三，祭祀妈祖。沿海人家记得她护佑出海的人——有的回来，有的没有。\n\n莲花给还在海上的名字，也给没有回来的名字。',
        bodyZh:
          '三月廿三，祭祀妈祖。沿海人家记得她护佑出海的人——有的回来，有的没有。\n\n莲花给还在海上的名字，也给没有回来的名字。',
        titleEn: 'Mazu',
        bodyEn:
          'The twenty-third of the third lunar month honours Mazu. Coastal households remember her as a guardian of those at sea — some who returned, and some who did not.\n\nA lotus for names still on the water, and names that did not come home.',
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
          'The night before All Saints, old Europe said the veil between living and dead grew thin. Lanterns, names, a place at the table for those who had gone.\n\nA lotus here is not a costume. It is a light left on for wandering souls, the night before the saints are named.',
        bodyEn:
          'The night before All Saints, old Europe said the veil between living and dead grew thin. Lanterns, names, a place at the table for those who had gone.\n\nA lotus here is not a costume. It is a light left on for wandering souls, the night before the saints are named.',
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
          '1 November remembers all the holy dead — famous and forgotten. Graves are visited, candles lit, flowers laid, the day before All Souls.\n\nA lotus is for every name the calendar cannot list.',
        bodyEn:
          '1 November remembers all the holy dead — famous and forgotten. Graves are visited, candles lit, flowers laid, the day before All Souls.\n\nA lotus is for every name the calendar cannot list.',
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
          'The last Monday in May, the United States remembers those who died in military service. Flags, graves, a weekend that began as Decoration Day — flowers on stones.\n\nA lotus can be that decoration: not a parade, a name kept.',
        bodyEn:
          'The last Monday in May, the United States remembers those who died in military service. Flags, graves, a weekend that began as Decoration Day — flowers on stones.\n\nA lotus can be that decoration: not a parade, a name kept.',
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
          '25 April, Australia and New Zealand stand at dawn for those who served and those who did not come home. A minute of silence; a sprig of rosemary.\n\nA lotus at dawn is that silence kept on the chain.',
        bodyEn:
          '25 April, Australia and New Zealand stand at dawn for those who served and those who did not come home. A minute of silence; a sprig of rosemary.\n\nA lotus at dawn is that silence kept on the chain.',
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
