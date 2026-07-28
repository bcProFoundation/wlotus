import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import {
  canAutoEscapeInAppBrowser,
  detectInAppApp,
  externalBrowserEscapeUrl,
  hasAttemptedAutoEscape,
  hasContinuedInHostApp,
  hostAppDisplayName,
  markContinuedInHostApp,
  shouldEscapeShareInAppBrowser,
  tryAutoEscapeInAppBrowser,
  type InAppApp,
} from '../lib/inAppBrowser.js';

/**
 * When a dedication share link opens inside a messenger WebView, offer
 * “Continue in Messenger/…” so the user can offer flowers in the host app.
 * External-browser escape is optional (⋯ menu) — Messenger’s in-app “Open in
 * browser” button is unreliable.
 */
export function OpenInBrowserGate(props: {
  /** Current absolute URL (usually location.href). */
  href: string;
  /** Dismiss the gate and use White Lotus inside this WebView. */
  onContinue: () => void;
  hostApp: InAppApp | null;
}) {
  const { locale, t } = useLocale();
  const [copied, setCopied] = useState(false);
  const appName = hostAppDisplayName(props.hostApp, locale);
  const [showFallback, setShowFallback] = useState(() => {
    return hasAttemptedAutoEscape() || !canAutoEscapeInAppBrowser();
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
        <h2>{t('openInBrowserTitle', { app: appName })}</h2>
        <p className="hint">{t('openInBrowserBody', { app: appName })}</p>
        <p className="hint">{t('openInBrowserHint')}</p>
        <div className="open-browser-actions">
          <button
            type="button"
            className="btn btn-primary btn-offer"
            onClick={props.onContinue}
          >
            {t('openInBrowserCta', { app: appName })}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copyLink()}
          >
            {copied ? t('openInBrowserCopied') : t('openInBrowserCopy')}
          </button>
          <a
            className="btn btn-ghost open-browser-external"
            href={escapeHref}
            rel="noopener noreferrer"
            onClick={openExternal}
          >
            {t('openInBrowserExternal')}
          </a>
        </div>
      </div>
    </div>
  );
}

/** Share-deeplink gate: active until the user continues in the host app. */
export function useShareInAppBrowserGate(): {
  active: boolean;
  hostApp: InAppApp | null;
  continueInHost: () => void;
} {
  const hostApp = useMemo(() => detectInAppApp(), []);
  const [active, setActive] = useState(() => {
    if (!shouldEscapeShareInAppBrowser()) return false;
    return !hasContinuedInHostApp();
  });

  const continueInHost = useCallback(() => {
    markContinuedInHostApp();
    setActive(false);
  }, []);

  return { active, hostApp, continueInHost };
}
