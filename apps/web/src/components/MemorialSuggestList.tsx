import { useLocale } from '../i18n/LocaleContext.js';
import type { SearchResultRow } from '../lib/searchAltars.js';

/** Inline name suggestions under the main memorial field. */
export function MemorialSuggestList(props: {
  results: SearchResultRow[];
  loading: boolean;
  onSelect: (txid: string) => void;
}) {
  const { t } = useLocale();
  if (!props.loading && props.results.length === 0) return null;

  return (
    <div className="note-suggest" role="listbox" aria-label={t('searchTitle')}>
      {props.loading && props.results.length === 0 ? (
        <p className="hint note-suggest-status">{t('searchLoading')}</p>
      ) : null}
      {props.results.length > 0 ? (
        <ul id="note-suggest-list" className="note-suggest-list">
          {props.results.map(r => (
            <li key={r.txid}>
              <button
                type="button"
                className="search-result-row note-suggest-row"
                role="option"
                onMouseDown={e => e.preventDefault()}
                onClick={() => props.onSelect(r.txid)}
              >
                <span className="search-result-name">{r.label}</span>
                <span className="search-result-count">
                  {t('burnTotal', { n: r.totalBurns })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
