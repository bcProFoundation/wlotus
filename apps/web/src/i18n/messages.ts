import type { Locale } from './types.js';

/** Flat UI strings. Use `{name}` placeholders. */
export type MessageKey =
  | 'brand'
  /** Wordmark next to the W logo — omit the leading W (it is in the mark). */
  | 'brandWithLogo'
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
  | 'howEcashTitle'
  | 'howEcashBody'
  | 'etaEstimated'
  | 'btnAltarEdit'
  | 'btnAltarDelete'
  | 'btnAltarMore'
  | 'altarLabel'
  | 'profileLabel'
  | 'altarTitle'
  | 'profileTitle'
  | 'altarHint'
  | 'profileHint'
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
  | 'altarDeathDateLunar'
  | 'altarDeathDateSolar'
  | 'altarEventDate'
  | 'altarEventDateLunar'
  | 'altarEventDateSolar'
  | 'altarDeathDatePlaceholder'
  | 'altarCalLunar'
  | 'altarCalSolar'
  | 'altarDeathPlace'
  | 'altarFuneralPlace'
  | 'altarPlaceOptional'
  | 'altarRelationship'
  | 'altarRelationshipTitle'
  | 'altarRelationshipHint'
  | 'altarExistingRelationships'
  | 'altarParentMaxHint'
  | 'altarErrParentMax'
  | 'altarErrDuplicateRel'
  | 'altarRelationshipNone'
  | 'altarRelationshipSpouse'
  | 'altarRelationshipParent'
  | 'altarRelationshipChild'
  | 'altarRelatedTxidLabel'
  | 'altarRelatedTxidPlaceholder'
  | 'altarNoRecentForRelationship'
  | 'altarErrRelatedTxid'
  | 'altarViewRelated'
  | 'altarErrName'
  | 'altarErrDeathDate'
  | 'altarErrBirthYear'
  | 'altarErrOpreturn'
  | 'btnAltarSave'
  | 'btnAltarNext'
  | 'btnAltarClear'
  | 'altarDetailTitle'
  | 'profileDetailTitle'
  | 'btnOffer'
  | 'btnSetup'
  | 'btnSettingUp'
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
  | 'setupDoneIn'
  | 'recentTitle'
  | 'reofferHint'
  | 'originalBurnBadge'
  | 'burnTotal'
  | 'activityTotal'
  | 'latestBurnLink'
  | 'openOnExplorer'
  | 'btnReoffer'
  | 'btnHistory'
  | 'historyTitle'
  | 'historyActivityTitle'
  | 'historyLoading'
  | 'offeringFallback'
  | 'offerSessionTitle'
  | 'setupSessionTitle'
  | 'reofferSessionTitle'
  | 'sessionNoteLabel'
  | 'reofferExtraNoteLabel'
  | 'reofferExtraNotePlaceholder'
  | 'btnAmendAltar'
  | 'amendRelationshipCreatorOnly'
  | 'firstOfferDeathTitle'
  | 'firstOfferDeathHint'
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
  | 'footerBrand'
  | 'searchTitle'
  | 'searchPlaceholder'
  | 'searchHintPrefix'
  | 'searchAddNew'
  | 'searchHintSuffix'
  | 'searchCta'
  | 'homeEventsTitle'
  | 'homeEventsOfferings'
  | 'homeEventsDaysUntil'
  | 'homeEventsToday'
  | 'homeEventsOngoing'
  | 'homeEventsDaysPast'
  | 'searchLoading'
  | 'searchNoResults'
  | 'searchIndexUnavailable'
  | 'btnCung'
  | 'cungSessionTitle'
  | 'vuLanSessionTitle'
  | 'specialStoryHeading'
  | 'specialStoryHint';

type Dict = Record<MessageKey, string>;

