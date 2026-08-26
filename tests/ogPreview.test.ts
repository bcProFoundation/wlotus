import { ALTAR_SEP } from '../src/offering/altarFields.js';
import {
  OG_IMAGE_PATH,
  buildOgHtml,
  ogCopy,
  ogDisplayNameFromNote,
  ogImageAlt,
  resolveOgLocale,
} from '../apps/dana-index/src/ogPreview.js';

const TX =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('ogPreview', () => {
  it('defaults locale to Vietnamese; ignores crawler Accept-Language', () => {
    expect(resolveOgLocale({})).toBe('vi');
    expect(resolveOgLocale({ langParam: 'en' })).toBe('en');
    expect(resolveOgLocale({ langParam: 'vi' })).toBe('vi');
    // TelegramBot / Facebook scrapers send en-* — must not win over default or ?lang=
    expect(
      resolveOgLocale({ acceptLanguage: 'en-US,en;q=0.9' }),
    ).toBe('vi');
    expect(
      resolveOgLocale({
        langParam: 'vi',
        acceptLanguage: 'en-US,en;q=0.9',
      }),
    ).toBe('vi');
    expect(
      resolveOgLocale({ acceptLanguage: 'zh-CN,zh;q=0.9' }),
    ).toBe('vi');
  });

  it('builds Tưởng nhớ title from altar name', () => {
    const packed = [
      'mr',
      'Cao Lâm Quả',
      'Nhớ mẹ',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
    ].join(ALTAR_SEP);
    expect(ogDisplayNameFromNote(packed, 'vi')).toBe('Ông Cao Lâm Quả');
    expect(ogCopy('vi', 'Ông Cao Lâm Quả').title).toBe(
      'Tưởng nhớ Ông Cao Lâm Quả',
    );
    expect(ogCopy('en', 'Mr. Cao Lâm Quả').title).toBe(
      'In memory of Mr. Cao Lâm Quả',
    );
    expect(ogCopy('zh', '先生 Cao Lâm Quả').title).toBe('纪念 先生 Cao Lâm Quả');
  });

  it('reads legacy packs in OG without title', () => {
    const legacy = [
      'Cao Lâm Quả',
      'Nhớ mẹ',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
    ].join(ALTAR_SEP);
    expect(ogDisplayNameFromNote(legacy, 'vi')).toBe('Cao Lâm Quả');
  });

  it('uses brand fallback without a name', () => {
    expect(ogCopy('vi', '').title).toBe('W Lotus - Đoá sen vĩnh hằng');
    expect(ogCopy('vi', '').description).toBe(
      'Gửi lời tưởng nhớ vĩnh hằng trên W Lotus.',
    );
    expect(ogCopy('en', '').title).toBe('W Lotus - Eternal lotus');
  });

  it('renders escaped OG HTML with SPA boot for browsers', () => {
    const packed = ['mrs', 'A & B', 'note', '', '', '2001', '', ''].join(
      ALTAR_SEP,
    );
    const html = buildOgHtml({
      siteOrigin: 'https://wlotus.org',
      pathTxid: TX,
      locale: 'vi',
      originalNote: packed,
    });
    expect(html).toContain('og:title');
    expect(html).toContain('Tưởng nhớ Bà A &amp; B');
    expect(html).toContain(`https://wlotus.org/${TX}`);
    expect(html).toContain(`https://wlotus.org${OG_IMAGE_PATH}`);
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
    expect(html).toContain(ogImageAlt('vi'));
    expect(html).not.toContain('wlotus-icon-512.png');
    expect(html).toContain("fetch('/index.html'");
  });

  it('uses locale-specific image alt on the rosewood OG card', () => {
    expect(ogImageAlt('en')).toBe('W Lotus — a flower of eternal remembrance');
    expect(ogImageAlt('vi')).toContain('đoá sen vĩnh hằng');
    const html = buildOgHtml({
      siteOrigin: 'https://wlotus.org',
      pathTxid: TX,
      locale: 'en',
    });
    expect(html).toContain('/og.png');
    expect(html).toContain('twitter:image:alt');
  });
});
