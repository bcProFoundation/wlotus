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
  | 'btnAltarMore'
  | 'btnAltarEdit'
  | 'btnAltarDelete'
  | 'altarLabel'
  | 'altarTitle'
  | 'altarHint'
  | 'altarHonorific'
  | 'altarHonorificMr'
  | 'altarHonorificMrs'
  | 'altarName'
  | 'altarNamePlaceholder'
  | 'altarNote'
  | 'altarNotePlaceholder'
  | 'altarBirthPlace'
  | 'altarBirthYear'
  | 'altarBirthYearPlaceholder'
  | 'altarBirthDate'
  | 'altarBirthDatePlaceholder'
  | 'altarErrBirthDate'
  | 'altarDeathDate'
  | 'altarDeathDatePlaceholder'
  | 'altarDeathPlace'
  | 'altarFuneralPlace'
  | 'altarPlaceOptional'
  | 'altarErrName'
  | 'altarErrDeathDate'
  | 'altarErrBirthYear'
  | 'btnAltarSave'
  | 'btnAltarNext'
  | 'btnAltarClear'
  | 'altarDetailTitle'
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
  | 'openOnExplorer'
  | 'btnReoffer'
  | 'btnHistory'
  | 'historyTitle'
  | 'historyLoading'
  | 'latestMemorialFallback'
  | 'offeringFallback'
  | 'offerSessionTitle'
  | 'reofferSessionTitle'
  | 'sessionNoteLabel'
  | 'reofferExtraNoteLabel'
  | 'reofferExtraNotePlaceholder'
  | 'btnOfferLotus'
  | 'btnClose'
  | 'cancelOfferMsg'
  | 'cancelLoseOfferMsg'
  | 'btnConfirmCancel'
  | 'btnConfirmLoseOffer'
  | 'btnKeepOffering'
  | 'shareHint'
  | 'shareLookingUp'
  | 'shareLinked'
  | 'shareLookupFailed'
  | 'btnShare'
  | 'shareCopied'
  | 'openInBrowserTitle'
  | 'openInBrowserBody'
  | 'openInBrowserHint'
  | 'openInBrowserCta'
  | 'openInBrowserExternal'
  | 'openInBrowserCopy'
  | 'openInBrowserCopied'
  | 'openInBrowserRedirecting'
  | 'historyIndexUnavailable'
  | 'lastOfferedAt'
  | 'latestMessageLabel'
  | 'btnRemoveRecent'
  | 'btnSwipeOpen'
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
  btnAltarMore: 'More',
  btnAltarEdit: 'Edit',
  btnAltarDelete: 'Delete',
  altarLabel: 'Altar',
  altarTitle: 'Altar',
  altarHint:
    'These fields are written on-chain with the dedication. Places are plain text for now.',
  altarHonorific: 'Title',
  altarHonorificMr: 'Mr.',
  altarHonorificMrs: 'Mrs.',
  altarName: 'Name',
  altarNamePlaceholder: 'Name of the departed',
  altarNote: 'Words of remembrance',
  altarNotePlaceholder: 'Optional short message',
  altarBirthPlace: 'Hometown',
  altarBirthYear: 'Year of birth',
  altarBirthYearPlaceholder: 'YYYY or YYYY-MM-DD',
  altarBirthDate: 'Year of birth',
  altarBirthDatePlaceholder: 'YYYY or YYYY-MM-DD',
  altarErrBirthDate: 'Enter year of birth as YYYY or YYYY-MM-DD.',
  altarDeathDate: 'Date of death',
  altarDeathDatePlaceholder: 'YYYY or YYYY-MM-DD',
  altarDeathPlace: 'Place of residence',
  altarFuneralPlace: 'Burial place',
  altarPlaceOptional: 'Optional',
  altarErrName: 'Name is required.',
  altarErrDeathDate: 'Enter date of death as YYYY or YYYY-MM-DD.',
  altarErrBirthYear: 'Enter year of birth as YYYY or YYYY-MM-DD.',
  btnAltarSave: 'Save',
  btnAltarNext: 'Next',
  btnAltarClear: 'Clear',
  altarDetailTitle: 'Altar',
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
  offeredIn: 'Flower offered successfully in {duration} for {name}',
  recentTitle: 'Recent',
  reofferHint:
    'Re-offer a lotus from your recent list. Swipe left for history, explorer, or delete on this device.',
  reofferBadge: 're-offer',
  burnTotal: '{n} burns',
  latestBurnLink: 'Latest burn',
  openOnExplorer: 'Open on explorer',
  btnReoffer: 'Re-offer',
  btnHistory: 'History',
  historyTitle: 'Memorial history',
  historyLoading: 'Loading…',
  latestMemorialFallback: 'Re-offered',
  offeringFallback: 'Offering',
  offerSessionTitle: 'Offering a flower',
  reofferSessionTitle: 'Offer a lotus for:',
  sessionNoteLabel: 'In remembrance',
  reofferExtraNoteLabel: 'Words of remembrance',
  reofferExtraNotePlaceholder: 'Optional…',
  btnOfferLotus: 'Offer a lotus',
  btnClose: 'Close',
  cancelOfferMsg: 'Stop this offering and return to the home screen?',
  cancelLoseOfferMsg:
    'The lotus is already minted. Cancelling now skips the memorial burn and uses up this offer turn.',
  btnConfirmCancel: 'Yes, cancel',
  btnConfirmLoseOffer: 'Cancel and lose turn',
  btnKeepOffering: 'Continue offering',
  shareHint: 'Paste a wLotus link to continue that dedication.',
  shareLookingUp: 'Looking up dedication…',
  shareLinked: 'Linked · {name}',
  shareLookupFailed: 'Could not find that dedication on-chain.',
  btnShare: 'Share',
  shareCopied: 'Link copied',
  openInBrowserTitle: 'Continue in {app}',
  openInBrowserBody:
    'You can offer a flower here in {app}. Offering history may stay in this app only (not shared with Safari or Chrome).',
  openInBrowserHint:
    'To use Safari or Chrome instead: tap ⋯ / More → Open in browser (or Open in Safari / Chrome).',
  openInBrowserCta: 'Continue in {app}',
  openInBrowserExternal: 'Try opening in browser',
  openInBrowserCopy: 'Copy link',
  openInBrowserCopied: 'Link copied',
  openInBrowserRedirecting: 'Opening…',
  historyIndexUnavailable:
    'Could not reach the memorial index — showing what this device has. On Contabo, proxy /index-api/ → dana-index :8788.',
  lastOfferedAt: 'Last offered: {when}',
  latestMessageLabel: 'Message: {msg}',
  btnRemoveRecent: 'Delete',
  btnSwipeOpen: 'Open',
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
  btnAltarMore: 'Thêm',
  btnAltarEdit: 'Sửa',
  btnAltarDelete: 'Xoá',
  altarLabel: 'Ban thờ',
  altarTitle: 'Ban thờ',
  altarHint:
    'Các trường này được ghi trên chuỗi cùng lần dâng. Địa danh dùng chữ thường trước.',
  altarHonorific: 'Danh xưng',
  altarHonorificMr: 'Ông',
  altarHonorificMrs: 'Bà',
  altarName: 'Họ tên',
  altarNamePlaceholder: 'Tên người đã khuất',
  altarNote: 'Lời tưởng niệm',
  altarNotePlaceholder: 'Tuỳ chọn — lời ngắn',
  altarBirthPlace: 'Quê quán',
  altarBirthYear: 'Năm sinh',
  altarBirthYearPlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarBirthDate: 'Năm sinh',
  altarBirthDatePlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarErrBirthDate: 'Năm sinh dạng YYYY hoặc YYYY-MM-DD.',
  altarDeathDate: 'Ngày mất',
  altarDeathDatePlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarDeathPlace: 'Nơi sinh sống',
  altarFuneralPlace: 'Nơi an táng',
  altarPlaceOptional: 'Tuỳ chọn',
  altarErrName: 'Cần nhập họ tên.',
  altarErrDeathDate: 'Ngày mất dạng YYYY hoặc YYYY-MM-DD.',
  altarErrBirthYear: 'Năm sinh dạng YYYY hoặc YYYY-MM-DD.',
  btnAltarSave: 'Lưu',
  btnAltarNext: 'Tiếp',
  btnAltarClear: 'Xoá',
  altarDetailTitle: 'Ban thờ',
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
  offeredIn: 'Đã dâng hoa thành công trong {duration} cho {name}',
  recentTitle: 'Gần đây',
  reofferHint:
    'Dâng lại hoa sen theo danh sách gần nhất. Vuốt sang trái để xem lịch sử, mở explorer, hoặc xóa khỏi máy này.',
  reofferBadge: 'dâng lại',
  burnTotal: '{n} lần dâng',
  latestBurnLink: 'Lần dâng gần nhất',
  openOnExplorer: 'Mở trên explorer',
  btnReoffer: 'Dâng lại',
  btnHistory: 'Lịch sử',
  historyTitle: 'Lịch sử tưởng niệm',
  historyLoading: 'Đang tải…',
  latestMemorialFallback: 'Đã dâng lại',
  offeringFallback: 'Lần dâng hoa',
  offerSessionTitle: 'Đang dâng hoa',
  reofferSessionTitle: 'Dâng hoa sen cho:',
  sessionNoteLabel: 'Lời tưởng niệm',
  reofferExtraNoteLabel: 'Lời tưởng niệm',
  reofferExtraNotePlaceholder: 'Tuỳ chọn…',
  btnOfferLotus: 'Dâng hoa sen',
  btnClose: 'Đóng',
  cancelOfferMsg: 'Dừng dâng hoa và quay lại màn hình chính?',
  cancelLoseOfferMsg:
    'Hoa sen đã được tạo. Hủy lúc này sẽ bỏ qua bước dâng và bạn mất lượt dâng hoa.',
  btnConfirmCancel: 'Đồng ý hủy',
  btnConfirmLoseOffer: 'Hủy và mất lượt',
  btnKeepOffering: 'Tiếp tục dâng',
  shareHint: 'Dán liên kết wLotus để tiếp tục lời tưởng niệm đó.',
  shareLookingUp: 'Đang tìm lời tưởng niệm…',
  shareLinked: 'Đã liên kết · {name}',
  shareLookupFailed: 'Không tìm thấy lời tưởng niệm trên chuỗi.',
  btnShare: 'Chia sẻ',
  shareCopied: 'Đã sao chép liên kết',
  openInBrowserTitle: 'Tiếp tục trên {app}',
  openInBrowserBody:
    'Bạn có thể dâng hoa ngay trong {app}. Lịch sử dâng hoa có thể chỉ lưu trong ứng dụng này (không dùng chung với Safari/Chrome).',
  openInBrowserHint:
    'Muốn dùng Safari/Chrome: chạm ⋯ / Thêm → Mở bằng trình duyệt (hoặc Mở bằng Safari / Chrome).',
  openInBrowserCta: 'Tiếp tục trên {app}',
  openInBrowserExternal: 'Thử mở bằng trình duyệt',
  openInBrowserCopy: 'Sao chép liên kết',
  openInBrowserCopied: 'Đã sao chép liên kết',
  openInBrowserRedirecting: 'Đang mở…',
  historyIndexUnavailable:
    'Không kết nối được mục lục tưởng niệm — đang hiện dữ liệu trên máy này. Trên Contabo, proxy /index-api/ → dana-index :8788.',
  lastOfferedAt: 'Lần gần nhất: {when}',
  latestMessageLabel: 'Lời tưởng niệm: {msg}',
  btnRemoveRecent: 'Xóa',
  btnSwipeOpen: 'Mở',
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
  btnAltarMore: '更多',
  btnAltarEdit: '编辑',
  btnAltarDelete: '删除',
  altarLabel: '灵位',
  altarTitle: '灵位',
  altarHint: '这些字段将随献花一并写入链上。地点暂用文字描述。',
  altarHonorific: '称谓',
  altarHonorificMr: '先生',
  altarHonorificMrs: '女士',
  altarName: '姓名',
  altarNamePlaceholder: '逝者姓名',
  altarNote: '追思寄语',
  altarNotePlaceholder: '可选短句',
  altarBirthPlace: '籍贯',
  altarBirthYear: '出生年',
  altarBirthYearPlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarBirthDate: '出生年',
  altarBirthDatePlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarErrBirthDate: '出生年请用 YYYY 或 YYYY-MM-DD。',
  altarDeathDate: '去世日期',
  altarDeathDatePlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarDeathPlace: '居住地',
  altarFuneralPlace: '安葬地',
  altarPlaceOptional: '可选',
  altarErrName: '请填写姓名。',
  altarErrDeathDate: '去世日期请用 YYYY 或 YYYY-MM-DD。',
  altarErrBirthYear: '出生年请用 YYYY 或 YYYY-MM-DD。',
  btnAltarSave: '保存',
  btnAltarNext: '下一步',
  btnAltarClear: '清除',
  altarDetailTitle: '灵位',
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
  offeredIn: '献花成功，用时 {duration}，献给 {name}',
  recentTitle: '最近',
  reofferHint:
    '从最近列表再次献上莲花。向左滑动可查看历史、打开浏览器，或从本机删除。',
  reofferBadge: '再献',
  burnTotal: '{n} 次献花',
  latestBurnLink: '最近一次献花',
  openOnExplorer: '在浏览器打开',
  btnReoffer: '再献',
  btnHistory: '历史',
  historyTitle: '追思历史',
  historyLoading: '加载中…',
  latestMemorialFallback: '再次献花',
  offeringFallback: '献花',
  offerSessionTitle: '正在献花',
  reofferSessionTitle: '为TA献上莲花：',
  sessionNoteLabel: '追思寄语',
  reofferExtraNoteLabel: '追思寄语',
  reofferExtraNotePlaceholder: '可选…',
  btnOfferLotus: '献上莲花',
  btnClose: '关闭',
  cancelOfferMsg: '停止献花并返回主页？',
  cancelLoseOfferMsg:
    '莲花已铸造。现在取消将跳过献念，并消耗本次献花名额。',
  btnConfirmCancel: '确认取消',
  btnConfirmLoseOffer: '取消并失去名额',
  btnKeepOffering: '继续献花',
  shareHint: '粘贴 wLotus 链接以继续该追思。',
  shareLookingUp: '正在查找追思…',
  shareLinked: '已关联 · {name}',
  shareLookupFailed: '链上未找到该追思。',
  btnShare: '分享',
  shareCopied: '链接已复制',
  openInBrowserTitle: '在{app}中继续',
  openInBrowserBody:
    '您可以在{app}内直接献花。献花记录可能只保存在此应用中（不与 Safari / Chrome 共用）。',
  openInBrowserHint: '若要用 Safari / Chrome：点 ⋯ / 更多 → 在浏览器中打开。',
  openInBrowserCta: '在{app}中继续',
  openInBrowserExternal: '尝试在浏览器中打开',
  openInBrowserCopy: '复制链接',
  openInBrowserCopied: '链接已复制',
  openInBrowserRedirecting: '正在打开…',
  historyIndexUnavailable:
    '无法连接追思索引 — 显示本机记录。请在 Contabo 将 /index-api/ 代理到 dana-index :8788。',
  lastOfferedAt: '最近一次: {when}',
  latestMessageLabel: '寄语: {msg}',
  btnRemoveRecent: '删除',
  btnSwipeOpen: '打开',
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