const en: Dict = {
  brand: 'W Lotus',
  brandWithLogo: 'Lotus',
  tagline: 'A flower of eternal remembrance.',
  offerTitle: 'Offer a Flower',
  hintPrayMine:
    'A few minutes of remembrance on this device bring forth lotus flowers for memory and merit.',
  hintKeepScreen:
    'Keep the app open while you pray so the flower offering can continue.',
  howTitle: 'How does W Lotus work?',
  howPrayTitle: '',
  howPrayBody:
    'Your phone searches for a digital WLOTUS. Keep the app open and in the foreground so the search can continue. Use that time to remember someone who has passed. You can stop the search anytime.',
  howMintTitle: '',
  howMintBody:
    'Finding WLOTUS yields 108 digital lotuses — one full mala. Depending on your device, this may take from about two minutes to over ten minutes. One lotus is burned as the flower offering. Most of the rest stay with the miner (or the W Lotus desk when fees are sponsored); a small share of 6 goes to the temple.',
  howWhyTitle: 'Why do 6 flowers go to the temple?',
  howWhyBody:
    'Issuing each lotus incurs network fees. When W Lotus sponsors those fees for mobile offerings, the desk receives the miner share, burns 1 lotus for your memorial, and keeps the rest as inventory to share with others. An independent miner who pays their own fees keeps 102 of 108 lotuses; only 6 go to the temple as a light issuer tax.',
  howEternalTitle: '',
  howEternalBody:
    'Each offering is recorded forever on the blockchain — a mark of lasting reverence.',
  howEcashTitle: 'Why eCash?',
  howEcashBody:
    'eCash is a blockchain network since 2009 — established, with very low fees and fast confirmation, well suited to record each W Lotus flower offering.',
  etaEstimated: 'Estimated time {eta}',
  btnAltarMore: 'More',
  btnAltarEdit: 'Edit',
  btnAltarDelete: 'Delete',
  altarLabel: 'Altar',
  profileLabel: 'Profile',
  altarTitle: 'Altar',
  profileTitle: 'Profile',
  altarHint:
    'Create a memorial on-chain. Date of death is optional at setup — living profiles use Profile until the creator offers a flower with a death date.',
  profileHint:
    'Create a living profile on-chain. Flower offerings unlock after you (the creator) offer a flower with a date of death.',
  altarHonorific: 'Title',
  altarHonorificMr: 'Mr.',
  altarHonorificMrs: 'Mrs.',
  altarName: 'Name',
  altarNamePlaceholder: 'Full name',
  altarNote: 'Words of remembrance',
  altarNotePlaceholder: 'Optional short message',
  altarBirthPlace: 'Hometown',
  altarBirthYear: 'Year of birth',
  altarBirthYearPlaceholder: 'YYYY or YYYY-MM-DD',
  altarBirthDate: 'Date of birth (YYYY-MM-DD)',
  altarBirthDatePlaceholder: 'YYYY or YYYY-MM-DD',
  altarErrBirthDate: 'Enter year of birth as YYYY or YYYY-MM-DD.',
  altarDeathDate: 'Date of death',
  altarDeathDateLunar: 'Date of death (lunar)',
  altarDeathDateSolar: 'Date of death (solar)',
  altarEventDate: 'Festival day',
  altarEventDateLunar: 'Festival day (lunar)',
  altarEventDateSolar: 'Festival day (solar)',
  altarDeathDatePlaceholder: 'YYYY or YYYY-MM-DD',
  altarCalLunar: 'Lunar',
  altarCalSolar: 'Solar',
  altarDeathPlace: 'Place of residence',
  altarFuneralPlace: 'Burial place',
  altarPlaceOptional: 'Optional',
  altarRelationship: 'Relationship',
  altarRelationshipTitle: 'Relationship',
  altarRelationshipHint:
    'Link this altar to another in Recent. The original Ban thờ details stay on the first burn — this only adds the relationship.',
  altarExistingRelationships: 'Current relationships',
  altarParentMaxHint: 'At most {n} parents (Cha/mẹ) — add-only for now.',
  altarErrParentMax: 'Already has {n} parent links.',
  altarErrDuplicateRel: 'That relationship is already linked.',
  altarRelationshipNone: 'None',
  altarRelationshipSpouse: 'Spouse',
  altarRelationshipParent: 'Parent',
  altarRelationshipChild: 'Child',
  altarRelatedTxidLabel: 'Linked altar (from your Recent list)',
  altarRelatedTxidPlaceholder: 'Choose from Recent…',
  altarNoRecentForRelationship:
    'Offer to someone in Recent first to link a relationship.',
  altarErrRelatedTxid: 'Choose a linked altar from your Recent list.',
  altarViewRelated: 'View linked altar',
  altarErrName: 'Name is required.',
  altarErrDeathDate: 'Enter date of death as YYYY or YYYY-MM-DD.',
  altarErrBirthYear: 'Enter year of birth as YYYY or YYYY-MM-DD.',
  altarErrOpreturn:
    'Altar note is too long for the chain. Shorten places or the remembrance note, then try again.',
  btnAltarSave: 'Save',
  btnAltarNext: 'Next',
  btnAltarClear: 'Clear',
  altarDetailTitle: 'Altar',
  profileDetailTitle: 'Profile',
  btnOffer: 'Offer a Flower',
  btnSetup: 'Setup',
  btnSettingUp: 'Setting up…',
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
  setupDoneIn: 'Profile set up in {duration} for {name}',
  recentTitle: 'Recent',
  reofferHint:
    'Re-offer a lotus for a memorial. Tap the burn count for history; swipe left for explorer or delete on this device.',
  originalBurnBadge: 'Origin',
  burnTotal: '{n} burns',
  activityTotal: '{n} activities',
  latestBurnLink: 'Latest burn',
  openOnExplorer: 'Open on explorer',
  btnReoffer: 'Re-offer',
  btnHistory: 'History',
  historyTitle: 'Memorial history',
  historyActivityTitle: 'Activity history',
  historyLoading: 'Loading…',
  offeringFallback: 'Offering',
  offerSessionTitle: 'Flower Offering',
  setupSessionTitle: 'Setting up profile',
  reofferSessionTitle: 'Offer a lotus for:',
  sessionNoteLabel: 'In remembrance',
  reofferExtraNoteLabel: 'Words of remembrance',
  reofferExtraNotePlaceholder: 'Optional…',
  btnAmendAltar: 'Add relationship',
  amendRelationshipCreatorOnly:
    'Only the creator of this altar can add relationships.',
  firstOfferDeathTitle: 'Offer a flower',
  firstOfferDeathHint:
    'Date of death is required. This records it on-chain and offers a flower. Only the creator of this profile can do this.',
  btnOfferLotus: 'Offer a lotus',
  btnClose: 'Close',
  cancelOfferMsg: 'Stop this offering and return to the home screen?',
  cancelLoseOfferMsg:
    'The lotus is already minted. Cancelling now skips the memorial burn and uses up this offer turn.',
  btnConfirmCancel: 'Yes, cancel',
  btnConfirmLoseOffer: 'Cancel and lose turn',
  btnKeepOffering: 'Continue offering',
  shareHint: 'Open a W Lotus link to continue that dedication.',
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
  footerBrand: 'W Lotus',
  searchTitle: 'Search',
  searchPlaceholder: 'Search by name…',
  searchHintPrefix: 'Find a profile by name, or',
  searchAddNew: 'add a new one',
  searchHintSuffix: '.',
  searchCta: 'Search',
  homeEventsTitle: 'Events',
  homeEventsOfferings: '{n} offerings',
  homeEventsDaysUntil: 'in {n} days',
  homeEventsToday: 'Today',
  homeEventsOngoing: 'Ongoing',
  homeEventsDaysPast: '{n} days ago',
  searchLoading: 'Searching…',
  searchNoResults: 'No matches found.',
  searchIndexUnavailable:
    'Could not reach the memorial index — showing matches from this device only.',
  btnCung: 'Offer (Cúng)',
  cungSessionTitle: 'Cúng Cô Hồn',
  vuLanSessionTitle: 'Vu Lan — Filial Gratitude',
  specialStoryHeading: 'Temple story',
  specialStoryHint: 'While the lotus is found, you may read this remembrance.',
};



