import {
  altarHonorificLabel,
  formatAltarDateInput,
  type AltarFields,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';
import { formatLunarDeathDate } from '../lib/lunarCalendar.js';

/** Normalize stored dates for display (YYYY / YYYY-MM / YYYY-MM-DD). */
function displayAltarDate(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return formatAltarDateInput(t) || t;
}

/** Read-only altar / Ban thờ details (offer panel, session, Recent). */
export function AltarDetails(props: {
  altar: AltarFields;
  className?: string;
}) {
  const { locale, t } = useLocale();
  const { altar } = props;
  const honorific = altarHonorificLabel(altar.title, locale);
  // vi/zh giỗ (death anniversary) tradition tracks the lunar date, not the
  // Gregorian one — show it in place of the solar date when we can convert
  // (requires a full YYYY-MM-DD; partial YYYY/YYYY-MM falls back to solar).
  const lunarDeathDate = formatLunarDeathDate(altar.deathDate.trim(), locale);
  const rows: { label: string; value: string }[] = [
    { label: t('altarHonorific'), value: honorific },
    { label: t('altarName'), value: altar.name.trim() },
    { label: t('altarNote'), value: altar.note.trim() },
    { label: t('altarBirthPlace'), value: altar.birthPlace.trim() },
    {
      label: t('altarBirthDate'),
      value: displayAltarDate(altar.birthYear),
    },
    { label: t('altarDeathPlace'), value: altar.deathPlace.trim() },
    lunarDeathDate
      ? { label: t('altarDeathDateLunar'), value: lunarDeathDate }
      : { label: t('altarDeathDate'), value: displayAltarDate(altar.deathDate) },
    { label: t('altarFuneralPlace'), value: altar.funeralPlace.trim() },
  ].filter(r => r.value.length > 0);

  return (
    <div
      className={`altar-details${props.className ? ` ${props.className}` : ''}`}
    >
      {rows.map(r => (
        <div key={r.label} className="altar-details-row">
          <div className="altar-details-label">{r.label}</div>
          <div className="altar-details-value">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
