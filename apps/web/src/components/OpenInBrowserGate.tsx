import { useMemo, useState, type MouseEvent } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import {
  externalBrowserEscapeUrl,
  shouldEscapeShareInAppBrowser,
} from '../lib/inAppBrowser.js';

/**
 * When a dedication share link opens inside a messenger WebView, prompt the
 * user to continue in the system browser / installed PWA so localStorage
 * stays with their real White Lotus session.
 */
export function OpenInBrowserGate(props: {
  /** Current absolute URL to open externally (usually location.href). */
  href: string;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const escapeHref = useMemo(
    () => externalBrowserEscapeUrl(props.href),
    [props.href],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* stay silent */
    }
  }

  function openExternal(e: MouseEvent<HTMLAnchorElement>) {
    // Prefer assigning for scheme handlers (intent / x-safari). Keep default
    // <a> navigation as fallback when the scheme is plain https.
    if (
      escapeHref.startsWith('intent:') ||
      escapeHref.startsWith('x-safari-') ||
      escapeHref.startsWith('instagram:')
    ) {
      e.preventDefault();
      window.location.href = escapeHref;
    }
  }

  return (
    <div
      className="offer-modal open-browser-gate"
      role="dialog"
      aria-modal="true"
    >
      <div className="offer-modal-card open-browser-card">
        <img
          className="brand-mark"
          src="/images/wlotus.png"
          alt=""
          width={56}
          height={56}
        />
        <h2>{t('openInBrowserTitle')}</h2>
        <p className="hint">{t('openInBrowserBody')}</p>
        <p className="hint">{t('openInBrowserHint')}</p>
        <div className="open-browser-actions">
          <a
            className="btn btn-primary btn-offer"
            href={escapeHref}
            rel="noopener noreferrer"
            onClick={openExternal}
          >
            {t('openInBrowserCta')}
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copyLink()}
          >
            {copied ? t('openInBrowserCopied') : t('openInBrowserCopy')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook: true when the current share deeplink must escape an in-app browser. */
export function useShareInAppBrowserGate(): boolean {
  return useMemo(() => shouldEscapeShareInAppBrowser(), []);
}