const vi: Dict = {
  brand: 'W Lotus',
  brandWithLogo: 'Lotus',
  tagline: 'Bông hoa của sự tưởng nhớ vĩnh hằng.',
  offerTitle: 'Dâng Hoa',
  hintPrayMine:
    'Một vài phút tưởng niệm trên máy sẽ sản sinh ra hoa sen để tưởng nhớ và công đức.',
  hintKeepScreen:
    'Giữ ứng dụng luôn mở để quá trình tìm kiếm và dâng hoa được tiếp tục.',
  howTitle: 'W Lotus hoạt động như thế nào?',
  howPrayTitle: '',
  howPrayBody:
    'Điện thoại được dùng để tìm ra bông sen số WLOTUS. Bạn phải bật ứng dụng liên tục và không sử dụng ứng dụng khác để quá trình tìm kiếm bông sen số được tiếp tục. Trong lúc này, bạn có thể tưởng nhớ về người đã khuất. Bạn có thể dừng quá trình tìm kiếm này bất cứ lúc nào.',
  howMintTitle: '',
  howMintBody:
    'Quá trình tìm kiếm WLOTUS sẽ sinh ra 108 đóa sen số — một vòng tràng hạt. Tùy theo năng lực của máy, quá trình này có thể từ khoảng 2 phút đến trên 10 phút. Một bông sen số được đốt làm lễ dâng hoa. Phần lớn còn lại thuộc về người tìm kiếm (hoặc nhà phát triển W Lotus khi phí được tài trợ); 6 bông nhỏ được chuyển đến đền thờ.',
  howWhyTitle: 'Tại sao 6 bông được chuyển đến đền thờ?',
  howWhyBody:
    'WLOTUS token được phát hành với mục đích tạo điều kiện cho người dùng điện thoại dâng những bông hoa vĩnh hằng để tỏ lòng tôn kính, qua đó có thể thay thế được việc nhang đèn và dâng hoa thực cho người không có điều kiện. Để tránh các máy móc chuyên dụng làm ảnh hưởng đến trải nghiệm tìm kiếm của người dùng điện thoại, một phần nhỏ của số WLOTUS tìm được sẽ được gửi vào cho đền thờ. Số WLOTUS này sẽ được dùng để duy trì hệ thống và làm công quả.',
  howEternalTitle: '',
  howEternalBody:
    'Mỗi lần dâng sen được ghi lại mãi mãi trên chuỗi khối eCash, đánh dấu cho lòng thành kính vĩnh hằng.',
  howEcashTitle: 'Tại sao eCash?',
  howEcashBody:
    'eCash là blockchain từ năm 2009 — uy tín, phí rất thấp và xác nhận nhanh, phù hợp để ghi nhận mỗi lần dâng hoa WLOTUS.',
  etaEstimated: 'Thời gian ước tính {eta}',
  btnAltarMore: 'Thêm',
  btnAltarEdit: 'Sửa',
  btnAltarDelete: 'Xoá',
  altarLabel: 'Ban thờ',
  profileLabel: 'Hồ sơ',
  altarTitle: 'Ban thờ',
  profileTitle: 'Hồ sơ',
  altarHint:
    'Tạo ban thờ trên chuỗi. Ngày mất tuỳ chọn khi thiết lập — hồ sơ còn sống dùng Hồ sơ cho đến khi người tạo dâng hoa kèm ngày mất.',
  profileHint:
    'Tạo hồ sơ người còn sống trên chuỗi. Dâng hoa mở lại sau khi bạn (người tạo) dâng hoa kèm ngày mất.',
  altarHonorific: 'Danh xưng',
  altarHonorificMr: 'Ông',
  altarHonorificMrs: 'Bà',
  altarName: 'Họ tên',
  altarNamePlaceholder: 'Họ và tên',
  altarNote: 'Lời tưởng niệm',
  altarNotePlaceholder: 'Tuỳ chọn — lời ngắn',
  altarBirthPlace: 'Quê quán',
  altarBirthYear: 'Năm sinh',
  altarBirthYearPlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarBirthDate: 'Năm sinh (YYYY-MM-DD)',
  altarBirthDatePlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarErrBirthDate: 'Năm sinh dạng YYYY hoặc YYYY-MM-DD.',
  altarDeathDate: 'Ngày mất',
  altarDeathDateLunar: 'Ngày mất (Âm lịch)',
  altarDeathDateSolar: 'Ngày mất (Dương lịch)',
  altarEventDate: 'Ngày lễ',
  altarEventDateLunar: 'Ngày lễ (Âm lịch)',
  altarEventDateSolar: 'Ngày lễ (Dương lịch)',
  altarDeathDatePlaceholder: 'YYYY hoặc YYYY-MM-DD',
  altarCalLunar: 'Âm lịch',
  altarCalSolar: 'Dương lịch',
  altarDeathPlace: 'Nơi sinh sống',
  altarFuneralPlace: 'Nơi an táng',
  altarPlaceOptional: 'Tuỳ chọn',
  altarRelationship: 'Mối quan hệ',
  altarRelationshipTitle: 'Mối quan hệ',
  altarRelationshipHint:
    'Liên kết ban thờ này với một ban thờ trong Gần đây. Chi tiết ban thờ gốc giữ trên lần đốt đầu — lần này chỉ thêm mối quan hệ.',
  altarExistingRelationships: 'Mối quan hệ hiện có',
  altarParentMaxHint: 'Tối đa {n} cha/mẹ (hiện chỉ thêm, chưa xoá).',
  altarErrParentMax: 'Đã có đủ {n} mối quan hệ cha/mẹ.',
  altarErrDuplicateRel: 'Mối quan hệ này đã được liên kết.',
  altarRelationshipNone: 'Không có',
  altarRelationshipSpouse: 'Vợ/Chồng',
  altarRelationshipParent: 'Cha/Mẹ',
  altarRelationshipChild: 'Con',
  altarRelatedTxidLabel: 'Ban thờ liên quan (từ danh sách Gần đây)',
  altarRelatedTxidPlaceholder: 'Chọn từ Gần đây…',
  altarNoRecentForRelationship:
    'Hãy dâng hoa cho người đó trong Gần đây trước để liên kết mối quan hệ.',
  altarErrRelatedTxid: 'Chọn một ban thờ liên quan từ danh sách Gần đây.',
  altarViewRelated: 'Xem ban thờ liên quan',
  altarErrName: 'Cần nhập họ tên.',
  altarErrDeathDate: 'Ngày mất dạng YYYY hoặc YYYY-MM-DD.',
  altarErrBirthYear: 'Năm sinh dạng YYYY hoặc YYYY-MM-DD.',
  altarErrOpreturn:
    'Nội dung ban thờ quá dài cho chuỗi khối. Hãy rút gọn nơi chốn hoặc lời tưởng nhớ rồi thử lại.',
  btnAltarSave: 'Lưu',
  btnAltarNext: 'Tiếp',
  btnAltarClear: 'Xoá',
  altarDetailTitle: 'Ban thờ',
  profileDetailTitle: 'Hồ sơ',
  btnOffer: 'Dâng Hoa',
  btnSetup: 'Thiết lập',
  btnSettingUp: 'Đang thiết lập…',
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
  setupDoneIn: 'Đã thiết lập hồ sơ trong {duration} cho {name}',
  recentTitle: 'Gần đây',
  reofferHint:
    'Dâng lại hoa sen cho ban thờ. Chạm số lần dâng để xem lịch sử; vuốt sang trái để mở explorer hoặc xóa khỏi máy này.',
  originalBurnBadge: 'Lập ban',
  burnTotal: '{n} lần dâng',
  activityTotal: '{n} hoạt động',
  latestBurnLink: 'Lần dâng gần nhất',
  openOnExplorer: 'Mở trên explorer',
  btnReoffer: 'Dâng lại',
  btnHistory: 'Lịch sử',
  historyTitle: 'Lịch sử tưởng niệm',
  historyActivityTitle: 'Lịch sử hoạt động',
  historyLoading: 'Đang tải…',
  offeringFallback: 'Lần dâng hoa',
  offerSessionTitle: 'Dâng Hoa',
  setupSessionTitle: 'Đang thiết lập hồ sơ',
  reofferSessionTitle: 'Dâng hoa sen cho:',
  sessionNoteLabel: 'Lời tưởng niệm',
  reofferExtraNoteLabel: 'Lời tưởng niệm',
  reofferExtraNotePlaceholder: 'Tuỳ chọn…',
  btnAmendAltar: 'Thêm mối quan hệ',
  amendRelationshipCreatorOnly:
    'Chỉ người tạo ban thờ mới có thể thêm mối quan hệ.',
  firstOfferDeathTitle: 'Dâng hoa',
  firstOfferDeathHint:
    'Bắt buộc nhập ngày mất. Lần này ghi ngày mất trên chuỗi và dâng hoa. Chỉ người tạo hồ sơ mới làm được.',
  btnOfferLotus: 'Dâng hoa sen',
  btnClose: 'Đóng',
  cancelOfferMsg: 'Dừng dâng hoa và quay lại màn hình chính?',
  cancelLoseOfferMsg:
    'Hoa sen đã được tạo. Hủy lúc này sẽ bỏ qua bước dâng và bạn mất lượt dâng hoa.',
  btnConfirmCancel: 'Đồng ý hủy',
  btnConfirmLoseOffer: 'Hủy và mất lượt',
  btnKeepOffering: 'Tiếp tục dâng',
  shareHint: 'Mở liên kết W Lotus để tiếp tục lời tưởng niệm đó.',
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
  footerBrand: 'W Lotus',
  searchTitle: 'Tìm kiếm',
  searchPlaceholder: 'Tìm theo tên…',
  searchHintPrefix: 'Tìm hồ sơ theo tên, hoặc',
  searchAddNew: 'thêm mới',
  searchHintSuffix: '.',
  searchCta: 'Tìm kiếm',
  homeEventsTitle: 'Sự kiện',
  homeEventsOfferings: '{n} dâng hoa',
  homeEventsDaysUntil: 'còn {n} ngày',
  homeEventsToday: 'Hôm nay',
  homeEventsOngoing: 'Đang diễn ra',
  homeEventsDaysPast: '{n} ngày trước',
  searchLoading: 'Đang tìm…',
  searchNoResults: 'Không tìm thấy kết quả.',
  searchIndexUnavailable:
    'Không kết nối được mục lục tưởng niệm — chỉ hiện kết quả trên máy này.',
  btnCung: 'Cúng',
  cungSessionTitle: 'Cúng Cô Hồn',
  vuLanSessionTitle: 'Vu Lan Báo Hiếu',
  specialStoryHeading: 'Câu chuyện từ chùa',
  specialStoryHint: 'Trong lúc tìm hoa sen, bạn có thể đọc lời tưởng niệm này.',
};



