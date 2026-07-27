import { useEffect, useState } from 'react';
import {
  emptyAltarFields,
  formatDeathDateInput,
  validateAltarFields,
  type AltarFields,
} from '../lib/altarFields.js';
import { useLocale } from '../i18n/LocaleContext.js';

export function AltarSetupModal(props: {
  initial: AltarFields | null;
  /** Prefill name from the simple note when opening altar the first time. */
  fallbackName?: string;
  onClose: () => void;
  onSave: (fields: AltarFields) => void;
  onClear?: () => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<AltarFields>(() => {
    if (props.initial) return { ...props.initial };
    const base = emptyAltarFields();
    const name = (props.fallbackName || '').trim();
    return name ? { ...base, name } : base;
  });
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function setField<K extends keyof AltarFields>(key: K, value: AltarFields[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrorKey(null);
  }

  function save() {
    const err = validateAltarFields(draft);
    if (err) {
      setErrorKey(err);
      return;
    }
    props.onSave({
      name: draft.name.trim(),
      note: draft.note.trim(),
      birthPlace: draft.birthPlace.trim(),
      birthYear: draft.birthYear.trim(),
      deathDate: draft.deathDate.trim(),
      deathPlace: draft.deathPlace.trim(),
      funeralPlace: draft.funeralPlace.trim(),
    });
  }

  return (
    <div
      className="offer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="altar-setup-title"
    >
      <div className="offer-modal-card altar-setup-card">
        <button
          type="button"
          className="offer-modal-close"
          aria-label={t('btnClose')}
          onClick={props.onClose}
        >
          ×
        </button>
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

        <div className="altar-grid">
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
            <label htmlFor="altar-birth-year">{t('altarBirthYear')}</label>
            <input
              id="altar-birth-year"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={draft.birthYear}
              onChange={e =>
                setField('birthYear', e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder={t('altarBirthYearPlaceholder')}
            />
            {errorKey === 'birthYear' ? (
              <p className="hint altar-field-error">{t('altarErrBirthYear')}</p>
            ) : null}
          </div>
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
            onChange={e => setField('deathDate', formatDeathDateInput(e.target.value))}
            placeholder={t('altarDeathDatePlaceholder')}
          />
          {errorKey === 'deathDate' ? (
            <p className="hint altar-field-error">{t('altarErrDeathDate')}</p>
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
          <label htmlFor="altar-funeral-place">{t('altarFuneralPlace')}</label>
          <input
            id="altar-funeral-place"
            type="text"
            value={draft.funeralPlace}
            onChange={e => setField('funeralPlace', e.target.value)}
            placeholder={t('altarPlaceOptional')}
          />
        </div>

        <p className="hint altar-geo-hint">{t('altarGeoHint')}</p>

        <div className="altar-setup-actions">
          <span />
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('btnAltarSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
