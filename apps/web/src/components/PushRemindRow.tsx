import { useEffect, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import type { RemindAltar } from '../lib/ownOffers.js';
import {
  canUseWebPush,
  enableMorningReminders,
  getPushRegistration,
  needsIosInstallForPush,
  syncMorningReminders,
} from '../lib/pushReminders.js';

export function PushRemindRow(props: {
  installId: string;
  altars: RemindAltar[];
}) {
  const { locale, t } = useLocale();
  const [mode, setMode] = useState<
    'hidden' | 'install' | 'enable' | 'on' | 'busy'
  >('hidden');

  const altarsKey = props.altars.map(a => `${a.txid}:${a.deathYmd}`).join('|');

  useEffect(() => {
    if (needsIosInstallForPush()) {
      setMode('install');
      return;
    }
    if (!canUseWebPush()) {
      setMode('hidden');
      return;
    }
    let cancelled = false;
    void getPushRegistration().then(reg => {
      if (cancelled) return;
      if (!reg) {
        setMode('hidden');
        return;
      }
      if (Notification.permission === 'denied') {
        setMode('hidden');
        return;
      }
      if (Notification.permission === 'granted') {
        setMode('on');
        void syncMorningReminders({
          installId: props.installId,
          locale,
          altars: props.altars,
        }).catch(() => {
          /* mint-api offline */
        });
        return;
      }
      setMode('enable');
    });
    return () => {
      cancelled = true;
    };
  }, [props.installId, altarsKey, locale]);

  if (mode === 'hidden') return null;

  if (mode === 'install') {
    return <p className="hint push-remind">{t('pushRemindInstall')}</p>;
  }

  if (mode === 'on') {
    return <p className="hint push-remind">{t('pushRemindOn')}</p>;
  }

  return (
    <p className="hint push-remind">
      <button
        type="button"
        className="link-more"
        disabled={mode === 'busy'}
        onClick={() => {
          setMode('busy');
          void enableMorningReminders({
            installId: props.installId,
            locale,
            altars: props.altars,
          })
            .then(result => {
              setMode(result === 'on' ? 'on' : 'enable');
            })
            .catch(() => setMode('enable'));
        }}
      >
        {t('pushRemindEnable')}
      </button>
    </p>
  );
}
