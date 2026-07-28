import {
  canAutoEscapeInAppBrowser,
  detectInAppApp,
  externalBrowserEscapeUrl,
  hostAppDisplayName,
  isInAppBrowser,
  shouldEscapeShareInAppBrowser,
} from '../apps/web/src/lib/inAppBrowser.js';

const TX =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('isInAppBrowser', () => {
  it('detects Zalo / Facebook / Instagram / Android WebView', () => {
    expect(isInAppBrowser('Mozilla/5.0 Zalo iPhone')).toBe(true);
    expect(detectInAppApp('Mozilla/5.0 Zalo iPhone')).toBe('zalo');
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/1.0]',
      ),
    ).toBe(true);
    expect(
      detectInAppApp(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Instagram',
      ),
    ).toBe('instagram');
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

describe('canAutoEscapeInAppBrowser', () => {
  it('skips Messenger/Facebook/Zalo (continue in-host); allows Instagram iOS; blocks Twitter iOS', () => {
    expect(
      canAutoEscapeInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Zalo',
      ),
    ).toBe(false);
    expect(
      canAutoEscapeInAppBrowser(
        'Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS]',
      ),
    ).toBe(false);
    expect(
      canAutoEscapeInAppBrowser(
        'Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/Messenger]',
      ),
    ).toBe(false);
    expect(
      canAutoEscapeInAppBrowser(
        'Mozilla/5.0 (iPhone) Mobile/15E148 Instagram',
      ),
    ).toBe(true);
    expect(
      canAutoEscapeInAppBrowser(
        'Mozilla/5.0 (iPhone) Mobile/15E148 Twitter',
      ),
    ).toBe(false);
  });
});

describe('hostAppDisplayName', () => {
  it('labels Messenger / fallback', () => {
    expect(hostAppDisplayName('messenger', 'vi')).toBe('Messenger');
    expect(hostAppDisplayName(null, 'vi')).toBe('ứng dụng này');
    expect(hostAppDisplayName(null, 'en')).toBe('this app');
  });
});

describe('externalBrowserEscapeUrl', () => {
  const href = `https://wlotus.org/${TX}`;

  it('builds Android intent URLs with fallback', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36',
    );
    expect(out.startsWith(`intent://wlotus.org/${TX}`)).toBe(true);
    expect(out).toContain('scheme=https');
    expect(out).toContain('S.browser_fallback_url=');
  });

  it('builds Facebook iOS x-safari-https URLs', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS]',
    );
    expect(out).toBe(`x-safari-https://wlotus.org/${TX}`);
  });

  it('builds Instagram iOS extbrowser URLs', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (iPhone) Instagram',
    );
    expect(out).toBe(
      `instagram://extbrowser/?url=${encodeURIComponent(href)}`,
    );
  });

  it('adds LINE openExternalBrowser=1', () => {
    const out = externalBrowserEscapeUrl(
      href,
      'Mozilla/5.0 (iPhone) Line/14.0',
    );
    expect(out).toContain('openExternalBrowser=1');
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