const zh: Dict = {
  brand: 'W Lotus',
  brandWithLogo: 'Lotus',
  tagline: '永恒追思之花。',
  offerTitle: '献花',
  hintPrayMine:
    '在本机上花几分钟追思，即可生出莲花，用于功德与纪念。',
  hintKeepScreen:
    '祈祷时请保持应用常开，以便献花过程得以继续。',
  howTitle: 'W Lotus 如何运作？',
  howPrayTitle: '',
  howPrayBody:
    '手机用于寻找数字莲花 WLOTUS。请保持应用持续开启，且不要切换到其他应用，以便寻找过程继续。在此期间，您可以追思逝去的亲人。您可以随时停止寻找。',
  howMintTitle: '',
  howMintBody:
    '寻找 WLOTUS 会生出 108 朵数字莲花——一整圈念珠。视设备性能，大约需要 2 分钟到 10 分钟以上。其中 1 朵燃烧作为献花；大部分归矿工（若手续费由 W Lotus 赞助则归工作台）；少量 6 朵交给寺庙。',
  howWhyTitle: '为何 6 朵莲花交给寺庙？',
  howWhyBody:
    '每次发行莲花都需支付网络手续费。当 W Lotus 为手机献花赞助手续费时，工作台收取矿工份额，燃烧 1 朵作为您的纪念献花，并保留其余作为库存。自付手续费的独立矿工保留 108 朵中的 102 朵；仅 6 朵作为轻度发行税交给寺庙。',
  howEternalTitle: '',
  howEternalBody:
    '每一次献花都会永久记在区块链上，铭刻一份永恒的敬意。',
  howEcashTitle: '为什么选择 eCash？',
  howEcashBody:
    'eCash 是始于 2009 年的区块链网络——成熟可靠，手续费极低、确认迅速，适合记录每一次 W Lotus 献花。',

  etaEstimated: '预计时间 {eta}',
  btnAltarMore: '添加',
  btnAltarEdit: '编辑',
  btnAltarDelete: '删除',
  altarLabel: '灵位',
  profileLabel: '档案',
  altarTitle: '灵位',
  profileTitle: '档案',
  altarHint:
    '在链上创建灵位。设置时可留空去世日期——在世档案显示为档案，直到创建者献花并填写去世日期。',
  profileHint:
    '在链上创建在世档案。创建者献花并填写去世日期后即可再次献花。',
  altarHonorific: '称谓',
  altarHonorificMr: '先生',
  altarHonorificMrs: '女士',
  altarName: '姓名',
  altarNamePlaceholder: '姓名',
  altarNote: '追思寄语',
  altarNotePlaceholder: '可选短句',
  altarBirthPlace: '籍贯',
  altarBirthYear: '出生年',
  altarBirthYearPlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarBirthDate: '出生日期 (YYYY-MM-DD)',
  altarBirthDatePlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarErrBirthDate: '出生年请用 YYYY 或 YYYY-MM-DD。',
  altarDeathDate: '去世日期',
  altarDeathDateLunar: '去世日期（农历）',
  altarDeathDateSolar: '去世日期（阳历）',
  altarEventDate: '节日',
  altarEventDateLunar: '节日（农历）',
  altarEventDateSolar: '节日（公历）',
  altarDeathDatePlaceholder: 'YYYY 或 YYYY-MM-DD',
  altarCalLunar: '农历',
  altarCalSolar: '阳历',
  altarDeathPlace: '居住地',
  altarFuneralPlace: '安葬地',
  altarPlaceOptional: '可选',
  altarRelationship: '关系',
  altarRelationshipTitle: '关系',
  altarRelationshipHint:
    '将此灵位关联到“最近”中的另一灵位。原有灵位详情保留在首次供奉上——这次只添加关系。',
  altarExistingRelationships: '现有关系',
  altarParentMaxHint: '最多 {n} 位父母（目前只能添加，暂不支持删除）。',
  altarErrParentMax: '已有 {n} 位父母关系。',
  altarErrDuplicateRel: '该关系已关联。',
  altarRelationshipNone: '无',
  altarRelationshipSpouse: '配偶',
  altarRelationshipParent: '父母',
  altarRelationshipChild: '子女',
  altarRelatedTxidLabel: '关联灵位（来自"最近"列表）',
  altarRelatedTxidPlaceholder: '从最近选择…',
  altarNoRecentForRelationship: '请先在"最近"中为对方献花，才能建立关系。',
  altarErrRelatedTxid: '请从"最近"列表中选择关联灵位。',
  altarViewRelated: '查看关联灵位',
  altarErrName: '请填写姓名。',
  altarErrDeathDate: '去世日期请用 YYYY 或 YYYY-MM-DD。',
  altarErrBirthYear: '出生年请用 YYYY 或 YYYY-MM-DD。',
  altarErrOpreturn: '灵位内容过长，无法上链。请缩短地点或纪念文字后再试。',
  btnAltarSave: '保存',
  btnAltarNext: '下一步',
  btnAltarClear: '清除',
  altarDetailTitle: '灵位',
  profileDetailTitle: '档案',
  btnOffer: '献花',
  btnSetup: '设置',
  btnSettingUp: '正在设置…',
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
  setupDoneIn: '档案已设置，用时 {duration}，献给 {name}',
  recentTitle: '最近',
  reofferHint:
    '可为灵位再次献花。点按献花次数查看历史；向左滑动可打开浏览器或从本机删除。',
  originalBurnBadge: '立坛',
  burnTotal: '{n} 次献花',
  activityTotal: '{n} 次活动',
  latestBurnLink: '最近一次献花',
  openOnExplorer: '在浏览器打开',
  btnReoffer: '再献',
  btnHistory: '历史',
  historyTitle: '追思历史',
  historyActivityTitle: '活动历史',
  historyLoading: '加载中…',
  offeringFallback: '献花',
  offerSessionTitle: '献花',
  setupSessionTitle: '正在设置档案',
  reofferSessionTitle: '为TA献上莲花：',
  sessionNoteLabel: '追思寄语',
  reofferExtraNoteLabel: '追思寄语',
  reofferExtraNotePlaceholder: '可选…',
  btnAmendAltar: '添加关系',
  amendRelationshipCreatorOnly: '仅档案创建者可添加关系。',
  firstOfferDeathTitle: '献花',
  firstOfferDeathHint:
    '必须填写去世日期。本次会在链上记录去世日期并献花。仅档案创建者可操作。',
  btnOfferLotus: '献上莲花',
  btnClose: '关闭',
  cancelOfferMsg: '停止献花并返回主页？',
  cancelLoseOfferMsg:
    '莲花已铸造。现在取消将跳过献念，并消耗本次献花名额。',
  btnConfirmCancel: '确认取消',
  btnConfirmLoseOffer: '取消并失去名额',
  btnKeepOffering: '继续献花',
  shareHint: '打开 W Lotus 链接以继续该追思。',
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
  footerBrand: 'W Lotus',
  searchTitle: '搜索',
  searchPlaceholder: '按姓名搜索…',
  searchHintPrefix: '按姓名查找档案，或',
  searchAddNew: '添加新的',
  searchHintSuffix: '。',
  searchCta: '搜索',
  homeEventsTitle: '活动',
  homeEventsOfferings: '{n} 次供奉',
  homeEventsDaysUntil: '还有 {n} 天',
  homeEventsToday: '今天',
  homeEventsOngoing: '进行中',
  homeEventsDaysPast: '{n} 天前',
  searchLoading: '搜索中…',
  searchNoResults: '未找到匹配结果。',
  searchIndexUnavailable: '无法连接追思索引 — 仅显示本机记录。',
  btnCung: '供祭',
  cungSessionTitle: '祭孤魂',
  vuLanSessionTitle: '盂兰盆 — 报恩',
  specialStoryHeading: '寺院故事',
  specialStoryHint: '寻找莲花时，可以阅读这段追思。',
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
