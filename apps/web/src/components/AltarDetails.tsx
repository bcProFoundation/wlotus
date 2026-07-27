import type { AltarFields } from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';

/** Read-only altar / Ban thờ details (offer panel, session, Recent). */
export function AltarDetails(props: {
  altar: AltarFields;
  className?: string;
}) {
  const { t } = useLocale();
  const { altar } = props;
  const rows: { label: string; value: string }[] = [
    { label: t('altarName'), value: altar.name },
    { label: t('altarNote'), value: altar.note },
    { label: t('altarBirthPlace'), value: altar.birthPlace },
    { label: t('altarBirthDate'), value: altar.birthYear },
    { label: t('altarDeathPlace'), value: altar.deathPlace },
    { label: t('altarDeathDate'), value: altar.deathDate },
    { label: t('altarFuneralPlace'), value: altar.funeralPlace },
  ].filter(r => r.value.trim().length > 0);

  return (
    <dl className={`altar-details${props.className ? ` ${props.className}` : ''}`}>
      {rows.map(r => (
        <div key={r.label} className="altar-details-row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
