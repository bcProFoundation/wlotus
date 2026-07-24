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
  | 'howWhyTitle'
  | 'howWhyBody'
  | 'howEternalTitle'
  | 'howEternalBody'
  | 'etaEstimated'
  | 'noteLabel'
  | 'notePlaceholder'
  | 'btnOffer'
  | 'btnPraying'
  | 'btnOffering'
  | 'btnCancel'
  | 'miningElapsed'
  | 'connecting'
  | 'apiOffline'
  | 'leftToday'
  | 'miningCancelled'
  | 'memorialCancelled'
  | 'miningOnNewTip'
  | 'offeredIn'
  | 'recentTitle'
  | 'reofferHint'
  | 'reofferBadge'
  | 'burnTotal'
  | 'latestBurnLink'
  | 'btnReoffer'
  | 'offeringFallback'
  | 'offerSessionTitle'
  | 'reofferSessionTitle'
  | 'sessionNoteLabel'
  | 'reofferExtraNoteLabel'
  | 'reofferExtraNotePlaceholder'
  | 'btnOfferLotus'
  | 'btnClose'
  | 'shareHint'
  | 'shareLookingUp'
  | 'shareLinked'
  | 'shareLookupFailed'
  | 'btnShare'
  | 'shareCopied'
  | 'footerBrand';

type Dict = Record<MessageKey, string>;

const en: Dict = {
  brand: 'White Lotus',
  tagline: 'Offer an eternal lotus in remembrance of someone who has passed.',
  offerTitle: 'Offer a Flower',
  hintPrayMine:
    'A few minutes of remembrance on this device bring forth lotus flowers for memory and merit.',
  hintKeepScreen:
    'Keep the app open while you pray so the flower offering can continue.',
  howTitle: 'How does wLotus work?',
  howPrayTitle: '',
  howPrayBody:
    'Your phone searches for a digital WLOTUS. Keep the app open and in the foreground so the search can continue. Use that time to remember someone who has passed. You can stop the search anytime.',
  howMintTitle: '',
  howMintBody:
    'Finding WLOTUS yields 108 digital lotuses — one full mala round. Depending on your device, this may take from about two minutes to over ten minutes. One lotus is offered in remembrance of the departed. The other 107 go to the wLotus developers.',
  howWhyTitle: 'Why do 107 flowers go to the wLotus developers?',
  howWhyBody:
    'Issuing and offering each lotus incurs network fees. Searching on a phone also yields only a limited number of flowers. So those with a sincere heart can still receive lotuses for remembrance — and so professional mining rigs do not crowd out phone users — the remaining 107 beads of the mala go to the wLotus developers to distribute to those with affinity who did not get a chance to find a lotus.',
  howEternalTitle: '',
  howEternalBody:
    'Each offering is recorded forever on the blockchain — a mark of lasting reverence.',
  etaEstimated: 'Estimated time {eta}',
  noteLabel: 'Words of remembrance…',
  notePlaceholder: 'Name, dedication, or paste a wLotus link',
  btnOffer: 'Offer a Flower',
  btnPraying: 'Finding a lotus…',
  btnOffering: 'Offering…',
  btnCancel: 'Cancel',
  miningElapsed: '{elapsed}',
  connecting: 'Connecting…',
  apiOffline:
    'Mint API offline — start mint-api on Contabo and proxy /api → :8787',
  leftToday: '{n} left today on this device',
  miningCancelled: 'Search cancelled.',
  memorialCancelled:
    'Memorial cancelled — lotus was minted; dedication burn skipped.',
  miningOnNewTip: 'Searching on a new tip',
  offeredIn: 'Offered in {duration}',
  recentTitle: 'Recent',
  reofferHint: 'Re-offer a lotus from your recent list.',
  reofferBadge: 're-offer',
  burnTotal: '{n} burns',
  latestBurnLink: 'Latest burn',
  btnReoffer: 'Re-offer',
  offeringFallback: 'Offering',
  offerSessionTitle: 'Offering a flower',
  reofferSessionTitle: 'Offer a lotus for:',
  sessionNoteLabel: 'In remembrance',
  reofferExtraNoteLabel: 'Words of remembrance',
  reofferExtraNotePlaceholder: 'Optional…',
  btnOfferLotus: 'Offer a lotus',
  btnClose: 'Close',
  shareHint: 'Paste a wLotus link to continue that dedication.',
  shareLookingUp: 'Looking up dedication…',
  shareLinked: 'Linked · {name}',
  shareLookupFailed: 'Could not find that dedication on-chain.',
  btnShare: 'Share',
  shareCopied: 'Link copied',
  footerBrand: 'White Lotus',
};

