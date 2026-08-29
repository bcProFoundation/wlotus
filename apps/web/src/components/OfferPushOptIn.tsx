import { useState } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import type { RemindAltar } from '../lib/ownOffers.js';
import {
  canUseWebPush,
  enableMorningReminders,
  needsIosInstallForPush,
} from '../lib/pushReminders.js';

function canPromptNow(): boolean {
  return (
    canUseWebPush() &&
    !needsIosInstallForPush() &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default'
  );
}

/** Quiet opt-in on the offering wait screen — tap → OS permission dialog. */
export function OfferPushOptIn(props: {
  installId: string;
  altars: RemindAltar[];
}) {
  const { locale, t } = useLocale();
  const [show, setShow] = useState(canPromptNow);
  const [busy, setBusy] = useState(false);

  if (!show) return null;

  return (
    <p className="hint">
      <button
        type="button"
        className="link-more"
        disabled={busy}
        onClick={e => {
          e.stopPropagation();
          if (busy) return;
          setBusy(true);
          void enableMorningReminders({
            installId: props.installId,
            locale,
            altars: props.altars,
          })
            .then(() => {
              if (
                typeof Notification === 'undefined' ||
                Notification.permission !== 'default'
              ) {
                setShow(false);
                return;
              }
              setBusy(false);
            })
            .catch(() => {
              setBusy(false);
            });
        }}
      >
        {t('pushRemindWait')}
      </button>
    </p>
  );
}
