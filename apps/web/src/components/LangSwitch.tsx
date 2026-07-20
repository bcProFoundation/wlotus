import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useLocaleOptions } from '../i18n/LocaleContext.js';

/** Text language control to the right of the brand title. */
export function LangSwitch() {
  const { locale, setLocale } = useLocale();
  const options = useLocaleOptions();
  const current = options.find(o => o.locale === locale) ?? options[0]!;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="lang-code">{current.label}</span>
      </button>
      {open ? (
        <ul className="lang-menu" id={menuId} role="listbox">
          {options.map(opt => (
            <li key={opt.locale} role="option" aria-selected={opt.locale === locale}>
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
      ) : null}
    </div>
  );
}
