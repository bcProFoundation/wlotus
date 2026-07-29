import { useEffect, useRef, useState } from 'react';
import {
  emptyAltarFields,
  formatAltarDateInput,
  normalizeAltarRelatedTxid,
  validateAltarFields,
  type AltarFields,
  type AltarHonorific,
  type AltarRelationshipType,
} from '../lib/altarFields.js';
import { extractBurnTxid } from '../lib/shareLink.js';
import { useLocale } from '../i18n/LocaleContext.js';
import { AltarDetails } from './AltarDetails.js';

type Step = 'edit' | 'review';

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
  };
}

export function AltarSetupModal(props: {
  initial: AltarFields | null;
  /** Prefill name from the simple note when opening altar the first time. */
  fallbackName?: string;
  etaLabel: string;
  offerDisabled?: boolean;
  onClose: () => void;
  /** Persist Ban thờ on the main screen (Next / Offer). */
  onSave: (fields: AltarFields) => void;
  /** Start offering from the review step. */
  onOffer: (fields: AltarFields) => void;
}) {
  const { t } = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('edit');
  const [draft, setDraft] = useState<AltarFields>(() => {
    if (props.initial) {
      return { ...props.initial, title: props.initial.title || '' };
    }
    const base = emptyAltarFields();
    const name = (props.fallbackName || '').trim();
    return name ? { ...base, name } : base;
  });
  const [review, setReview] = useState<AltarFields | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
  }, [step]);

  function setField<K extends keyof AltarFields>(key: K, value: AltarFields[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrorKey(null);
  }

  function setHonorific(next: AltarHonorific) {
    setField('title', draft.title === next ? '' : next);
  }

  function setRelationshipType(next: AltarRelationshipType) {
    const nextType = draft.relationshipType === next ? '' : next;
    setDraft(d => ({
      ...d,
      relationshipType: nextType,
      relatedTxid: nextType ? d.relatedTxid : '',
    }));
    setErrorKey(null);
  }

  function setRelatedTxidInput(raw: string) {
    // Accept a pasted wLotus link and collapse it to the bare burn txid.
    setField('relatedTxid', extractBurnTxid(raw) ?? raw);
  }

  function goReview() {
    const err = validateAltarFields(draft);
    if (err) {
      setErrorKey(err);
      return;
    }
    const fields = normalizeFields(draft);
    setDraft(fields);
    setReview(fields);
    props.onSave(fields);
    setStep('review');
  }

  function goEdit() {
    if (review) setDraft(review);
    setStep('edit');
  }

  function offer() {
    const fields = review ?? normalizeFields(draft);
    const err = validateAltarFields(fields);
    if (err) {
      setErrorKey(err);
      setStep('edit');
      return;
    }
    props.onSave(fields);
    props.onOffer(fields);
  }

  return (
    <div
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
            <h2 id="altar-setup-title">{t('altarTitle')}</h2>
            <p className="hint">{t('altarHint')}</p>

            <div className="field">
              <span className="altar-honorific-label" id="altar-honorific-label">
                {t('altarHonorific')}
              </span>
              <div
                className="altar-honorific"
                role="group"
                aria-labelledby="altar-honorific-label"
              >
                <button
                  type="button"
                  className={
                    draft.title === 'mr'
                      ? 'altar-honorific-btn is-selected'
                      : 'altar-honorific-btn'
                  }
                  aria-pressed={draft.title === 'mr'}
                  onClick={() => setHonorific('mr')}
                >
                  {t('altarHonorificMr')}
                </button>
                <button
                  type="button"
                  className={
                    draft.title === 'mrs'
                      ? 'altar-honorific-btn is-selected'
                      : 'altar-honorific-btn'
                  }
                  aria-pressed={draft.title === 'mrs'}
                  onClick={() => setHonorific('mrs')}
                >
                  {t('altarHonorificMrs')}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="altar-name">{t('altarName')}</label>
              <input
                id="altar-name"
                type="text"
                autoComplete="name"
                value={draft.name}
                onChange={e => setField('name', e.target.value)}
                placeholder={t('altarNamePlaceholder')}
              />
              {errorKey === 'name' ? (
                <p className="hint altar-field-error">{t('altarErrName')}</p>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="altar-note">{t('altarNote')}</label>
              <textarea
                id="altar-note"
                rows={2}
                value={draft.note}
                onChange={e => setField('note', e.target.value)}
                placeholder={t('altarNotePlaceholder')}
              />
            </div>

            <div className="field">
              <label htmlFor="altar-birth-place">{t('altarBirthPlace')}</label>
              <input
                id="altar-birth-place"
                type="text"
                value={draft.birthPlace}
                onChange={e => setField('birthPlace', e.target.value)}
                placeholder={t('altarPlaceOptional')}
              />
            </div>

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
                  setField('birthYear', formatAltarDateInput(e.target.value))
                }
                placeholder={t('altarBirthDatePlaceholder')}
              />
              {errorKey === 'birthYear' ? (
                <p className="hint altar-field-error">{t('altarErrBirthDate')}</p>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="altar-death-place">{t('altarDeathPlace')}</label>
              <input
                id="altar-death-place"
                type="text"
                value={draft.deathPlace}
                onChange={e => setField('deathPlace', e.target.value)}
                placeholder={t('altarPlaceOptional')}
              />
            </div>

            <div className="field">
              <label htmlFor="altar-death-date">{t('altarDeathDate')}</label>
              <input
                id="altar-death-date"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={draft.deathDate}
                onChange={e =>
                  setField('deathDate', formatAltarDateInput(e.target.value))
                }
                placeholder={t('altarDeathDatePlaceholder')}
              />
              {errorKey === 'deathDate' ? (
                <p className="hint altar-field-error">{t('altarErrDeathDate')}</p>
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
                    draft.relationshipType === 'spouse'
                      ? 'altar-honorific-btn is-selected'
                      : 'altar-honorific-btn'
                  }
                  aria-pressed={draft.relationshipType === 'spouse'}
                  onClick={() => setRelationshipType('spouse')}
                >
                  {t('altarRelationshipSpouse')}
                </button>
                <button
                  type="button"
                  className={
                    draft.relationshipType === 'parent'
                      ? 'altar-honorific-btn is-selected'
                      : 'altar-honorific-btn'
                  }
                  aria-pressed={draft.relationshipType === 'parent'}
                  onClick={() => setRelationshipType('parent')}
                >
                  {t('altarRelationshipParent')}
                </button>
                <button
                  type="button"
                  className={
                    draft.relationshipType === 'child'
                      ? 'altar-honorific-btn is-selected'
                      : 'altar-honorific-btn'
                  }
                  aria-pressed={draft.relationshipType === 'child'}
                  onClick={() => setRelationshipType('child')}
                >
                  {t('altarRelationshipChild')}
                </button>
              </div>
              {draft.relationshipType ? (
                <input
                  id="altar-related-txid"
                  type="text"
                  autoComplete="off"
                  value={draft.relatedTxid}
                  onChange={e => setRelatedTxidInput(e.target.value)}
                  placeholder={t('altarRelatedTxidPlaceholder')}
                  aria-label={t('altarRelatedTxidLabel')}
                  style={{ marginTop: '0.5rem' }}
                />
              ) : null}
              {errorKey === 'relatedTxid' || errorKey === 'relationshipType' ? (
                <p className="hint altar-field-error">
                  {t('altarErrRelatedTxid')}
                </p>
              ) : null}
            </div>

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
            <h2 id="altar-setup-title">{t('altarDetailTitle')}</h2>
            {review ? <AltarDetails altar={review} /> : null}
            <p className="hint eta" style={{ marginTop: '0.85rem' }}>
              {t('etaEstimated', { eta: props.etaLabel })}
            </p>
            <p className="hint">{t('hintKeepScreen')}</p>
            <div className="altar-setup-actions altar-review-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={goEdit}
              >
                {t('btnAltarEdit')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-offer"
                disabled={props.offerDisabled}
                onClick={offer}
              >
                {t('btnOffer')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
