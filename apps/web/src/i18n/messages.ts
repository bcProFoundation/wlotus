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
  tagline: 'Offer a white lotus. Remember someone. Give something up for all.',
  offerTitle: 'Offer',
  hintPrayMine:
    'Pray on this device while it mines {ticker}, then burn the presence atom — memorial and dana on-chain. Limited to {max} offerings per day here.',
  hintKeepScreen:
    'Keep this screen on while you pray. Leaving the app or locking the phone pauses the offering (iPhone and Android).',
  howTitle: 'How an offering works',
  howPrayTitle: 'Pray while mining.',
  howPrayBody:
    'Your phone does the work; use that time for the person you remember. You can stop mining anytime — your prayer is always yours.',
  howMintTitle: 'Mint 100 {ticker}.',
  howMintBody:
    '1 stays as your presence atom; 99 go to WLotus.org to cover network fees for mint and burn.',
  howBurnTitle: 'Burn the 1.',
  howBurnBody:
    'The on-chain burn is your gift — memorial and dana offered for all.',
  etaEstimated: '{eta} estimated',
  noteLabel: 'In memory of… (optional)',
  notePlaceholder: 'Name or dedication',
  btnOffer: 'Offer',
  btnPreparing: 'Preparing…',
  btnPraying: 'PRAYING…',
  btnOffering: 'Offering…',
  btnCancel: 'Cancel',
  miningElapsed: 'Mining · {elapsed}',
  connecting: 'Connecting…',
  apiOffline:
    'Mint API offline — start mint-api on Contabo and proxy /api → :8787',
  leftToday: '{n} left today on this device',
  miningCancelled: 'Mining cancelled.',
  miningOnNewTip: 'Mining on new tip',
  offeredIn: 'Offered in {duration}',
  recentTitle: 'Recent',
  offeringFallback: 'Offering',
  footerBrand: 'White Lotus',
};

const vi: Dict = {
  brand: 'White Lotus',
  tagline:
    'Dâng một đóa sen trắng. Tưởng nhớ người đã khuất. Hy sinh vì tất cả.',
  offerTitle: 'Dâng',
  hintPrayMine:
    'Cầu nguyện trên máy này trong lúc đào {ticker}, rồi đốt hạt hiện diện — tưởng niệm và bố thí trên chuỗi. Giới hạn {max} lần mỗi ngày trên thiết bị này.',
  hintKeepScreen:
    'Giữ màn hình sáng khi cầu nguyện. Thoát ứng dụng hoặc khóa máy sẽ tạm dừng (iPhone và Android).',
  howTitle: 'Cách một lần dâng hoạt động',
  howPrayTitle: 'Cầu nguyện trong lúc đào.',
  howPrayBody:
    'Điện thoại làm công việc kỹ thuật; bạn dùng thời gian đó cho người mình tưởng nhớ. Bạn có thể dừng đào bất cứ lúc nào — lời cầu nguyện vẫn thuộc về bạn.',
  howMintTitle: 'Đúc 100 {ticker}.',
  howMintBody:
    '1 hạt hiện diện thuộc về bạn; 99 gửi tới WLotus.org để trả phí mạng cho đúc và đốt.',
  howBurnTitle: 'Đốt hạt 1.',
  howBurnBody:
    'Đốt trên chuỗi chính là món quà — tưởng niệm và bố thí dâng lên cho tất cả.',
  etaEstimated: 'ước tính {eta}',
  noteLabel: 'Tưởng nhớ… (tuỳ chọn)',
  notePlaceholder: 'Tên hoặc lời tưởng niệm',
  btnOffer: 'Dâng',
  btnPreparing: 'Đang chuẩn bị…',
  btnPraying: 'ĐANG CẦU NGUYỆN…',
  btnOffering: 'Đang dâng…',
  btnCancel: 'Hủy',
  miningElapsed: 'Đào · {elapsed}',
  connecting: 'Đang kết nối…',
  apiOffline: 'API mint ngoại tuyến — kiểm tra mint-api trên Contabo.',
  leftToday: 'Còn {n} lần hôm nay trên thiết bị này',
  miningCancelled: 'Đã hủy đào.',
  miningOnNewTip: 'Đào trên tip mới',
  offeredIn: 'Đã dâng trong {duration}',
  recentTitle: 'Gần đây',
  offeringFallback: 'Lần dâng',
  footerBrand: 'White Lotus',
};

const zh: Dict = {
  brand: 'White Lotus',
  tagline: '献上一朵白莲。纪念所爱之人。为众生舍出一份。',
  offerTitle: '供奉',
  hintPrayMine:
    '在本机祈祷并同时挖出 {ticker}，再燃烧那枚临在代币——链上纪念与布施。本设备每天限 {max} 次。',
  hintKeepScreen:
    '祈祷时请保持屏幕开启。离开应用或锁屏会暂停（iPhone 与 Android）。',
  howTitle: '一次供奉如何进行',
  howPrayTitle: '边挖边祈祷。',
  howPrayBody:
    '手机完成计算；请把这段时间留给你要纪念的人。你可以随时停止挖矿——祈祷始终属于你。',
  howMintTitle: '铸造 100 {ticker}。',
  howMintBody:
    '1 枚留作你的临在；99 枚归 WLotus.org，用于支付铸造与燃烧的网络手续费。',
  howBurnTitle: '燃烧那 1 枚。',
  howBurnBody:
    '链上燃烧即是供奉——纪念与布施由此献给众生。',
  etaEstimated: '预计 {eta}',
  noteLabel: '纪念……（可选）',
  notePlaceholder: '姓名或寄语',
  btnOffer: '供奉',
  btnPreparing: '准备中…',
  btnPraying: '祈祷中…',
  btnOffering: '提交中…',
  btnCancel: '取消',
  miningElapsed: '挖矿 · {elapsed}',
  connecting: '连接中…',
  apiOffline: '铸造服务离线 — 请检查 Contabo 上的 mint-api。',
  leftToday: '本设备今日剩余 {n} 次',
  miningCancelled: '已取消挖矿。',
  miningOnNewTip: '正在新 tip 上挖矿',
  offeredIn: '供奉完成 · {duration}',
  recentTitle: '最近',
  offeringFallback: '供奉',
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