const vi: Dict = {
  brand: 'White Lotus',
  tagline: 'Dâng một đóa sen vĩnh hằng tưởng nhớ người đã khuất.',
  offerTitle: 'Dâng Hoa',
  hintPrayMine:
    'Một vài phút tưởng niệm trên máy sẽ sản sinh ra hoa sen để tưởng nhớ và công đức.',
  hintKeepScreen:
    'Giữ ứng dụng luôn mở để quá trình tìm kiếm và dâng hoa được tiếp tục.',
  howTitle: 'wLotus hoạt động như thế nào?',
  howPrayTitle: '',
  howPrayBody:
    'Điện thoại được dùng để tìm ra bông sen số WLOTUS. Bạn phải bật ứng dụng liên tục và không sử dụng ứng dụng khác để quá trình tìm kiếm bông sen số được tiếp tục. Trong lúc này, bạn có thể tưởng nhớ về người đã khuất. Bạn có thể dừng quá trình tìm kiếm này bất cứ lúc nào.',
  howMintTitle: '',
  howMintBody:
    'Quá trình tìm kiếm WLOTUS sẽ sinh ra 108 đóa sen số — một vòng tràng hạt. Tùy theo năng lực của máy, quá trình này có thể từ khoảng 2 phút đến trên 10 phút. 1 bông sen sẽ được dùng để dâng lên tưởng niệm cho người đã khuất. 107 bông còn lại được chuyển đến nhà phát triển wLotus.',
  howWhyTitle: 'Tại sao 107 bông được chuyển đến nhà phát triển wLotus?',
  howWhyBody:
    'Mỗi lần phát hành và dâng hoa sen đều tốn phí giao dịch trên mạng. Việc tìm kiếm trên thiết bị cũng chỉ cho phép tìm được một số lượng hoa sen có hạn. Để những người hữu tâm vẫn có hoa sen tỏ lòng tưởng nhớ, và để tránh các máy chuyên nghiệp làm ảnh hưởng đến việc dùng trên điện thoại, 107 hạt còn lại của vòng tràng được gửi cho nhà phát triển wLotus để phân phối tới những người hữu duyên không có cơ may tìm kiếm được hoa sen.',
  howEternalTitle: '',
  howEternalBody:
    'Mỗi lần dâng sen được ghi lại mãi mãi trên chuỗi khối, đánh dấu cho lòng thành kính vĩnh hằng.',
  etaEstimated: 'Thời gian ước tính {eta}',
  noteLabel: 'Lời tưởng niệm...',
  notePlaceholder: 'Tên, lời tưởng niệm, hoặc dán liên kết wLotus',
  btnOffer: 'Dâng Hoa',
  btnPraying: 'Đang tìm hoa sen…',
  btnOffering: 'Đang dâng hoa…',
  btnCancel: 'Hủy',
  miningElapsed: '{elapsed}',
  connecting: 'Đang kết nối…',
  apiOffline: 'API mint ngoại tuyến — kiểm tra mint-api trên Contabo.',
  leftToday: 'Còn {n} lần hôm nay trên thiết bị này',
  miningCancelled: 'Đã hủy tìm kiếm.',
  memorialCancelled:
    'Đã hủy tưởng niệm — sen đã được mint; chưa đốt dâng.',
  miningOnNewTip: 'Tìm kiếm trên tip mới',
  offeredIn: 'Đã dâng hoa trong {duration}',
  recentTitle: 'Gần đây',
  reofferHint: 'Dâng lại hoa sen theo danh sách gần nhất.',
  reofferBadge: 'dâng lại',
  burnTotal: '{n} lần dâng',
  latestBurnLink: 'Lần dâng gần nhất',
  btnReoffer: 'Dâng lại',
  offeringFallback: 'Lần dâng hoa',
  offerSessionTitle: 'Đang dâng hoa',
  reofferSessionTitle: 'Dâng hoa sen cho:',
  sessionNoteLabel: 'Lời tưởng niệm',
  reofferExtraNoteLabel: 'Lời tưởng niệm',
  reofferExtraNotePlaceholder: 'Tuỳ chọn…',
  btnOfferLotus: 'Dâng hoa sen',
  btnClose: 'Đóng',
  shareHint: 'Dán liên kết wLotus để tiếp tục lời tưởng niệm đó.',
  shareLookingUp: 'Đang tìm lời tưởng niệm…',
  shareLinked: 'Đã liên kết · {name}',
  shareLookupFailed: 'Không tìm thấy lời tưởng niệm trên chuỗi.',
  btnShare: 'Chia sẻ',
  shareCopied: 'Đã sao chép liên kết',
  footerBrand: 'White Lotus',
};

