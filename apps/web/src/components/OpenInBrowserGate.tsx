import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import {
  canAutoEscapeInAppBrowser,
  externalBrowserEscapeUrl,
  hasAttemptedAutoEscape,
  shouldEscapeShareInAppBrowser,
  tryAutoEscapeInAppBrowser,
} from '../lib/inAppBrowser.js';

/**
 * When a dedication share link opens inside a messenger WebView, try a silent
 * escape into the system browser / installed PWA. If the host blocks JS
 * redirects, show a one-tap fallback so localStorage stays with the real session.
 */
export function OpenInBrowserGate(props: {
  /** Current absolute URL to open externally (usually location.href). */
  href: string;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(() => {
    // Already tried auto-escape, or this WebView needs a gesture → show UI.
    return (
      hasAttemptedAutoEscape() || !canAutoEscapeInAppBrowser()
    );
  });

  const escapeHref = useMemo(
    () => externalBrowserEscapeUrl(props.href),
    [props.href],
  );

  useEffect(() => {
    if (showFallback) return;
    const started = tryAutoEscapeInAppBrowser(props.href);
    if (!started) {
      setShowFallback(true);
      return;
    }
    // If still here after a beat, the host ignored the redirect — show UI.
    const timer = window.setTimeout(() => setShowFallback(true), 900);
    return () => window.clearTimeout(timer);
  }, [props.href, showFallback]);

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

  if (!showFallback) {
    // Quiet while the auto-redirect runs — avoid a flash of “please tap”.
    return (
      <div className="open-browser-redirecting" aria-busy="true">
        <p className="hint">{t('openInBrowserRedirecting')}</p>
      </div>
    );
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
