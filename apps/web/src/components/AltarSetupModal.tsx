import { useEffect, useRef, useState } from 'react';
import {
  altarHasDeathDate,
  altarIsEvent,
  altarParentRelationshipLabel,
  altarRelationships,
  altarSpouseRelationshipLabel,
  canAddRelationship,
  emptyAltarFields,
  formatAltarDateInput,
  formatAltarPersonName,
  parseAltarPersonName,
  MAX_PARENT_RELATIONSHIPS,
  MEMORIAL_NOTE_MAX_BYTES,
  normalizeAltarDateCalendar,
  normalizeAltarKind,
  normalizeAltarRelatedTxid,
  sortAltarRelationships,
  truncateUtf8Bytes,
  utf8ByteLength,
  validateAltarFields,
  validateDeathDateFields,
  validateRelationshipFields,
  type AltarDateCalendar,
  type AltarFields,
  type AltarHonorific,
  type AltarKind,
  type AltarRelationshipKind,
  type AltarRelationshipLink,
  type AltarRelationshipType,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';
import { formatLunarDeathDate } from '../lib/lunarCalendar.js';
import {
  specialHidesAltarSectionLabel,
  specialStoryForLocale,
  type TempleSpecialProfileUi,
} from '../lib/specialsUi.js';
import {
  AltarDetails,
  relatedMetaMap,
  relationshipKindLabel,
  type RelatedAltarOption,
} from './AltarDetails.js';
import { TempleStory } from './TempleStory.js';
import { OfferModal } from './OfferModal.js';

type Step = 'edit' | 'review';
type ModalVariant = 'setup' | 'relationship' | 'death' | 'list';

function defaultDateCalendar(locale: string): AltarDateCalendar {
  return locale.startsWith('en') ? 'solar' : 'lunar';
}

function normalizeFields(draft: AltarFields): AltarFields {
  return {
    title: draft.title === 'mr' || draft.title === 'mrs' ? draft.title : '',
    name: draft.name.trim(),
    note: draft.note.trim(),
    birthPlace: draft.birthPlace.trim(),
    birthYear: draft.birthYear.trim(),
    deathDate: draft.deathDate.trim(),
    deathPlace: draft.deathPlace.trim(),
    funeralPlace: draft.funeralPlace.trim(),
    relationshipType: draft.relationshipType,
    relatedTxid: normalizeAltarRelatedTxid(draft.relatedTxid),
    relationships: draft.relationships ?? [],
    kind: normalizeAltarKind(draft.kind),
    dateCalendar: normalizeAltarDateCalendar(draft.dateCalendar),
    listed: draft.listed === true ? true : draft.listed === false ? false : null,
  };
}

function fieldsForInput(fields: AltarFields, locale: string): AltarFields {
  const calendar =
    normalizeAltarDateCalendar(fields.dateCalendar) ||
    defaultDateCalendar(locale);
  return {
    ...fields,
    dateCalendar: calendar,
  };
}

function DateCalendarToggle(props: {
  value: AltarDateCalendar;
  onChange: (next: AltarDateCalendar) => void;
  lunarLabel: string;
  solarLabel: string;
  solarYmd: string;
  locale: 'vi' | 'en' | 'zh';
}) {
  const calendar = props.value === 'lunar' ? 'lunar' : 'solar';
  const lunarPreview =
    calendar === 'lunar'
      ? formatLunarDeathDate(props.solarYmd.trim(), props.locale)
      : null;
  return (
    <>
      <div
        className="altar-honorific altar-date-calendar"
        role="group"
        aria-label={`${props.lunarLabel} / ${props.solarLabel}`}
      >
        <button
          type="button"
          className={
            calendar === 'lunar'
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={calendar === 'lunar'}
          onClick={() => props.onChange('lunar')}
        >
          {props.lunarLabel}
        </button>
        <button
          type="button"
          className={
            calendar === 'solar'
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={calendar === 'solar'}
          onClick={() => props.onChange('solar')}
        >
          {props.solarLabel}
        </button>
      </div>
      {lunarPreview ? (
        <p className="hint altar-date-lunar-preview">{lunarPreview}</p>
      ) : null}
    </>
  );
}

function ListedToggle(props: {
  listed: boolean;
  onChange: (listed: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="field">
      <span className="altar-honorific-label" id="altar-listed-label">
        {t('altarListedLabel')}
      </span>
      <div
        className="altar-honorific"
        role="group"
        aria-labelledby="altar-listed-label"
      >
        <button
          type="button"
          className={
            !props.listed
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={!props.listed}
          onClick={() => props.onChange(false)}
        >
          {t('altarListedNo')}
        </button>
        <button
          type="button"
          className={
            props.listed
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={props.listed}
          onClick={() => props.onChange(true)}
        >
          {t('altarListedYes')}
        </button>
      </div>
      <p className="hint">{t('altarListedHint')}</p>
    </div>
  );
}

function RelationshipFields(props: {
  draft: AltarFields;
  errorKey: string | null;
  relatedAltarOptions: RelatedAltarOption[];
  parentDisabled?: boolean;
  setRelationshipType: (next: AltarRelationshipType) => void;
  setRelatedTxid: (txid: string) => void;
}) {
  const { t, locale } = useLocale();
  const { draft } = props;
  const spouseLabel = altarSpouseRelationshipLabel(draft.title, locale);
  const relatedOpt = props.relatedAltarOptions.find(
    o => o.txid === draft.relatedTxid,
  );
  const parentLabel = altarParentRelationshipLabel(relatedOpt?.title, locale);
  return (
    <div className="field">
      <span className="altar-honorific-label" id="altar-relationship-label">
        {t('altarRelationship')}
      </span>
      <div
        className="altar-honorific altar-relationship"
        role="group"
        aria-labelledby="altar-relationship-label"
      >
        <button
          type="button"
          className={
            draft.relationshipType === 'parent'
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={draft.relationshipType === 'parent'}
          disabled={props.parentDisabled && draft.relationshipType !== 'parent'}
          onClick={() => props.setRelationshipType('parent')}
        >
          {parentLabel}
        </button>
        <button
          type="button"
          className={
            draft.relationshipType === 'child'
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={draft.relationshipType === 'child'}
          onClick={() => props.setRelationshipType('child')}
        >
          {t('altarRelationshipChild')}
        </button>
        <button
          type="button"
          className={
            draft.relationshipType === 'spouse'
              ? 'altar-honorific-btn is-selected'
              : 'altar-honorific-btn'
          }
          aria-pressed={draft.relationshipType === 'spouse'}
          onClick={() => props.setRelationshipType('spouse')}
        >
          {spouseLabel}
        </button>
      </div>
      {props.parentDisabled ? (
        <p className="hint" style={{ marginTop: '0.35rem' }}>
          {t('altarParentMaxHint', { n: MAX_PARENT_RELATIONSHIPS })}
        </p>
      ) : null}
      {draft.relationshipType ? (
        props.relatedAltarOptions.length > 0 ? (
          <select
            id="altar-related-txid"
            value={draft.relatedTxid}
            onChange={e => props.setRelatedTxid(e.target.value)}
            aria-label={t('altarRelatedTxidLabel')}
            style={{ marginTop: '0.5rem' }}
          >
            <option value="">{t('altarRelatedTxidPlaceholder')}</option>
            {props.relatedAltarOptions.map(o => (
              <option key={o.txid} value={o.txid}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="hint" style={{ marginTop: '0.5rem' }}>
            {t('altarNoRecentForRelationship')}
          </p>
        )
      ) : null}
      {props.errorKey === 'relatedTxid' ||
      props.errorKey === 'relationshipType' ||
      props.errorKey === 'duplicate' ||
      props.errorKey === 'parentMax' ? (
        <p className="hint altar-field-error">
          {props.errorKey === 'parentMax'
            ? t('altarErrParentMax', { n: MAX_PARENT_RELATIONSHIPS })
            : props.errorKey === 'duplicate'
              ? t('altarErrDuplicateRel')
              : t('altarErrRelatedTxid')}
        </p>
      ) : null}
    </div>
  );
}

function ExistingRelationships(props: {
  links: AltarRelationshipLink[];
  relatedAltarOptions: RelatedAltarOption[];
  title: AltarHonorific | string;
}) {
  const { t, locale } = useLocale();
  if (props.links.length === 0) return null;
  const sorted = sortAltarRelationships(
    props.links,
    relatedMetaMap(props.relatedAltarOptions),
  );
  return (
    <div className="field">
      <span className="altar-honorific-label">
        {t('altarExistingRelationships')}
      </span>
      <ul className="altar-existing-relationships">
        {sorted.map(link => {
          const related = props.relatedAltarOptions.find(
            o => o.txid === link.relatedTxid,
          );
          const name = related?.label || t('altarViewRelated');
          const label = relationshipKindLabel(
            link.type,
            props.title,
            locale,
            related?.title,
            t('altarRelationshipChild'),
          );
          return (
            <li key={`${link.type}:${link.relatedTxid}`}>
              <span className="altar-details-label">{label}</span>
              {' · '}
              <span className="altar-details-value">{name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AltarSetupModal(props: {
  initial: AltarFields | null;
  fallbackName?: string;
  /** setup = new profile; relationship / death / list = star-fragment amend. */
  variant?: ModalVariant;
  /** Overrides the default altar/profile hint (first-burn specials). */
  setupHint?: string;
  etaLabel: string;
  offerDisabled?: boolean;
  relatedAltarOptions: RelatedAltarOption[];
  /** Unbound temple special — story on setup/details, without the lotus prayer. */
  special?: TempleSpecialProfileUi | null;
  onClose: () => void;
  onSave: (fields: AltarFields) => void;
  onOffer: (fields: AltarFields) => void;
}) {
  const { t, locale } = useLocale();
  const variant: ModalVariant = props.variant ?? 'setup';
  const relationshipOnly = variant === 'relationship';
  const deathOnly = variant === 'death';
  const listOnly = variant === 'list';
  const fragmentOnly = relationshipOnly || deathOnly || listOnly;
  const existingLinks = altarRelationships(props.initial ?? emptyAltarFields());
  const parentCount = existingLinks.filter(l => l.type === 'parent').length;
  const parentAtMax = parentCount >= MAX_PARENT_RELATIONSHIPS;
  const cardRef = useRef<HTMLDivElement>(null);
  const festivalSpecial = specialHidesAltarSectionLabel(props.special ?? null);
  const [step, setStep] = useState<Step>(() =>
    festivalSpecial && !fragmentOnly ? 'review' : 'edit',
  );
  const [draft, setDraft] = useState<AltarFields>(() => {
    const calendarFallback = defaultDateCalendar(locale);
    if (relationshipOnly) {
      const initial = props.initial ?? emptyAltarFields();
      return {
        ...initial,
        dateCalendar:
          normalizeAltarDateCalendar(initial.dateCalendar) || calendarFallback,
        relationshipType: '',
        relatedTxid: '',
        relationships: existingLinks,
      };
    }
    if (deathOnly) {
      const initial = props.initial ?? emptyAltarFields();
      return {
        ...initial,
        deathDate: '',
        deathPlace: initial.deathPlace || '',
        funeralPlace: initial.funeralPlace || '',
        dateCalendar:
          normalizeAltarDateCalendar(initial.dateCalendar) || calendarFallback,
        relationshipType: '',
        relatedTxid: '',
        relationships: existingLinks,
      };
    }
    if (listOnly) {
      const initial = props.initial ?? emptyAltarFields();
      return {
        ...initial,
        dateCalendar:
          normalizeAltarDateCalendar(initial.dateCalendar) || calendarFallback,
        listed: initial.listed === true,
        relationshipType: '',
        relatedTxid: '',
        relationships: existingLinks,
      };
    }
    if (props.initial) {
      const input = fieldsForInput(props.initial, locale);
      return {
        ...input,
        title: input.title || '',
        relationshipType: '',
        relatedTxid: '',
        relationships: input.relationships ?? [],
      };
    }
    const base = emptyAltarFields();
    const name = (props.fallbackName || '').trim();
    return {
      ...base,
      name,
      dateCalendar: calendarFallback,
      listed: false,
      relationshipType: '',
      relatedTxid: '',
    };
  });
  const [review, setReview] = useState<AltarFields | null>(() => {
    if (!festivalSpecial || fragmentOnly || !props.initial) {
      return null;
    }
    return normalizeFields({
      ...props.initial,
      title: props.initial.title || '',
      relationshipType: '',
      relatedTxid: '',
      relationships: props.initial.relationships ?? [],
    });
  });
  const [personNameInput, setPersonNameInput] = useState(() => {
    const seed = props.initial ?? emptyAltarFields();
    const named = formatAltarPersonName(seed, locale);
    return named || (props.fallbackName || '').trim();
  });
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const availableOptions = props.relatedAltarOptions.filter(
    o => !existingLinks.some(l => l.relatedTxid === o.txid),
  );

  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
  }, [step]);

  function setField<K extends keyof AltarFields>(key: K, value: AltarFields[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrorKey(null);
  }

  function changePersonName(raw: string) {
    setPersonNameInput(raw);
    const parsed = parseAltarPersonName(raw);
    setDraft(d => ({ ...d, title: parsed.title, name: parsed.name }));
    setErrorKey(null);
  }

  function changeDateCalendar(next: AltarDateCalendar) {
    const cur =
      normalizeAltarDateCalendar(draft.dateCalendar) || 'solar';
    if (next === cur && draft.dateCalendar === next) return;
    setDraft(d => ({ ...d, dateCalendar: next }));
    setErrorKey(null);
  }

  function setAltarKind(next: AltarKind) {
    if (next === 'event') {
      setDraft(d => ({
        ...d,
        kind: 'event',
        title: '',
        birthPlace: '',
        birthYear: '',
        funeralPlace: '',
        relationshipType: '',
        relatedTxid: '',
      }));
    } else {
      setDraft(d => ({ ...d, kind: '' }));
    }
    setErrorKey(null);
  }

  function toWireFields(raw: AltarFields): AltarFields {
    const fields = normalizeFields(raw);
    const calendar = normalizeAltarDateCalendar(fields.dateCalendar);
    const kind = normalizeAltarKind(fields.kind);
    if (kind === 'event') {
      return {
        ...fields,
        kind,
        dateCalendar: calendar,
        listed: null,
        title: '',
        birthPlace: '',
        birthYear: '',
        funeralPlace: '',
        relationshipType: '',
        relatedTxid: '',
      };
    }
    const parsed =
      !listOnly && !relationshipOnly && !deathOnly
        ? parseAltarPersonName(personNameInput)
        : { title: fields.title, name: fields.name };
    return {
      ...fields,
      kind,
      dateCalendar: calendar,
      listed: fields.listed === true,
      title: parsed.title,
      name: parsed.name || fields.name,
    };
  }

  function setRelationshipType(next: AltarRelationshipType) {
    if (next === 'parent' && parentAtMax) {
      setErrorKey('parentMax');
      return;
    }
    const nextType = draft.relationshipType === next ? '' : next;
    setDraft(d => ({
      ...d,
      relationshipType: nextType,
      relatedTxid:
        nextType && availableOptions.some(o => o.txid === d.relatedTxid)
          ? d.relatedTxid
          : '',
    }));
    setErrorKey(null);
  }

  function validateAdd(): string | null {
    const pairErr =
      validateRelationshipFields(draft) ||
      (!draft.relationshipType ? 'relationshipType' : null);
    if (pairErr) return pairErr;
    const type = draft.relationshipType as AltarRelationshipKind;
    const txid = normalizeAltarRelatedTxid(draft.relatedTxid);
    return canAddRelationship(existingLinks, { type, relatedTxid: txid });
  }

  function validateDraft(): string | null {
    if (relationshipOnly) return validateAdd();
    if (deathOnly) return validateDeathDateFields(draft);
    if (listOnly) return null;
    if (!altarIsEvent(draft)) {
      const parsed = parseAltarPersonName(personNameInput);
      return validateAltarFields({
        ...draft,
        title: parsed.title,
        name: parsed.name,
      });
    }
    return validateAltarFields(draft);
  }

  function goReview() {
    const err = validateDraft();
    if (err) {
      setErrorKey(err);
      return;
    }
    let fields = toWireFields(draft);
    if (!fragmentOnly) {
      fields = {
        ...fields,
        relationshipType: '',
        relatedTxid: '',
      };
    }
    setReview(fields);
    props.onSave(fields);
    setStep('review');
  }

  function goEdit() {
    setStep('edit');
  }

  function offer() {
    let fields = review ?? toWireFields(draft);
    // New profile/altar setup: never attach a relationship link (requires a
    // separate star-fragment burn and distracts from the first dedication).
    if (!fragmentOnly) {
      fields = {
        ...fields,
        relationshipType: '',
        relatedTxid: '',
      };
    }
    const err = (() => {
      if (relationshipOnly) {
        const pairErr =
          validateRelationshipFields(fields) ||
          (!fields.relationshipType ? 'relationshipType' : null);
        if (pairErr) return pairErr;
        return canAddRelationship(existingLinks, {
          type: fields.relationshipType as AltarRelationshipKind,
          relatedTxid: normalizeAltarRelatedTxid(fields.relatedTxid),
        });
      }
      if (deathOnly) return validateDeathDateFields(fields);
      if (listOnly) return null;
      return validateAltarFields(fields);
    })();
    if (err) {
      setErrorKey(err);
      setStep('edit');
      return;
    }
    props.onSave(fields);
    props.onOffer(fields);
  }

  const specialTitle = (
    specialStoryForLocale(props.special ?? null, locale, {
      omitPrayer: true,
    })?.title ||
    props.special?.name ||
    ''
  ).trim();

  const personLabel =
    formatAltarPersonName(props.initial ?? draft, locale) ||
    t('offeringFallback');

  const isEvent = !fragmentOnly && altarIsEvent(draft);

  const editTitle = relationshipOnly
    ? t('altarRelationshipTitle')
    : deathOnly
      ? t('firstOfferDeathTitle')
      : listOnly
        ? t('altarListTitle')
      : festivalSpecial && specialTitle
        ? specialTitle
        : isEvent
          ? t('altarEventTitle')
          : altarHasDeathDate(draft)
            ? t('altarTitle')
            : t('profileTitle');
  const editHint = relationshipOnly
    ? t('altarRelationshipHint')
    : deathOnly
      ? t('firstOfferDeathHint')
      : listOnly
        ? t('altarListHint')
      : props.setupHint
        ? props.setupHint
        : isEvent
          ? t('altarEventHint')
          : altarHasDeathDate(draft)
            ? t('altarHint')
            : t('profileHint');
  const primaryCta = fragmentOnly ? t('btnOffer') : t('btnSetup');
  const reviewTitle = relationshipOnly
    ? t('altarRelationshipTitle')
    : deathOnly
      ? t('firstOfferDeathTitle')
      : listOnly
        ? t('altarListTitle')
      : festivalSpecial && specialTitle
        ? specialTitle
        : altarIsEvent(review ?? draft)
          ? t('altarEventTitle')
          : altarHasDeathDate(review ?? draft)
            ? t('altarDetailTitle')
            : t('profileDetailTitle');

  return (
    <OfferModal
      className="offer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="altar-setup-title"
    >
      <div ref={cardRef} className="offer-modal-card altar-setup-card">
        <button
          type="button"
          className="offer-modal-close"
          aria-label={t('btnClose')}
          onClick={props.onClose}
        >
          ×
        </button>

        {step === 'edit' ? (
          <>
            <h2 id="altar-setup-title">{editTitle}</h2>
            <p className="hint">{editHint}</p>
            {!fragmentOnly ? (
              <TempleStory
                special={props.special}
                omitPrayer
                className="temple-story--details"
              />
            ) : null}

            {relationshipOnly ? (
              <>
                <p className="offer-session-note offer-session-original">
                  {personLabel}
                </p>
                <ExistingRelationships
                  links={existingLinks}
                  relatedAltarOptions={props.relatedAltarOptions}
                  title={draft.title}
                />
                <RelationshipFields
                  draft={draft}
                  errorKey={errorKey}
                  relatedAltarOptions={availableOptions}
                  parentDisabled={parentAtMax}
                  setRelationshipType={setRelationshipType}
                  setRelatedTxid={txid => setField('relatedTxid', txid)}
                />
              </>
            ) : deathOnly ? (
              <>
                <p className="offer-session-note offer-session-original">
                  {personLabel}
                </p>
                <div className="field">
                  <label htmlFor="altar-death-place">
                    {t('altarDeathPlace')}
                  </label>
                  <input
                    id="altar-death-place"
                    type="text"
                    value={draft.deathPlace}
                    onChange={e => setField('deathPlace', e.target.value)}
                    placeholder={t('altarPlaceOptional')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="altar-death-date">
                    {t('altarDeathDate')}
                  </label>
                  <input
                    id="altar-death-date"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={draft.deathDate}
                    onChange={e =>
                      setField(
                        'deathDate',
                        formatAltarDateInput(e.target.value),
                      )
                    }
                    placeholder={t('altarDeathDatePlaceholder')}
                  />
                  <DateCalendarToggle
                    value={
                      normalizeAltarDateCalendar(draft.dateCalendar) ||
                      'solar'
                    }
                    onChange={changeDateCalendar}
                    lunarLabel={t('altarCalLunar')}
                    solarLabel={t('altarCalSolar')}
                    solarYmd={draft.deathDate}
                    locale={locale}
                  />
                  {errorKey === 'deathDate' ? (
                    <p className="hint altar-field-error">
                      {t('altarErrDeathDate')}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor="altar-funeral-place">
                    {t('altarFuneralPlace')}
                  </label>
                  <input
                    id="altar-funeral-place"
                    type="text"
                    value={draft.funeralPlace}
                    onChange={e => setField('funeralPlace', e.target.value)}
                    placeholder={t('altarPlaceOptional')}
                  />
                </div>
              </>
            ) : listOnly ? (
              <>
                <p className="offer-session-note offer-session-original">
                  {personLabel}
                </p>
                <ListedToggle
                  listed={draft.listed === true}
                  onChange={next => setField('listed', next)}
                />
              </>
            ) : (
              <>
                {festivalSpecial ? null : (
                <div className="field">
                  <span
                    className="altar-honorific-label"
                    id="altar-kind-label"
                  >
                    {t('altarKindLabel')}
                  </span>
                  <div
                    className="altar-honorific"
                    role="group"
                    aria-labelledby="altar-kind-label"
                  >
                    <button
                      type="button"
                      className={
                        !isEvent
                          ? 'altar-honorific-btn is-selected'
                          : 'altar-honorific-btn'
                      }
                      aria-pressed={!isEvent}
                      onClick={() => setAltarKind('')}
                    >
                      {t('altarKindPerson')}
                    </button>
                    <button
                      type="button"
                      className={
                        isEvent
                          ? 'altar-honorific-btn is-selected'
                          : 'altar-honorific-btn'
                      }
                      aria-pressed={isEvent}
                      onClick={() => setAltarKind('event')}
                    >
                      {t('altarKindEvent')}
                    </button>
                  </div>
                </div>
                )}

                {festivalSpecial ? null : (
                <div className="field">
                  <label htmlFor="altar-name">{t('altarName')}</label>
                  <input
                    id="altar-name"
                    type="text"
                    autoComplete="name"
                    value={isEvent ? draft.name : personNameInput}
                    onChange={e => {
                      if (isEvent) setField('name', e.target.value);
                      else changePersonName(e.target.value);
                    }}
                    placeholder={
                      isEvent
                        ? t('altarEventNamePlaceholder')
                        : t('altarNamePlaceholder')
                    }
                  />
                  {errorKey === 'name' ? (
                    <p className="hint altar-field-error">{t('altarErrName')}</p>
                  ) : null}
                </div>
                )}

                {festivalSpecial ? null : (
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="altar-note">{t('altarNote')}</label>
                    <span className="field-label-budget">
                      {t('altarNoteBudget', {
                        used: utf8ByteLength(draft.note),
                        max: MEMORIAL_NOTE_MAX_BYTES,
                      })}
                    </span>
                  </div>
                  <textarea
                    id="altar-note"
                    rows={2}
                    value={draft.note}
                    onChange={e =>
                      setField(
                        'note',
                        truncateUtf8Bytes(
                          e.target.value,
                          MEMORIAL_NOTE_MAX_BYTES,
                        ),
                      )
                    }
                    placeholder={t('altarNotePlaceholder')}
                  />
                </div>
                )}

                {festivalSpecial || isEvent ? null : (
                <div className="field">
                  <label htmlFor="altar-birth-place">
                    {t('altarBirthPlace')}
                  </label>
                  <input
                    id="altar-birth-place"
                    type="text"
                    value={draft.birthPlace}
                    onChange={e => setField('birthPlace', e.target.value)}
                    placeholder={t('altarPlaceOptional')}
                  />
                </div>
                )}

                {festivalSpecial || isEvent ? null : (
                <div className="field">
                  <label htmlFor="altar-birth-date">{t('altarBirthDate')}</label>
                  <input
                    id="altar-birth-date"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={draft.birthYear}
                    onChange={e =>
                      setField(
                        'birthYear',
                        formatAltarDateInput(e.target.value),
                      )
                    }
                    placeholder={t('altarBirthDatePlaceholder')}
                  />
                  {errorKey === 'birthYear' || errorKey === 'birthDate' ? (
                    <p className="hint altar-field-error">
                      {t('altarErrBirthDate')}
                    </p>
                  ) : null}
                </div>
                )}

                {festivalSpecial ? null : (
                <div className="field">
                  <label htmlFor="altar-death-place">
                    {isEvent
                      ? t('altarEventLocation')
                      : t('altarDeathPlace')}
                  </label>
                  <input
                    id="altar-death-place"
                    type="text"
                    value={draft.deathPlace}
                    onChange={e => setField('deathPlace', e.target.value)}
                    placeholder={t('altarPlaceOptional')}
                  />
                </div>
                )}

                {festivalSpecial ? null : (
                <div className="field">
                  <label htmlFor="altar-death-date">
                    {isEvent ? t('altarEventDate') : t('altarDeathDate')}
                    {isEvent ? null : (
                      <>
                        {' '}
                        <span className="hint">({t('altarPlaceOptional')})</span>
                      </>
                    )}
                  </label>
                  <input
                    id="altar-death-date"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={draft.deathDate}
                    onChange={e =>
                      setField(
                        'deathDate',
                        formatAltarDateInput(e.target.value),
                      )
                    }
                    placeholder={t('altarDeathDatePlaceholder')}
                  />
                  <DateCalendarToggle
                    value={
                      normalizeAltarDateCalendar(draft.dateCalendar) ||
                      'solar'
                    }
                    onChange={changeDateCalendar}
                    lunarLabel={t('altarCalLunar')}
                    solarLabel={t('altarCalSolar')}
                    solarYmd={draft.deathDate}
                    locale={locale}
                  />
                  {errorKey === 'deathDate' ? (
                    <p className="hint altar-field-error">
                      {isEvent
                        ? t('altarErrEventDate')
                        : t('altarErrDeathDate')}
                    </p>
                  ) : null}
                </div>
                )}

                {festivalSpecial || isEvent ? null : (
                <div className="field">
                  <label htmlFor="altar-funeral-place">
                    {t('altarFuneralPlace')}
                  </label>
                  <input
                    id="altar-funeral-place"
                    type="text"
                    value={draft.funeralPlace}
                    onChange={e => setField('funeralPlace', e.target.value)}
                    placeholder={t('altarPlaceOptional')}
                  />
                </div>
                )}

              </>
            )}

            <div className="altar-setup-actions">
              <span />
              <button
                type="button"
                className="btn btn-primary"
                onClick={goReview}
              >
                {t('btnAltarNext')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="altar-setup-title">{reviewTitle}</h2>
            {!fragmentOnly ? (
              <TempleStory
                special={props.special}
                omitPrayer
                className="temple-story--details"
              />
            ) : null}
            {review && !festivalSpecial ? (
              <AltarDetails
                showListed={listOnly}
                altar={
                  relationshipOnly && props.initial
                    ? {
                        ...props.initial,
                        relationships: [
                          ...existingLinks,
                          {
                            type: review.relationshipType as AltarRelationshipKind,
                            relatedTxid: normalizeAltarRelatedTxid(
                              review.relatedTxid,
                            ),
                          },
                        ],
                        relationshipType: review.relationshipType,
                        relatedTxid: review.relatedTxid,
                      }
                    : deathOnly && props.initial
                      ? {
                          ...props.initial,
                          deathDate: review.deathDate,
                          deathPlace:
                            review.deathPlace || props.initial.deathPlace,
                          funeralPlace:
                            review.funeralPlace || props.initial.funeralPlace,
                          dateCalendar: review.dateCalendar,
                        }
                      : listOnly && props.initial
                        ? {
                            ...props.initial,
                            listed: review.listed === true,
                          }
                      : review
                }
                relatedAltarOptions={props.relatedAltarOptions}
                specialKind={props.special?.kind ?? null}
              />
            ) : null}
            <p className="hint eta" style={{ marginTop: '0.85rem' }}>
              {t('etaEstimated', { eta: props.etaLabel })}
            </p>
            <p className="hint">{t('hintKeepScreen')}</p>
            <div className="altar-setup-actions altar-review-actions">
              {festivalSpecial ? <span /> : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={goEdit}
              >
                {t('btnAltarEdit')}
              </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-offer"
                disabled={props.offerDisabled}
                onClick={offer}
              >
                {primaryCta}
              </button>
            </div>
          </>
        )}
      </div>
    </OfferModal>
  );
}
