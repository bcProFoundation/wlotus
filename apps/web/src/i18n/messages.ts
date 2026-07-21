import type { Locale } from './types.js';

/** Flat UI strings. Use `{name}` placeholders. */
export type MessageKey =
  | 'brand'
  | 'tagline'
  | 'offerTitle'
  | 'hintPrayMine'
  | 'hintKeepScreen'
  | 'howTitle'
  | 'howPrayTitle'
  | 'howPrayBody'
  | 'howMintTitle'
  | 'howMintBody'
  | 'howBurnTitle'
  | 'howBurnBody'
  | 'etaEstimated'
  | 'noteLabel'
  | 'notePlaceholder'
  | 'btnOffer'
  | 'btnPreparing'
  | 'btnPraying'
  | 'btnOffering'
  | 'btnCancel'
  | 'miningElapsed'
  | 'connecting'
  | 'apiOffline'
  | 'leftToday'
  | 'miningCancelled'
  | 'miningOnNewTip'
  | 'offeredIn'
  | 'recentTitle'
  | 'offeringFallback'
  | 'footerBrand';

type Dict = Record<MessageKey, string>;

const en: Dict = {
  brand: 'White Lotus',
  tagline: 'Offer a white lotus in remembrance of someone dear.',
  offerTitle: 'Offer a Flower',
  hintPrayMine:
    'A few minutes of remembrance on this device bring forth lotus flowers for memory and merit.',
  hintKeepScreen:
    'Keep the app open while you pray so the flower offering can continue.',
  howTitle: 'How does WLOTUS work?',
  howPrayTitle: '',
  howPrayBody:
    'Your phone searches for a digital WLOTUS. Keep the app open and in the foreground so the search can continue. Use that time to remember someone who has passed. You can stop the search anytime.',
  howMintTitle: '',
  howMintBody:
    'Finding WLOTUS yields 100 digital WLOTUSes. Depending on your device, this may take from about a minute to over ten minutes. One WLOTUS is offered in remembrance of the departed. The other 99 are dedicated to WLOTUS developers — shared with those who find their way here, and to keep the system running.',
  howBurnTitle: '',
  howBurnBody: '',
  etaEstimated: 'Estimated time {eta}',
  noteLabel: 'Words of remembrance…',
  notePlaceholder: 'Name or dedication',
  btnOffer: 'Offer a Flower',
  btnPreparing: 'Preparing…',
  btnPraying: 'Finding a lotus…',
  btnOffering: 'Offering…',
  btnCancel: 'Cancel',
  miningElapsed: 'Search time · {elapsed}',
  connecting: 'Connecting…',
  apiOffline:
    'Mint API offline — start mint-api on Contabo and proxy /api → :8787',
  leftToday: '{n} left today on this device',
  miningCancelled: 'Search cancelled.',
  miningOnNewTip: 'Searching on a new tip',
  offeredIn: 'Offered in {duration}',
  recentTitle: 'Recent',
  offeringFallback: 'Offering',
  footerBrand: 'White Lotus',
};

const vi: Dict = {
  brand: 'White Lotus',
  tagline: 'Dâng một đóa sen tưởng nhớ người đã khuất.',
  offerTitle: 'Dâng Hoa',
  hintPrayMine:
    'Một vài phút tưởng niệm trên máy sẽ sản sinh ra hoa sen để tưởng nhớ và công đức.',
  hintKeepScreen:
    'Giữ ứng dụng luôn mở để quá trình tìm kiếm và dâng hoa được tiếp tục.',
  howTitle: 'WLOTUS hoạt động như thế nào?',
  howPrayTitle: '',
  howPrayBody:
    'Điện thoại được dùng để tìm ra bông sen số WLOTUS. Bạn phải bật ứng dụng liên tục và không sử dụng ứng dụng khác để quá trình tìm kiếm bông sen số được tiếp tục. Trong lúc này, bạn có thể tưởng nhớ về người đã khuất. Bạn có thể dừng quá trình tìm kiếm này bất cứ lúc nào.',
  howMintTitle: '',
  howMintBody:
    'Quá trình tìm kiếm WLOTUS sẽ sinh ra 100 đóa sen số. Tùy theo năng lực của máy, quá trình này có thể từ 1 phút đến trên 10 phút. 1 bông sen sẽ được dùng để dâng lên tưởng niệm cho người đã khuất. 99 bông còn lại sẽ được công đức cho nhà phát triển WLOTUS để phát hành cho những người có duyên và duy trì hệ thống.',
  howBurnTitle: '',
  howBurnBody: '',
  etaEstimated: 'Thời gian ước tính {eta}',
  noteLabel: 'Lời tưởng niệm...',
  notePlaceholder: 'Tên hoặc lời tưởng niệm',
  btnOffer: 'Dâng Hoa',
  btnPreparing: 'Đang chuẩn bị…',
  btnPraying: 'Đang tìm hoa sen…',
  btnOffering: 'Đang dâng hoa…',
  btnCancel: 'Hủy',
  miningElapsed: 'Thời gian tìm kiếm · {elapsed}',
  connecting: 'Đang kết nối…',
  apiOffline: 'API mint ngoại tuyến — kiểm tra mint-api trên Contabo.',
  leftToday: 'Còn {n} lần hôm nay trên thiết bị này',
  miningCancelled: 'Đã hủy tìm kiếm.',
  miningOnNewTip: 'Tìm kiếm trên tip mới',
  offeredIn: 'Đã dâng hoa trong {duration}',
  recentTitle: 'Gần đây',
  offeringFallback: 'Lần dâng hoa',
  footerBrand: 'White Lotus',
};

const zh: Dict = {
  brand: 'White Lotus',
  tagline: '献上一朵白莲，纪念逝去的亲人。',
  offerTitle: '献花',
  hintPrayMine:
    '在本机上花几分钟追思，即可生出莲花，用于功德与纪念。',
  hintKeepScreen:
    '祈祷时请保持应用常开，以便献花过程得以继续。',
  howTitle: 'WLotus 如何运作？',
  howPrayTitle: '',
  howPrayBody:
    '手机用于寻找数字莲花 WLOTUS。请保持应用持续开启，且不要切换到其他应用，以便寻找过程继续。在此期间，您可以追思逝去的亲人。您可以随时停止寻找。',
  howMintTitle: '',
  howMintBody:
    '寻找 WLOTUS 会生出 100 朵数字莲花。视设备性能，大约需要 1 分钟到 10 分钟以上。其中 1 朵用于献上，纪念逝者；其余 99 朵功德于 WLOTUS，发行给有缘人，并维系系统运转。',
  howBurnTitle: '',
  howBurnBody: '',
  etaEstimated: '预计时间 {eta}',
  noteLabel: '追思寄语…',
  notePlaceholder: '姓名或寄语',
  btnOffer: '献花',
  btnPreparing: '准备中…',
  btnPraying: '正在寻找莲花…',
  btnOffering: '正在献花…',
  btnCancel: '取消',
  miningElapsed: '寻找时间 · {elapsed}',
  connecting: '连接中…',
  apiOffline: '铸造服务离线 — 请检查 Contabo 上的 mint-api。',
  leftToday: '本设备今日剩余 {n} 次',
  miningCancelled: '已取消寻找。',
  miningOnNewTip: '在新 tip 上继续寻找',
  offeredIn: '献花完成 · {duration}',
  recentTitle: '最近',
  offeringFallback: '献花',
  footerBrand: 'White Lotus',
};

export const MESSAGES: Record<Locale, Dict> = { en, vi, zh };

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? `{${key}}` : String(v);
  });
}
