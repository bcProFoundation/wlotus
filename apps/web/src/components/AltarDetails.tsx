import { useState, type ReactNode } from 'react';
import {
  altarHonorificLabel,
  altarParentRelationshipLabel,
  altarRelationships,
  altarSpouseRelationshipLabel,
  formatAltarDateInput,
  sortAltarRelationships,
  type AltarFields,
  type AltarHonorific,
  type AltarLocale,
  type AltarRelationshipKind,
  type AltarRelationshipLink,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';
import {
  formatLunarBirthYear,
  formatLunarDeathDate,
} from '../lib/lunarCalendar.js';

/** Normalize stored dates for display (YYYY / YYYY-MM / YYYY-MM-DD). */
function displayAltarDate(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return formatAltarDateInput(t) || t;
}

/** One pickable link target — this device's Recent list only. */
export interface RelatedAltarOption {
  txid: string;
  label: string;
  /** Related altar honorific — drives Cha / Mẹ labels. */
  title?: AltarHonorific | string;
  /** Related birth date/year — sorts Con when present. */
  birthYear?: string;
}

export function relationshipKindLabel(
  type: AltarRelationshipKind,
  thisTitle: AltarHonorific | string,
  locale: AltarLocale,
  relatedTitle: string | null | undefined,
  childLabel: string,
): string {
  if (type === 'spouse') return altarSpouseRelationshipLabel(thisTitle, locale);
  if (type === 'parent') {
    return altarParentRelationshipLabel(relatedTitle, locale);
  }
  return childLabel;
}

export function relatedMetaMap(
  options: RelatedAltarOption[] | undefined,
): Map<string, { title?: string; birthYear?: string }> {
  const map = new Map<string, { title?: string; birthYear?: string }>();
  for (const o of options || []) {
    map.set(o.txid, { title: o.title, birthYear: o.birthYear });
  }
  return map;
}

/** Read-only altar / Ban thờ details (offer panel, session, Recent). */
export function AltarDetails(props: {
  altar: AltarFields;
  className?: string;
  /** Open the linked altar (relationship) when the caller supports it. */
  onViewRelated?: (relatedTxid: string) => void;
  /** Resolve the linked altar's display name (Recent-list / index options). */
  relatedAltarOptions?: RelatedAltarOption[];
}) {
  const { locale, t } = useLocale();
  const { altar } = props;
  const honorific = altarHonorificLabel(altar.title, locale);
  const solarDeath = displayAltarDate(altar.deathDate);
  const lunarDeathDate = formatLunarDeathDate(altar.deathDate.trim(), locale);
  // Default to lunar for vi/zh when a full death date converts (giỗ tradition).
  const [showLunarDeath, setShowLunarDeath] = useState(() =>
    Boolean(lunarDeathDate),
  );
  const deathValue =
    showLunarDeath && lunarDeathDate ? lunarDeathDate : solarDeath;
  const canToggleDeath = Boolean(lunarDeathDate && solarDeath);

  const solarBirth = displayAltarDate(altar.birthYear);
  const lunarBirthYear = formatLunarBirthYear(altar.birthYear.trim(), locale);
  const birthValue =
    solarBirth && lunarBirthYear
      ? `${solarBirth} (${lunarBirthYear})`
      : solarBirth;

  const rows: { key: string; label: ReactNode; value: ReactNode }[] = [
    { key: 'honorific', label: t('altarHonorific'), value: honorific },
    { key: 'name', label: t('altarName'), value: altar.name.trim() },
    { key: 'note', label: t('altarNote'), value: altar.note.trim() },
    {
      key: 'birthPlace',
      label: t('altarBirthPlace'),
      value: altar.birthPlace.trim(),
    },
    { key: 'birthDate', label: t('altarBirthDate'), value: birthValue },
    {
      key: 'deathPlace',
      label: t('altarDeathPlace'),
      value: altar.deathPlace.trim(),
    },
    {
      key: 'deathDate',
      label: (
        <span className="altar-details-label-row">
          <span>{t('altarDeathDate')}</span>
          {canToggleDeath ? (
            <button
              type="button"
              className="altar-cal-toggle"
              onClick={() => setShowLunarDeath(v => !v)}
            >
              {showLunarDeath ? t('altarCalSolar') : t('altarCalLunar')}
            </button>
          ) : null}
        </span>
      ),
      value: deathValue,
    },
    {
      key: 'funeralPlace',
      label: t('altarFuneralPlace'),
      value: altar.funeralPlace.trim(),
    },
  ].filter(r => {
    if (typeof r.value === 'string') return r.value.length > 0;
    return Boolean(r.value);
  });

  const meta = relatedMetaMap(props.relatedAltarOptions);
  const links: AltarRelationshipLink[] = sortAltarRelationships(
    altarRelationships(altar),
    meta,
  );

  return (
    <div
      className={`altar-details${props.className ? ` ${props.className}` : ''}`}
    >
      {rows.map(r => (
        <div key={r.key} className="altar-details-row">
          <div className="altar-details-label">{r.label}</div>
          <div className="altar-details-value">{r.value}</div>
        </div>
      ))}
      {links.map(link => {
        const related = props.relatedAltarOptions?.find(
          o => o.txid === link.relatedTxid,
        );
        const label = relationshipKindLabel(
          link.type,
          altar.title,
          locale,
          related?.title,
          t('altarRelationshipChild'),
        );
        const relatedName = related?.label;
        return (
          <div
            key={`${link.type}:${link.relatedTxid}`}
            className="altar-details-row"
          >
            <div className="altar-details-label">{label}</div>
            <div className="altar-details-value">
              {props.onViewRelated ? (
                <button
                  type="button"
                  className="altar-related-link"
                  onClick={() => props.onViewRelated?.(link.relatedTxid)}
                >
                  {relatedName || t('altarViewRelated')}
                </button>
              ) : (
                relatedName || t('altarViewRelated')
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
