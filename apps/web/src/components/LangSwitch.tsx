import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useLocaleOptions } from '../i18n/LocaleContext.js';

/** Language + light/dark control to the right of the brand title. */
export function LangSwitch() {
  const { locale, setLocale, appearance, setAppearance, t } = useLocale();
  const options = useLocaleOptions();
  const current = options.find(o => o.locale === locale) ?? options[0]!;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const themeGroupId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lang-switch" ref={rootRef}>
      <button
        type="button"
        className="lang-switch-btn"
        aria-label={`Language: ${current.nameEn}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="lang-code">{current.label}</span>
      </button>
      {open ? (
        <div className="lang-menu" id={menuId} role="menu">
          <ul className="lang-menu-list" role="listbox" aria-label="Language">
            {options.map(opt => (
              <li
                key={opt.locale}
                role="option"
                aria-selected={opt.locale === locale}
              >
                <button
                  type="button"
                  className={
                    opt.locale === locale
                      ? 'lang-menu-item active'
                      : 'lang-menu-item'
                  }
                  onClick={() => {
                    setLocale(opt.locale);
                    setOpen(false);
                  }}
                >
                  <span className="lang-code">{opt.label}</span>
                  <span className="lang-name">{opt.nameEn}</span>
                </button>
              </li>
            ))}
          </ul>
          <div
            className="theme-toggle"
            role="group"
            aria-labelledby={themeGroupId}
          >
            <p className="theme-toggle-label" id={themeGroupId}>
              {t('themeAppearance')}
            </p>
            <div className="theme-toggle-btns">
              <button
                type="button"
                className={
                  appearance === 'light'
                    ? 'theme-toggle-btn active'
                    : 'theme-toggle-btn'
                }
                aria-pressed={appearance === 'light'}
                onClick={() => {
                  setAppearance('light');
                  setOpen(false);
                }}
              >
                {t('themeLight')}
              </button>
              <button
                type="button"
                className={
                  appearance === 'dark'
                    ? 'theme-toggle-btn active'
                    : 'theme-toggle-btn'
                }
                aria-pressed={appearance === 'dark'}
                onClick={() => {
                  setAppearance('dark');
                  setOpen(false);
                }}
              >
                {t('themeDark')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
