import {
  externalBrowserEscapeUrl,
  isInAppBrowser,
  shouldEscapeShareInAppBrowser,
} from '../apps/web/src/lib/inAppBrowser.js';

const TX =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('isInAppBrowser', () => {
  it('detects Zalo / Facebook / Instagram / Android WebView', () => {
    expect(isInAppBrowser('Mozilla/5.0 Zalo iPhone')).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/1.0]',
      ),
    ).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Instagram',
      ),
    ).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
  });

  it('does not flag normal Safari / Chrome', () => {
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
  });
});

describe('externalBrowserEscapeUrl', () => {
  const href = `https://wlotus.org/${TX}`;

  it('builds Android intent URLs', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36',
    );
    expect(out.startsWith(`intent://wlotus.org/${TX}`)).toBe(true);
    expect(out).toContain('scheme=https');
  });

  it('builds Facebook iOS x-safari-https URLs', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS]',
    );
    expect(out).toBe(`x-safari-https://wlotus.org/${TX}`);
  });
});

describe('shouldEscapeShareInAppBrowser', () => {
  it('gates only share paths inside in-app browsers', () => {
    expect(
      shouldEscapeShareInAppBrowser({
        pathname: `/${TX}`,
        ua: 'Mozilla/5.0 Zalo iPhone',
        standalone: false,
      }),
    ).toBe(true);
    expect(
      shouldEscapeShareInAppBrowser({
        pathname: '/',
        ua: 'Mozilla/5.0 Zalo iPhone',
        standalone: false,
      }),
    ).toBe(false);
    expect(
      shouldEscapeShareInAppBrowser({
        pathname: `/${TX}`,
        ua: 'Mozilla/5.0 (iPhone) Version/17.0 Mobile/15E148 Safari/604.1',
        standalone: false,
      }),
    ).toBe(false);
    expect(
      shouldEscapeShareInAppBrowser({
        pathname: `/${TX}`,
        ua: 'Mozilla/5.0 Zalo iPhone',
        standalone: true,
      }),
    ).toBe(false);
  });
});
