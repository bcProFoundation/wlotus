import { ALTAR_SEP } from '../src/offering/altarFields.js';
import {
  buildOgHtml,
  ogCopy,
  ogDisplayNameFromNote,
  resolveOgLocale,
} from '../apps/dana-index/src/ogPreview.js';

const TX =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('ogPreview', () => {
  it('defaults locale to Vietnamese', () => {
    expect(resolveOgLocale({})).toBe('vi');
    expect(resolveOgLocale({ langParam: 'en' })).toBe('en');
    expect(resolveOgLocale({ acceptLanguage: 'zh-CN,zh;q=0.9' })).toBe('zh');
  });

  it('builds Tưởng nhớ title from altar name', () => {
    const packed = [
      'Cao Lâm Quả',
      'Nhớ mẹ',
      'Bình Định',
      '1945',
      '2001-12-04',
      '',
      '',
    ].join(ALTAR_SEP);
    expect(ogDisplayNameFromNote(packed)).toBe('Cao Lâm Quả');
    expect(ogCopy('vi', 'Cao Lâm Quả').title).toBe('Tưởng nhớ Cao Lâm Quả');
    expect(ogCopy('en', 'Cao Lâm Quả').title).toBe('In memory of Cao Lâm Quả');
    expect(ogCopy('zh', 'Cao Lâm Quả').title).toBe('纪念 Cao Lâm Quả');
  });

  it('uses brand fallback without a name', () => {
    expect(ogCopy('vi', '').title).toBe('White Lotus - Đoá sen vĩnh hằng');
    expect(ogCopy('vi', '').description).toBe(
      'Gửi lời tưởng nhớ vĩnh hằng trên White Lotus.',
    );
    expect(ogCopy('en', '').title).toBe('White Lotus - Eternal lotus');
  });

  it('renders escaped OG HTML with SPA boot for browsers', () => {
    const packed = ['A & B', 'note', '', '', '2001', '', ''].join(ALTAR_SEP);
    const html = buildOgHtml({
      siteOrigin: 'https://wlotus.org',
      pathTxid: TX,
      locale: 'vi',
      originalNote: packed,
    });
    expect(html).toContain('og:title');
    expect(html).toContain('Tưởng nhớ A &amp; B');
    expect(html).toContain(`https://wlotus.org/${TX}`);
    expect(html).toContain('wlotus-icon-512.png');
    expect(html).toContain("fetch('/index.html'");
  });
});
