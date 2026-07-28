import {
  altarHonorificLabel,
  formatAltarDateInput,
  type AltarFields,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';

/** Normalize stored dates for display (YYYY / YYYY-MM / YYYY-MM-DD). */
function displayAltarDate(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return formatAltarDateInput(t) || t;
}

/**
 * Force a line break after each comma so long places always wrap.
 * iOS Safari was clipping Cormorant mid-glyph (`Quy Nhơ…`) despite CSS wrap.
 */
function displayAltarPlace(raw: string): string {
  return raw.trim().replace(/,\s*/g, ',\n');
}

type DetailRow = {
  label: string;
  value: string;
  /** Soft-wrap after commas (places). */
  place?: boolean;
};

/** Read-only altar / Ban thờ details (offer panel, session, Recent). */
export function AltarDetails(props: {
  altar: AltarFields;
  className?: string;
}) {
  const { locale, t } = useLocale();
  const { altar } = props;
  const honorific = altarHonorificLabel(altar.title, locale);
  const rows: DetailRow[] = [
    { label: t('altarHonorific'), value: honorific },
    { label: t('altarName'), value: altar.name },
    { label: t('altarNote'), value: altar.note },
    {
      label: t('altarBirthPlace'),
      value: displayAltarPlace(altar.birthPlace),
      place: true,
    },
    {
      label: t('altarBirthDate'),
      value: displayAltarDate(altar.birthYear),
    },
    {
      label: t('altarDeathPlace'),
      value: displayAltarPlace(altar.deathPlace),
      place: true,
    },
    {
      label: t('altarDeathDate'),
      value: displayAltarDate(altar.deathDate),
    },
    {
      label: t('altarFuneralPlace'),
      value: displayAltarPlace(altar.funeralPlace),
      place: true,
    },
  ].filter(r => r.value.trim().length > 0);

  return (
    <div
      className={`altar-details${props.className ? ` ${props.className}` : ''}`}
    >
      {rows.map(r => (
        <div key={r.label} className="altar-details-row">
          <div className="altar-details-label">{r.label}</div>
          <div
            className={
              r.place
                ? 'altar-details-value altar-details-value-place'
                : 'altar-details-value'
            }
            title={r.value.replace(/\n/g, ' ')}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}
