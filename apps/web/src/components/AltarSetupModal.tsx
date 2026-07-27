import { useEffect, useRef, useState } from 'react';
import {
  emptyAltarFields,
  formatAltarDateInput,
  validateAltarFields,
  type AltarFields,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';
import { AltarDetails } from './AltarDetails.js';

type Step = 'edit' | 'review';

function normalizeFields(draft: AltarFields): AltarFields {
  return {
    name: draft.name.trim(),
    note: draft.note.trim(),
    birthPlace: draft.birthPlace.trim(),
    birthYear: draft.birthYear.trim(),
    deathDate: draft.deathDate.trim(),
    deathPlace: draft.deathPlace.trim(),
    funeralPlace: draft.funeralPlace.trim(),
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
    if (props.initial) return { ...props.initial };
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