const zh: Dict = {
  brand: 'White Lotus',
  tagline: '献上一朵永恒莲花，纪念逝去的亲人。',
  offerTitle: '献花',
  hintPrayMine:
    '在本机上花几分钟追思，即可生出莲花，用于功德与纪念。',
  hintKeepScreen:
    '祈祷时请保持应用常开，以便献花过程得以继续。',
  howTitle: 'wLotus 如何运作？',
  howPrayTitle: '',
  howPrayBody:
    '手机用于寻找数字莲花 WLOTUS。请保持应用持续开启，且不要切换到其他应用，以便寻找过程继续。在此期间，您可以追思逝去的亲人。您可以随时停止寻找。',
  howMintTitle: '',
  howMintBody:
    '寻找 WLOTUS 会生出 108 朵数字莲花——一整圈念珠。视设备性能，大约需要 2 分钟到 10 分钟以上。其中 1 朵用于献上，纪念逝者；其余 107 朵交给 wLotus 开发者。',
  howWhyTitle: '为何 107 朵莲花交给 wLotus 开发者？',
  howWhyBody:
    '每次发行与献上莲花都需支付网络手续费。本机寻找所能得到的莲花数量也有限。为让有心之人仍能取得莲花以表追思，并避免专业矿机挤占手机用户，念珠上其余 107 颗交给 wLotus 开发者，分发给有缘却未能寻得莲花的人。',
  howEternalTitle: '',
  howEternalBody:
    '每一次献花都会永久记在区块链上，铭刻一份永恒的敬意。',
  etaEstimated: '预计时间 {eta}',
  noteLabel: '追思寄语…',
  notePlaceholder: '姓名、寄语，或粘贴 wLotus 链接',
  btnOffer: '献花',
  btnPraying: '正在寻找莲花…',
  btnOffering: '正在献花…',
  btnCancel: '取消',
  miningElapsed: '{elapsed}',
  connecting: '连接中…',
  apiOffline: '铸造服务离线 — 请检查 Contabo 上的 mint-api。',
  leftToday: '本设备今日剩余 {n} 次',
  miningCancelled: '已取消寻找。',
  memorialCancelled: '已取消献念——莲花已铸造；未完成燃烧献上。',
  miningOnNewTip: '在新 tip 上继续寻找',
  offeredIn: '献花完成 · {duration}',
  recentTitle: '最近',
  reofferHint: '从最近列表再次献上莲花。',
  reofferBadge: '再献',
  burnTotal: '{n} 次献花',
  latestBurnLink: '最近一次献花',
  btnReoffer: '再献',
  offeringFallback: '献花',
  offerSessionTitle: '正在献花',
  reofferSessionTitle: '为TA献上莲花：',
  sessionNoteLabel: '追思寄语',
  reofferExtraNoteLabel: '追思寄语',
  reofferExtraNotePlaceholder: '可选…',
  btnOfferLotus: '献上莲花',
  btnClose: '关闭',
  shareHint: '粘贴 wLotus 链接以继续该追思。',
  shareLookingUp: '正在查找追思…',
  shareLinked: '已关联 · {name}',
  shareLookupFailed: '链上未找到该追思。',
  btnShare: '分享',
  shareCopied: '链接已复制',
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
